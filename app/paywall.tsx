import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { PurchasesPackage } from 'react-native-purchases';
import { Button } from '../components/Button';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { usePurchases } from '../contexts/PurchasesContext';

// Static fallback shown until a RevenueCat offering is configured and
// fetched — keeps the paywall's copy/pricing visible (if not yet purchasable)
// instead of a blank screen while that setup is pending.
const FALLBACK_PLANS = [
  { id: 'monthly', label: 'Monthly', price: '$9.99', period: '/month' },
  { id: 'annual', label: 'Annual', price: '$79.99', period: '/year', badge: 'Best value' },
];

const LIVE_FEATURES = ['AI-generated workout details (overview, tips, equipment, calories)'];
const COMING_SOON_FEATURES = [
  'WHOOP & Apple Health sync',
  'Advanced analytics (1RM trends, recovery-aware recommendations)',
  'Unlimited custom workouts',
  'Data export',
];

export default function PaywallScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { isAvailable, loading, isPro, offering, purchasePackage, restorePurchases } =
    usePurchases();
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
      Alert.alert('Welcome to Pro', 'Your subscription is active.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
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
          Unlock AI-powered workout details and everything coming next.
        </Text>

        {isPro ? (
          <View style={styles.proBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.proBannerText}>You're already Pro. Thanks for supporting Iron Pillar.</Text>
          </View>
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
          {LIVE_FEATURES.map((f) => (
            <FeatureRow key={f} label={f} live />
          ))}
          {COMING_SOON_FEATURES.map((f) => (
            <FeatureRow key={f} label={f} />
          ))}
        </View>
      </ScrollView>

      {!isPro && (
        <View style={styles.footer}>
          <Button
            label={purchasing ? 'Processing...' : 'Continue'}
            onPress={handlePurchase}
            loading={purchasing}
            disabled={loading || restoring}
          />
          <Text style={styles.restoreLink} onPress={handleRestore}>
            {restoring ? 'Restoring...' : 'Restore Purchases'}
          </Text>
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

function FeatureRow({ label, live }: { label: string; live?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.featureRow}>
      <Ionicons
        name={live ? 'checkmark-circle' : 'time-outline'}
        size={18}
        color={live ? colors.success : colors.textMuted}
      />
      <Text style={[styles.featureText, !live && styles.featureTextMuted]}>
        {label}
        {!live && '  (coming soon)'}
      </Text>
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
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureText: { color: colors.text, flex: 1 },
  featureTextMuted: { color: colors.textMuted },
  footer: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  restoreLink: { color: colors.primary, fontWeight: '600', fontSize: typography.sizes.small },
});
