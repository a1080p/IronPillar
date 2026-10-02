import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { Button } from '../components/Button';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { usePurchases } from '../contexts/PurchasesContext';
import { FREE_FEATURES, PRO_FEATURES, type PlanFeature } from '../constants/pro';

// Static fallback shown until a RevenueCat offering is configured and
// fetched — keeps the paywall's copy/pricing visible (if not yet purchasable)
// instead of a blank screen while that setup is pending.
const FALLBACK_PLANS = [
  { id: 'monthly', label: 'Monthly', price: '$9.99', period: '/month' },
  { id: 'annual', label: 'Annual', price: '$79.99', period: '/year', badge: 'Best value' },
];

// Props we use on RevenueCatUI.Paywall. Typed locally because the module is
// loaded with a dynamic import (it's native-only; importing it statically
// would crash Expo Go and web).
type RevenueCatPaywallProps = {
  options?: { displayCloseButton?: boolean };
  onPurchaseCompleted?: () => void;
  onRestoreCompleted?: () => void;
  onPurchaseError?: (args: { error: { message?: string } }) => void;
  onDismiss?: () => void;
};

export default function PaywallScreen() {
  const { isAvailable, isPro } = usePurchases();
  const [RevenueCatPaywall, setRevenueCatPaywall] =
    useState<ComponentType<RevenueCatPaywallProps> | null>(null);

  useEffect(() => {
    if (!isAvailable || isPro) return;
    let cancelled = false;
    import('react-native-purchases-ui')
      .then((m) => {
        if (!cancelled) setRevenueCatPaywall(() => m.default.Paywall as ComponentType<RevenueCatPaywallProps>);
      })
      .catch((e) => console.warn('RevenueCat UI unavailable, using built-in paywall', e));
    return () => {
      cancelled = true;
    };
  }, [isAvailable, isPro]);

  // RevenueCat Paywall: designed and A/B-tested in the RevenueCat dashboard
  // (attached to the current offering). It handles purchase, restore, and
  // errors itself; the customerInfo listener in PurchasesContext flips isPro.
  if (RevenueCatPaywall && !isPro) {
    return (
      <RevenueCatPaywall
        options={{ displayCloseButton: true }}
        onPurchaseCompleted={() => router.replace('/pro-welcome' as Href)}
        onRestoreCompleted={() => router.back()}
        onPurchaseError={({ error }) =>
          Alert.alert('Purchase failed', error.message ?? 'Try again.')
        }
        onDismiss={() => router.back()}
      />
    );
  }

  return <BuiltInPaywall />;
}

