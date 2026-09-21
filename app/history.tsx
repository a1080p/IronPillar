import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';
import { formatShortDate } from '../lib/dates';
import { formatDistanceMiles } from '../lib/geo';
import type { WorkoutLog } from '../types/models';

function activityMeta(log: WorkoutLog): string {
  if (log.workoutSource === 'outdoor') {
    return formatDistanceMiles(log.distanceMeters ?? 0);
  }
  return `${log.exercises.length} exercise${log.exercises.length === 1 ? '' : 's'}`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { logs, loading } = useWorkoutLogs(user?.uid);

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>History</Text>

        {loading && <Text style={styles.note}>Loading...</Text>}
        {!loading && logs.length === 0 && (
          <Text style={styles.note}>No workouts completed yet — your history will show up here.</Text>
        )}

        {logs.map((log) => (
          <View key={log.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.workoutName}>{log.workoutName}</Text>
              <Text style={styles.xp}>+{log.xpEarned}xp</Text>
            </View>
            <Text style={styles.meta}>
              {formatShortDate(log.completedAt)} · {formatDuration(log.durationSeconds)} ·{' '}
              {activityMeta(log)}
            </Text>
            {log.streakBonusEarned > 0 && (
              <Text style={styles.streakBonus}>Streak Bonus: +{log.streakBonusEarned}xp</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  note: { color: colors.textMuted },
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutName: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.body },
  xp: { fontWeight: '700', color: colors.accentFlame },
  meta: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 4 },
  streakBonus: { color: colors.text, fontSize: typography.sizes.small, marginTop: 2 },
});
