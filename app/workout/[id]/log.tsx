import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/ProgressBar';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { WorkoutNotes } from '../../../components/WorkoutNotes';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { motivationalMessages } from '../../../constants/motivation';
import { useWorkout } from '../../../hooks/useWorkout';
import { useAuth } from '../../../contexts/AuthContext';
import { completeWorkout } from '../../../lib/workoutCompletion';
import { noteWorkoutStarted } from '../../../lib/gymReminders';
import {
  endWorkoutActivity,
  hasWorkoutActivity,
  startWorkoutActivity,
  updateWorkoutActivity,
} from '../../../lib/liveActivity';
import { startStrengthWatchdog, stopStrengthWatchdog } from '../../../lib/workoutWatchdog';
import { summarizeExerciseLogs } from '../../../lib/workoutStats';
import { lastPerformance } from '../../../lib/insights';
import { displayToLb, lbToDisplay, weightUnit } from '../../../lib/units';
import { useUnits } from '../../../hooks/useUnits';
import type { UnitSystem } from '../../../types/models';
import { useWorkoutLogs } from '../../../hooks/useWorkoutLogs';
import { usePurchases } from '../../../contexts/PurchasesContext';
import { syncCompletedWorkoutToHealth } from '../../../hooks/useAppleHealth';
import type { ExerciseLog, LoggedSet } from '../../../types/models';

const REST_OPTIONS = [60, 90, 120];

