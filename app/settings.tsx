import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePurchases } from '../contexts/PurchasesContext';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';
import { exportWorkoutsCsv } from '../lib/export';
import { ProBadge } from '../components/ProLock';
import { useUnits } from '../hooks/useUnits';
import type { UnitSystem } from '../types/models';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { signOut, user, updateProfile } = useAuth();
  const units = useUnits();

  const setUnits = (next: UnitSystem) => {
    if (next === units) return;
    updateProfile({ units: next }).catch((e) =>
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.')
    );
  };
  const { isPro, presentCustomerCenter, redeemOfferCode, isAvailable: purchasesAvailable } = usePurchases();
  const { logs } = useWorkoutLogs(user?.uid);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    if (logs.length === 0) {
      Alert.alert('Nothing to export yet', 'Finish a workout first.');
      return;
    }
    setExporting(true);
    try {
      await exportWorkoutsCsv(logs, units);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading} accessibilityRole="header">
          Settings
        </Text>

        <View style={styles.unitsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Units</Text>
            <Text style={styles.unitsHint}>
              {units === 'metric' ? 'Kilometers & kilograms' : 'Miles & pounds'}
            </Text>
          </View>
          <View style={styles.segment} accessibilityRole="radiogroup">
            {(['imperial', 'metric'] as const).map((option) => {
              const active = units === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setUnits(option)}
                  style={[styles.segmentOption, active && styles.segmentOptionActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={option === 'metric' ? 'Metric' : 'Imperial'}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {option === 'metric' ? 'km · kg' : 'mi · lb'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.rowGroup}>
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push('/paywall')}>
            <View style={styles.rowInline}>
              <Text style={styles.rowLabel}>{isPro ? 'Iron Pillar Pro' : 'Upgrade to Pro'}</Text>
              <ProBadge />
            </View>
          </Pressable>
          {isPro && (
            <Pressable
              style={styles.row}
              accessibilityRole="button"
              onPress={() =>
                presentCustomerCenter().catch((e) =>
                  Alert.alert('Could not open', e instanceof Error ? e.message : 'Try again.')
                )
              }
            >
              <Text style={styles.rowLabel}>Manage Subscription</Text>
            </Pressable>
          )}
          {Platform.OS === 'ios' && purchasesAvailable && !isPro && (
            <Pressable
              style={styles.row}
              accessibilityRole="button"
              onPress={() =>
                redeemOfferCode().catch((e) =>
                  Alert.alert('Could not open', e instanceof Error ? e.message : 'Try again.')
                )
              }
            >
              <Text style={styles.rowLabel}>Redeem Pro Code</Text>
            </Pressable>
          )}
          <Pressable style={styles.row} accessibilityRole="button" onPress={exporting ? undefined : handleExport}>
            <View style={styles.rowInline}>
              <Text style={styles.rowLabel}>
                {exporting ? 'Preparing export...' : 'Export Workout Data (CSV)'}
              </Text>
              {!isPro && <ProBadge />}
            </View>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push('/edit-profile')}>
            <Text style={styles.rowLabel}>Edit Profile</Text>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push('/account-details')}>
            <Text style={styles.rowLabel}>Account Details</Text>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push('/history')}>
            <Text style={styles.rowLabel}>History</Text>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push('/reminders' as Href)}>
            <Text style={styles.rowLabel}>Reminders</Text>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="button" onPress={() => router.push('/blocked-users' as Href)}>
            <Text style={styles.rowLabel}>Blocked Users</Text>
          </Pressable>
          <Pressable
            style={styles.row}
            accessibilityRole="link"
            onPress={() => Linking.openURL('mailto:aidand510@gmail.com?subject=Iron%20Pillar%20support')}
          >
            <Text style={styles.rowLabel}>Contact Support</Text>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="link" onPress={() => Linking.openURL('https://www.ironpillar.app/terms')}>
            <Text style={styles.rowLabel}>Terms of Use</Text>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="link" onPress={() => Linking.openURL('https://www.ironpillar.app/privacy')}>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
          </Pressable>
          <Pressable style={styles.row} accessibilityRole="button" onPress={signOut}>
            <Text style={styles.rowLabel}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 60, gap: spacing.lg },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  rowGroup: { gap: spacing.lg },
  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  unitsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  unitsHint: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    padding: 3,
  },
  segmentOption: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: 999 },
  segmentOptionActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.text, fontWeight: '700', fontSize: typography.sizes.small },
  segmentTextActive: { color: colors.textOnDark },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: typography.sizes.body, color: colors.primary, fontWeight: '600' },
});
