import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { WorkoutHeader } from '../../components/WorkoutHeader';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { formatShortDate } from '../../lib/dates';
import { formatDistance } from '../../lib/units';
import { useUnits } from '../../hooks/useUnits';
import type { UnitSystem } from '../../types/models';
import { deleteWorkoutLog } from '../../lib/workoutCompletion';
import type { WorkoutLog } from '../../types/models';

function activityMeta(log: WorkoutLog, units: UnitSystem): string {
  if (log.workoutSource === 'outdoor') {
    return formatDistance(log.distanceMeters ?? 0, units);
  }
  return `${log.exercises.length} exercise${log.exercises.length === 1 ? '' : 's'}`;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const { logs, loading } = useWorkoutLogs(user?.uid);
  const units = useUnits();

  const confirmDelete = (log: WorkoutLog) => {
    Alert.alert(
      'Delete workout?',
      `This removes "${log.workoutName}" and takes back the ${log.xpEarned} XP it earned. Past streak days are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteWorkoutLog(log.id).catch((e) =>
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.')
            ),
        },
      ]
    );
  };

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
          <Pressable
            key={log.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/history/${log.id}` as Href)}
            accessibilityRole="button"
            accessibilityLabel={`${log.workoutName}, ${formatShortDate(log.completedAt)}. Shows what you did`}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.workoutName, { flex: 1 }]} numberOfLines={1}>
                {log.workoutName}
              </Text>
              <Text style={styles.xp}>
                +{log.xpEarned}xp{(log.xpMultiplier ?? 1) > 1 ? ` · ${log.xpMultiplier}× Pro` : ''}
              </Text>
              <Pressable
                onPress={() => confirmDelete(log)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${log.workoutName}`}
                style={styles.deleteButton}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text style={styles.meta}>
              {formatShortDate(log.completedAt)} · {formatDuration(log.durationSeconds)} ·{' '}
              {activityMeta(log, units)}
            </Text>
            {log.streakBonusEarned > 0 && (
              <Text style={styles.streakBonus}>Streak Bonus: +{log.streakBonusEarned}xp</Text>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
  cardPressed: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutName: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.body },
  xp: { fontWeight: '700', color: colors.accentFlameText },
  deleteButton: { marginLeft: spacing.sm },
  meta: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 4 },
  streakBonus: { color: colors.text, fontSize: typography.sizes.small, marginTop: 2 },
});