export default function WorkoutLogScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { workout: template } = useWorkout(id, user?.uid);
  const navigation = useNavigation();
  const { isPro } = usePurchases();
  const units = useUnits();
  const { logs: history } = useWorkoutLogs(user?.uid);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [sets, setSets] = useState<LoggedSet[]>([]);
  // Raw text of each weight box, so a half-typed decimal like "22." isn't
  // parsed away mid-typing (kg users need decimals).
  const [weightText, setWeightText] = useState<Record<number, string>>({});
  const [finishing, setFinishing] = useState(false);
  const startTime = useRef(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Set right before navigating away because the workout finished, so the
  // beforeRemove guard below doesn't prompt on the way to the complete screen.
  const isCompletingRef = useRef(false);

  // Cancels any pending "you're at the gym" reminder now that they've started.
  useEffect(() => {
    noteWorkoutStarted();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isCompletingRef.current) return;
      e.preventDefault();
      Alert.alert('Quit workout?', 'All progress will be lost if you quit now.', [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Quit',
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const exercise = template?.exercises[exerciseIndex];
  // Free: what you did for this exercise last time, shown as a hint and used
  // as each set's placeholder so matching or beating it is one glance away.
  const last = useMemo(
    () => (exercise ? lastPerformance(history, exercise.name) : null),
    [history, exercise?.name]
  );

  // Free: rest timer. Rides the existing 1s elapsed tick for re-renders.
  const restRemaining =
    restEndsAt != null ? Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)) : null;
  useEffect(() => {
    if (restRemaining === 0) {
      Vibration.vibrate(400);
      setRestEndsAt(null);
    }
  }, [restRemaining]);

  useEffect(() => {
    if (!exercise) return;
    setSets(Array.from({ length: exercise.targetSets }, () => ({})));
    setWeightText({});
  }, [exercise?.id]);

  // Lock-screen Live Activity: the workout timer, the current exercise and
  // set, and the rest countdown. The set shown is the first one not filled in.
  const firstEmptySet = sets.findIndex((set) => set.reps == null && set.durationSeconds == null);
  const currentSet = sets.length === 0 ? 1 : firstEmptySet === -1 ? sets.length : firstEmptySet + 1;
  useEffect(() => {
    if (!template || !exercise) return;
    const props = {
      title: template.name,
      headline: exercise.name,
      detail: `Exercise ${exerciseIndex + 1} of ${template.exercises.length} · Set ${currentSet} of ${exercise.targetSets}`,
      icon: 'figure.strengthtraining.traditional',
      timerStart: startTime.current,
      ...(restEndsAt ? { restEndsAt } : {}),
    };
    if (hasWorkoutActivity()) updateWorkoutActivity(props);
    else startWorkoutActivity(props);
  }, [template?.id, exercise?.id, exerciseIndex, currentSet, restEndsAt]);

  // A reminder in case the workout is left running, cancelled on the way out
  // (finished or quit) along with the Live Activity.
  useEffect(() => {
    if (!template) return;
    startStrengthWatchdog(template.name, template.durationMinutes);
  }, [template?.id]);
  useEffect(
    () => () => {
      endWorkoutActivity();
      stopStrengthWatchdog();
    },
    []
  );

  const totalSeconds = (template?.durationMinutes ?? 30) * 60;
  const progress = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;

  const message = useMemo(
    () => motivationalMessages[exerciseIndex % motivationalMessages.length],
    [exerciseIndex]
  );

  if (!template || !exercise) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.loading}>Loading exercise...</Text>
      </SafeAreaView>
    );
  }

  const isLastExercise = exerciseIndex === template.exercises.length - 1;

  const updateSet = (setIndex: number, patch: Partial<LoggedSet>) => {
    setSets((prev) => prev.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)));
  };

  const handleNext = async () => {
    const finishedExerciseLog: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      logType: exercise.logType,
      // Weights are typed in the user's unit; storage is always pounds.
      sets: sets.map((set) =>
        set.weight != null ? { ...set, weight: displayToLb(set.weight, units) } : set
      ),
    };
    const nextLogs = [...logs, finishedExerciseLog];

    if (!isLastExercise) {
      setLogs(nextLogs);
      setExerciseIndex((i) => i + 1);
      return;
    }

    if (!user) return;
    setFinishing(true);
    try {
      const result = await completeWorkout(template, nextLogs, elapsedSeconds);
      // Fire-and-forget: Pro + opt-in only, and never blocks finishing.
      syncCompletedWorkoutToHealth(user.uid, isPro, {
        startDate: new Date(startTime.current),
        endDate: new Date(),
      });
      const totals = summarizeExerciseLogs(nextLogs);
      isCompletingRef.current = true;
      router.replace({
        pathname: '/workout/[id]/complete',
        params: {
          id: template.id,
          xpEarned: String(result.xpEarned),
          streakBonus: String(result.streakBonus),
          streakCountAfter: String(result.streakCountAfter),
          badgeEarnedId: result.badgeEarnedId ?? '',
          xpMultiplier: String(result.xpMultiplier ?? 1),
          result: JSON.stringify(result),
          volume: String(totals.volume),
          reps: String(totals.reps),
          sets: String(totals.sets),
          durationSeconds: String(elapsedSeconds),
        },
      });
    } finally {
      setFinishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader onBack={() => router.back()} />
      <View style={styles.progressWrap}>
        <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
        <ProgressBar progress={progress} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.exerciseName}>{exercise.name}</Text>
        <Text style={styles.exerciseMeta}>
          {exercise.targetSets} {exercise.targetSets === 1 ? 'Set' : 'Sets'} ·{' '}
          {exercise.logType === 'duration' ? 'Target: ' : 'Reps: '}
          {exercise.targetRepsLabel}
        </Text>
        {exercise.tips && <Text style={styles.tips}>{exercise.tips}</Text>}
        {last && <Text style={styles.lastTime}>Last time: {formatLastSets(last.sets, units)}</Text>}
        <View style={styles.notesWrap}>
          <WorkoutNotes uid={user?.uid} workoutId={template.id} />
        </View>

        <View style={styles.restRow}>
          {restRemaining != null ? (
            <>
              <Text style={styles.restCountdown}>Rest {formatTime(restRemaining)}</Text>
              <Pressable onPress={() => setRestEndsAt(null)} hitSlop={8}>
                <Text style={styles.restSkip}>Skip</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.restLabel}>Rest timer</Text>
              {REST_OPTIONS.map((sec) => (
                <Pressable
                  key={sec}
                  style={styles.restPill}
                  onPress={() => setRestEndsAt(Date.now() + sec * 1000)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${sec} second rest`}
                >
                  <Text style={styles.restPillText}>{sec < 120 ? `${sec}s` : `${sec / 60}:00`}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>

        <View style={styles.setsHeader}>
          <Text style={styles.setsHeaderLabel}>Set</Text>
          {exercise.logType === 'duration' ? (
            <Text style={styles.setsHeaderLabel}>Seconds</Text>
          ) : (
            <>
              <Text style={styles.setsHeaderLabel}>Reps</Text>
              {exercise.tracksWeight !== false && <Text style={styles.setsHeaderLabel}>Weight</Text>}
            </>
          )}
        </View>

        {sets.map((set, i) => (
          <View key={i} style={styles.setRow}>
            <Text style={styles.setLabel}>Set {i + 1}</Text>
            {exercise.logType === 'duration' ? (
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder={last?.sets[i]?.durationSeconds?.toString() ?? exercise.targetRepsLabel}
                placeholderTextColor={colors.textMuted}
                value={set.durationSeconds?.toString() ?? ''}
                onChangeText={(v) => updateSet(i, { durationSeconds: Number(v) || undefined })}
              />
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder={last?.sets[i]?.reps?.toString() ?? 'reps'}
                  placeholderTextColor={colors.textMuted}
                  value={set.reps?.toString() ?? ''}
                  onChangeText={(v) => updateSet(i, { reps: Number(v) || undefined })}
                />
                {exercise.tracksWeight !== false && (
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder={
                      last?.sets[i]?.weight != null
                        ? String(lbToDisplay(last.sets[i].weight!, units))
                        : weightUnit(units)
                    }
                    placeholderTextColor={colors.textMuted}
                    value={weightText[i] ?? set.weight?.toString() ?? ''}
                    onChangeText={(v) => {
                      const cleaned = v.replace(',', '.');
                      setWeightText((prev) => ({ ...prev, [i]: cleaned }));
                      updateSet(i, { weight: Number(cleaned) || undefined });
                    }}
                  />
                )}
              </>
            )}
          </View>
        ))}

        {exerciseIndex > 0 && <Text style={styles.motivation}>{message}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={isLastExercise ? 'Finish' : 'Next Exercise'}
          onPress={handleNext}
          loading={finishing}
        />
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatLastSets(sets: LoggedSet[], units: UnitSystem) {
  return sets
    .filter((set) => set.reps != null || set.durationSeconds != null)
    .map((set) =>
      set.durationSeconds != null
        ? `${set.durationSeconds}s`
        : set.weight
          ? `${lbToDisplay(set.weight, units)}×${set.reps}`
          : `${set.reps} reps`
    )
    .join(' · ');
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { textAlign: 'center', marginTop: spacing.xl, color: colors.textMuted },
  progressWrap: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  timer: { color: colors.textMuted, marginBottom: spacing.xs },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  exerciseName: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  exerciseMeta: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '600',
    fontSize: typography.sizes.small,
    marginBottom: spacing.sm,
  },
  tips: { textAlign: 'center', color: colors.textMuted, marginBottom: spacing.md },
  lastTime: {
    textAlign: 'center',
    color: colors.text,
    fontWeight: '600',
    fontSize: typography.sizes.small,
    marginBottom: spacing.md,
  },
  notesWrap: { alignItems: 'center', marginBottom: spacing.md },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  restLabel: { color: colors.textMuted, fontSize: typography.sizes.small },
  restPill: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  restPillText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  restCountdown: { color: colors.accentFlame, fontWeight: '800', fontSize: typography.sizes.md },
  restSkip: { color: colors.textMuted, fontWeight: '600', fontSize: typography.sizes.small },
  setsHeader: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.md },
  setsHeaderLabel: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: typography.sizes.small },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  setLabel: { flex: 1, fontWeight: '700', color: colors.primary },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    textAlign: 'center',
    color: colors.text,
  },
  motivation: {
    textAlign: 'center',
    color: colors.accentFlame,
    fontWeight: '800',
    fontSize: typography.sizes.md,
    marginTop: spacing.lg,
  },
  footer: { padding: spacing.lg },
});