// Shown to Pro users (as a "you're Pro" summary), and as the purchase screen
// wherever RevenueCat's native UI isn't available.
function BuiltInPaywall() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const {
    isAvailable,
    loading,
    isPro,
    offering,
    purchasePackage,
    restorePurchases,
    presentCustomerCenter,
  } = usePurchases();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const packages = offering?.availablePackages ?? [];
  const selectedPackage = packages.find((p) => p.identifier === selectedId) ?? packages[0];

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert(
        'Not set up yet',
        'Subscriptions aren’t configured on this build yet — check back soon.'
      );
      return;
    }
    setPurchasing(true);
    try {
      await purchasePackage(selectedPackage);
      router.replace('/pro-welcome' as Href);
    } catch (e) {
      const code = (e as { userCancelled?: boolean } | undefined)?.userCancelled;
      if (!code) {
        Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      Alert.alert('Restored', 'Your purchases have been restored.');
    } catch (e) {
      Alert.alert('Could not restore', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Iron Pillar Pro</Text>
        <Text style={styles.subtitle}>
          Train smarter with readiness scoring, wearable sync, and coaching-level analytics.
        </Text>

        {isPro ? (
          <View style={styles.proBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.proBannerText}>You're already Pro. Thanks for supporting Iron Pillar.</Text>
          </View>
        ) : null}
        {isPro ? (
          // Pro users get Customer Center (manage/cancel, restore, refunds)
          // instead of the pricing cards.
          <Text style={styles.manageLink} accessibilityRole="button" onPress={() => presentCustomerCenter()}>
            Manage subscription
          </Text>
        ) : (
          <>
            <View style={styles.plansRow}>
              {(packages.length > 0
                ? packages.map((p) => ({
                    id: p.identifier,
                    label: p.product.title || packageTypeLabel(p),
                    price: p.product.priceString,
                    period: packageTypeLabel(p) === 'Annual' ? '/year' : '/month',
                    badge: packageTypeLabel(p) === 'Annual' ? 'Best value' : undefined,
                    pkg: p,
                  }))
                : FALLBACK_PLANS
              ).map((plan) => {
                const isSelected =
                  packages.length > 0
                    ? selectedPackage?.identifier === plan.id
                    : selectedId === plan.id || (!selectedId && plan.id === 'annual');
                return (
                  <View
                    key={plan.id}
                    style={[styles.planCard, isSelected && styles.planCardSelected]}
                    onTouchEnd={() => setSelectedId(plan.id)}
                  >
                    {plan.badge && (
                      <Text style={styles.planBadge}>{plan.badge}</Text>
                    )}
                    <Text style={styles.planLabel}>{plan.label}</Text>
                    <Text style={styles.planPrice}>
                      {plan.price}
                      <Text style={styles.planPeriod}>{plan.period}</Text>
                    </Text>
                  </View>
                );
              })}
            </View>

            {!isAvailable && (
              <Text style={styles.notice}>
                Subscriptions aren't available in this build yet — this is a preview of what
                Pro will unlock.
              </Text>
            )}
          </>
        )}

        <View style={styles.featureList}>
          {PRO_FEATURES.map((f) => (
            <FeatureRow key={f.title} feature={f} />
          ))}
        </View>

        <Text style={styles.freeHeading}>Always free</Text>
        {FREE_FEATURES.map((f) => (
          <View key={f} style={styles.freeRow}>
            <Ionicons name="checkmark" size={16} color={colors.textMuted} />
            <Text style={styles.freeText}>{f}</Text>
          </View>
        ))}
        {!isPro && (
          <Text style={styles.legal}>
            Subscriptions renew automatically unless cancelled at least 24 hours before the end of
            the current period. Manage or cancel anytime in your App Store account settings.
          </Text>
        )}
      </ScrollView>

      {!isPro && (
        <View style={styles.footer}>
          <Button
            label={purchasing ? 'Processing...' : 'Continue'}
            onPress={handlePurchase}
            loading={purchasing}
            disabled={loading || restoring}
          />
          <Text style={styles.restoreLink} accessibilityRole="button" onPress={handleRestore}>
            {restoring ? 'Restoring...' : 'Restore Purchases'}
          </Text>
          <View style={styles.legalLinks}>
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => Linking.openURL('https://www.ironpillar.app/terms')}>
              Terms of Use
            </Text>
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => Linking.openURL('https://www.ironpillar.app/privacy')}>
              Privacy Policy
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function packageTypeLabel(pkg: PurchasesPackage): string {
  if (pkg.packageType === 'ANNUAL') return 'Annual';
  if (pkg.packageType === 'MONTHLY') return 'Monthly';
  return pkg.identifier;
}

function FeatureRow({ feature }: { feature: PlanFeature }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        <Ionicons name={feature.icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{feature.title}</Text>
        <Text style={styles.featureDescription}>{feature.description}</Text>
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  title: { fontSize: typography.sizes.xl, fontWeight: '800', color: colors.primary },
  subtitle: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  proBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  proBannerText: { flex: 1, color: colors.text, fontWeight: '600' },
  plansRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  planCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  planCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  planBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  planLabel: { fontWeight: '700', color: colors.text },
  planPrice: { fontSize: typography.sizes.lg, fontWeight: '800', color: colors.primary, marginTop: spacing.xs },
  planPeriod: { fontSize: typography.sizes.small, fontWeight: '600', color: colors.textMuted },
  notice: { color: colors.textMuted, fontSize: typography.sizes.small, marginBottom: spacing.lg },
  featureList: { gap: spacing.md, marginTop: spacing.lg },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { color: colors.text, fontWeight: '700' },
  featureDescription: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
  freeHeading: {
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  freeText: { color: colors.textMuted, fontSize: typography.sizes.small, flex: 1 },
  legal: { color: colors.textMuted, fontSize: 11, marginTop: spacing.lg },
  manageLink: { color: colors.primary, fontWeight: '700', marginBottom: spacing.lg },
  legalLinks: { flexDirection: 'row', gap: spacing.lg },
  legalLink: { color: colors.textMuted, fontSize: 11, textDecorationLine: 'underline' },
  footer: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  restoreLink: { color: colors.primary, fontWeight: '600', fontSize: typography.sizes.small },
});
