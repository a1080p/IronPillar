import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { signOut, user } = useAuth();
  const { isPro, presentCustomerCenter } = usePurchases();
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
      await exportWorkoutsCsv(logs);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <View style={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        <View style={styles.rowGroup}>
          <Pressable style={styles.row} onPress={() => router.push('/paywall')}>
            <View style={styles.rowInline}>
              <Text style={styles.rowLabel}>{isPro ? 'Iron Pillar Pro' : 'Upgrade to Pro'}</Text>
              <ProBadge />
            </View>
          </Pressable>
          {isPro && (
            <Pressable
              style={styles.row}
              onPress={() =>
                presentCustomerCenter().catch((e) =>
                  Alert.alert('Could not open', e instanceof Error ? e.message : 'Try again.')
                )
              }
            >
              <Text style={styles.rowLabel}>Manage Subscription</Text>
            </Pressable>
          )}
          <Pressable style={styles.row} onPress={() => router.push('/insights')}>
            <Text style={styles.rowLabel}>Insights</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={exporting ? undefined : handleExport}>
            <View style={styles.rowInline}>
              <Text style={styles.rowLabel}>
                {exporting ? 'Preparing export...' : 'Export Workout Data (CSV)'}
              </Text>
              {!isPro && <ProBadge />}
            </View>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/edit-profile')}>
            <Text style={styles.rowLabel}>Edit Profile</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/account-details')}>
            <Text style={styles.rowLabel}>Account Details</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/history')}>
            <Text style={styles.rowLabel}>History</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/reminders' as Href)}>
            <Text style={styles.rowLabel}>Reminders</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={signOut}>
            <Text style={styles.rowLabel}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  rowGroup: { gap: spacing.lg },
  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowLabel: { fontSize: typography.sizes.body, color: colors.primary, fontWeight: '600' },
});
