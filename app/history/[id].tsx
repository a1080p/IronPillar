import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { ExerciseNotes } from '../../components/ExerciseNotes';
import { MapRoute } from '../../components/MapRoute';
import { WorkoutHeader } from '../../components/WorkoutHeader';
import { radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useUnits } from '../../hooks/useUnits';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { formatElapsed } from '../../lib/geo';
import { formatDistance, formatPace, formatVolume, lbToDisplay, weightUnit } from '../../lib/units';
import { deleteWorkoutLog } from '../../lib/workoutCompletion';
import { summarizeExerciseLogs } from '../../lib/workoutStats';
import type { LoggedSet, UnitSystem } from '../../types/models';

function formatSet(set: LoggedSet, units: UnitSystem) {
  if (set.durationSeconds != null) return `${set.durationSeconds} sec`;
  if (set.reps == null) return null;
  if (set.weight) return `${lbToDisplay(set.weight, units)} ${weightUnit(units)} × ${set.reps}`;
  return `${set.reps} reps`;
}

// One finished workout from History: what was done, totals, XP, and each
// exercise's notes. It can be deleted from here.
export default function WorkoutLogDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { logs, loading } = useWorkoutLogs(user?.uid);
  const units = useUnits();
  const [deleting, setDeleting] = useState(false);
  const log = logs.find((l) => l.id === id);

  if (!log) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.note}>{loading || deleting ? 'Loading...' : 'This workout was deleted.'}</Text>
      </SafeAreaView>
    );
  }

  const isOutdoor = log.workoutSource === 'outdoor';
  const totals = summarizeExerciseLogs(log.exercises);
  const completed = new Date(log.completedAt);
  const when = completed.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const confirmDelete = () => {
    Alert.alert(
      'Delete workout?',
      `This removes "${log.workoutName}", takes back the ${log.xpEarned} XP it earned, and updates your stats. Past streak days and badges you've earned are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteWorkoutLog(log.id);
              router.back();
            } catch (e) {
              setDeleting(false);
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ]
    );
  };

  const stats: { label: string; value: string }[] = isOutdoor
    ? [
        { label: 'Distance', value: formatDistance(log.distanceMeters ?? 0, units) },
        { label: 'Time', value: formatElapsed(log.durationSeconds) },
        { label: 'Avg pace', value: formatPace(log.distanceMeters ?? 0, log.durationSeconds, units) },
      ]
    : [
        { label: 'Time', value: formatElapsed(log.durationSeconds) },
        { label: 'Lifted', value: formatVolume(totals.volume, units) },
        { label: 'Sets', value: String(totals.sets) },
        { label: 'Reps', value: String(totals.reps) },
      ];

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">
          {log.workoutName}
        </Text>
        <Text style={styles.when}>{when}</Text>

        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.value}`}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.xpBox}>
          <Text style={styles.xpValue}>+{log.xpEarned} XP</Text>
          <Text style={styles.xpDetail}>
            {[
              log.streakBonusEarned > 0 ? `includes +${log.streakBonusEarned} streak bonus` : null,
              (log.xpMultiplier ?? 1) > 1 ? `${log.xpMultiplier}× Pro` : null,
              log.streakCountAfter > 0 ? `streak after: ${log.streakCountAfter} days` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        {isOutdoor && (log.route?.length ?? 0) > 1 && (
          <View style={styles.map}>
            <MapRoute route={log.route ?? []} style={StyleSheet.absoluteFill} />
          </View>
        )}

        {log.exercises.map((exercise, i) => {
          const sets = exercise.sets.map((set) => formatSet(set, units));
          const done = sets.filter(Boolean).length;
          return (
            <View key={`${exercise.exerciseId}-${i}`} style={styles.exercise}>
              <Text style={styles.exerciseName}>
                {i + 1}. {exercise.exerciseName}
              </Text>
              {done === 0 ? (
                <Text style={styles.skipped}>Skipped (nothing logged)</Text>
              ) : (
                sets.map((text, setIndex) =>
                  text ? (
                    <Text key={setIndex} style={styles.setLine}>
                      Set {setIndex + 1}: {text}
                    </Text>
                  ) : null
                )
              )}
              <ExerciseNotes uid={user?.uid} exerciseName={exercise.exerciseName} compact />
            </View>
          );
        })}

        <View style={styles.deleteWrap}>
          <Button label="Delete Workout" variant="outline" onPress={confirmDelete} loading={deleting} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    note: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
    scroll: { padding: spacing.lg, paddingBottom: 60 },
    title: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
    when: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
    stat: {
      flexGrow: 1,
      minWidth: 70,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    statValue: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.text },
    statLabel: { fontSize: typography.sizes.small, color: colors.textMuted, marginTop: 2 },
    xpBox: { marginBottom: spacing.lg },
    xpValue: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.accentFlameText },
    xpDetail: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
    map: { height: 220, borderRadius: radii.md, overflow: 'hidden', marginBottom: spacing.lg },
    exercise: {
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      gap: 2,
    },
    exerciseName: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.body },
    setLine: { color: colors.text },
    skipped: { color: colors.textMuted, fontStyle: 'italic' },
    deleteWrap: { marginTop: spacing.xl },
  });
