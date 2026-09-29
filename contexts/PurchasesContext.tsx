import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import type { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { useAuth } from './AuthContext';

// The Pro entitlement identifier as configured in the RevenueCat dashboard
// (Project > Entitlements). Must match exactly, or isPro will never flip true
// even after a successful purchase.
export const PRO_ENTITLEMENT_ID = 'iron_pillar_pro';

// RevenueCat's SDK, like Google Sign-In, calls into native code at import
// time on some platforms — importing it in Expo Go (no native module present)
// would crash the shared preview for every tester the moment this file
// loads. Same guard pattern as AuthContext's Google Sign-In: check
// availability with plain JS/env values only, dynamically `import()` the
// package itself, deferred until it's actually needed on a build that has
// the native module.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const apiKey =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
// Purchases aren't wired up (no RevenueCat project yet, or running in Expo
// Go) until both a native build and an API key are in place. Every screen
// that gates a feature on isPro treats "not ready" the same as "not pro" —
// nothing paywalled silently unlocks just because RevenueCat isn't configured
// yet.
// RevenueCat Test Store keys (`test_…`) make the SDK crash on purpose in any
// release build — including ad hoc "preview" and TestFlight builds — so a
// shipped build can never sell fake products. They're only for development
// builds; release builds need the platform key (`appl_…` on iOS). If a test
// key ever leaks into a release build, treat purchases as unavailable instead
// of crashing on launch.
const isTestStoreKey = !!apiKey?.startsWith('test_');
const purchasesReady = !isExpoGo && !!apiKey && !(isTestStoreKey && !__DEV__);
let configured = false;

async function ensurePurchasesConfigured(uid: string | null) {
  if (!purchasesReady) return null;
  const Purchases = (await import('react-native-purchases')).default;
  if (!configured) {
    if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: apiKey!, appUserID: uid ?? undefined });
    configured = true;
  } else if (uid) {
    await Purchases.logIn(uid);
  } else {
    await Purchases.logOut().catch(() => {});
  }
  return Purchases;
}

interface PurchasesContextValue {
  isAvailable: boolean;
  loading: boolean;
  isPro: boolean;
  customerInfo: CustomerInfo | null;
  offering: PurchasesOffering | null;
  purchasePackage: (pkg: PurchasesPackage) => Promise<void>;
  restorePurchases: () => Promise<void>;
  // RevenueCat's own paywall (designed in the RevenueCat dashboard), shown
  // only if the user doesn't already have Pro. Resolves to the result, or
  // null when purchases aren't available on this build.
  presentPaywallIfNeeded: () => Promise<PAYWALL_RESULT | null>;
  // RevenueCat Customer Center: manage/cancel, restore, refund requests.
  presentCustomerCenter: () => Promise<void>;
}

const PurchasesContext = createContext<PurchasesContextValue | undefined>(undefined);

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(purchasesReady);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    if (!purchasesReady) return;
    let cancelled = false;
    let removeListener: (() => void) | undefined;

    (async () => {
      const Purchases = await ensurePurchasesConfigured(user?.uid ?? null);
      if (!Purchases || cancelled) return;

      const listener = (info: CustomerInfo) => {
        if (!cancelled) setCustomerInfo(info);
      };
      Purchases.addCustomerInfoUpdateListener(listener);
      removeListener = () => Purchases.removeCustomerInfoUpdateListener(listener);

      try {
        const [info, offerings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (cancelled) return;
        setCustomerInfo(info);
        setOffering(offerings.current);
      } catch (e) {
        console.warn('RevenueCat init failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      removeListener?.();
    };
    // Re-runs on sign-in/sign-out so the RevenueCat identity tracks the
    // signed-in Firebase user, per RevenueCat's own login/logout guidance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const isPro = !!customerInfo?.entitlements.active[PRO_ENTITLEMENT_ID];

  const purchasePackage = useCallback(async (pkg: PurchasesPackage) => {
    const Purchases = (await import('react-native-purchases')).default;
    const { customerInfo: updated } = await Purchases.purchasePackage(pkg);
    setCustomerInfo(updated);
  }, []);

  const restorePurchases = useCallback(async () => {
    if (!purchasesReady) return;
    const Purchases = (await import('react-native-purchases')).default;
    const updated = await Purchases.restorePurchases();
    setCustomerInfo(updated);
  }, []);

  // Both UI helpers rely on the customerInfo listener above to pick up any
  // purchase/restore, so isPro updates everywhere without extra plumbing.
  const presentPaywallIfNeeded = useCallback(async () => {
    if (!purchasesReady) return null;
    const RevenueCatUI = (await import('react-native-purchases-ui')).default;
    return RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
      displayCloseButton: true,
    });
  }, []);

  // Customer Center is a paid-RevenueCat-plan feature (Pro/Enterprise). If
  // it's unavailable or fails to open, fall back to Apple's own subscription
  // management sheet so "Manage Subscription" always does something useful.
  const presentCustomerCenter = useCallback(async () => {
    if (!purchasesReady) return;
    try {
      const RevenueCatUI = (await import('react-native-purchases-ui')).default;
      await RevenueCatUI.presentCustomerCenter();
    } catch (e) {
      console.warn('Customer Center unavailable, opening store subscription management', e);
      const Purchases = (await import('react-native-purchases')).default;
      await Purchases.showManageSubscriptions();
    }
  }, []);

  const value = useMemo<PurchasesContextValue>(
    () => ({
      isAvailable: purchasesReady,
      loading,
      isPro,
      customerInfo,
      offering,
      purchasePackage,
      restorePurchases,
      presentPaywallIfNeeded,
      presentCustomerCenter,
    }),
    [
      loading,
      isPro,
      customerInfo,
      offering,
      purchasePackage,
      restorePurchases,
      presentPaywallIfNeeded,
      presentCustomerCenter,
    ]
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

export function usePurchases() {
  const ctx = useContext(PurchasesContext);
  if (!ctx) throw new Error('usePurchases must be used within PurchasesProvider');
  return ctx;
}
