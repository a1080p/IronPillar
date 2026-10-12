import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { appAlert } from '../../../lib/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/ProgressBar';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { ExerciseNotes } from '../../../components/ExerciseNotes';
import { ExerciseCheer } from '../../../components/ExerciseCheer';
import { makeCheer, type Cheer } from '../../../lib/cheers';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { motivationalMessages } from '../../../constants/motivation';
import { useWorkout } from '../../../hooks/useWorkout';
import { useAuth } from '../../../contexts/AuthContext';
import { completeWorkout } from '../../../lib/workoutCompletion';
import { startPendingCompletion } from '../../../lib/pendingCompletion';
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
  const { user, profile } = useAuth();
  const { workout: template } = useWorkout(id, user?.uid);
  const navigation = useNavigation();
  const { isPro } = usePurchases();
  const units = useUnits();
  const { logs: history } = useWorkoutLogs(user?.uid);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  // The order exercises are done in, as indexes into the template. "Skip for
  // now" moves the current one to the back, so `position` is where we are in
  // this queue rather than in the template.
  const [order, setOrder] = useState<number[] | null>(null);
  const [position, setPosition] = useState(0);
  // Finished exercises by id; reassembled in template order at the end.
  const [completed, setCompleted] = useState<Record<string, ExerciseLog>>({});
  // Whatever was typed into a skipped exercise, restored when it comes back.
  const drafts = useRef<Record<string, { sets: LoggedSet[]; weightText: Record<number, string> }>>({});
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [cheer, setCheer] = useState<Cheer | null>(null);
  const [sets, setSets] = useState<LoggedSet[]>([]);
  // Raw text of each weight box, so a half-typed decimal like "22." isn't
  // parsed away mid-typing (kg users need decimals).
  const [weightText, setWeightText] = useState<Record<number, string>>({});

  useEffect(() => {
    if (template && !order) setOrder(template.exercises.map((_, i) => i));
  }, [template?.id]);
  const exerciseIndex = order?.[position] ?? 0;
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
      appAlert('Quit workout?', 'All progress will be lost if you quit now.', [
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
    const draft = drafts.current[exercise.id];
    setSets(draft?.sets ?? Array.from({ length: exercise.targetSets }, () => ({})));
    setWeightText(draft?.weightText ?? {});
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
      detail: `Exercise ${position + 1} of ${template.exercises.length} · Set ${currentSet} of ${exercise.targetSets}`,
      icon: 'figure.strengthtraining.traditional',
      timerStart: startTime.current,
      ...(restEndsAt ? { restEndsAt } : {}),
    };
    if (hasWorkoutActivity()) updateWorkoutActivity(props);
    else startWorkoutActivity(props);
  }, [template?.id, exercise?.id, position, currentSet, restEndsAt]);

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
    () => motivationalMessages[position % motivationalMessages.length],
    [position]
  );

  if (!template || !exercise || !order) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.loading}>Loading exercise...</Text>
      </SafeAreaView>
    );
  }

  const isLastExercise = position === order.length - 1;
  const nextExercise = isLastExercise ? null : template.exercises[order[position + 1]];
  const wasSkipped = skippedIds.includes(exercise.id);
  const filledSets = sets.filter((s) => s.reps != null || s.durationSeconds != null).length;

  const updateSet = (setIndex: number, patch: Partial<LoggedSet>) => {
    setSets((prev) => prev.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)));
  };

  // Machine taken, or just want a different order: send this exercise to the
  // back of the queue, keeping anything already typed, and go to the next.
  const handleSkip = () => {
    if (isLastExercise) return;
    drafts.current[exercise.id] = { sets, weightText };
    setSkippedIds((prev) => (prev.includes(exercise.id) ? prev : [...prev, exercise.id]));
    setRestEndsAt(null);
    setOrder((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const [current] = next.splice(position, 1);
      next.push(current);
      return next;
    });
  };

  const handleNext = () => {
    if (filledSets >= sets.length) {
      advance();
      return;
    }
    appAlert(
      filledSets === 0 ? 'No sets logged yet' : `${filledSets} of ${sets.length} sets logged`,
      isLastExercise
        ? 'Finish the workout anyway?'
        : `Are you sure you want to move on to ${nextExercise?.name ?? 'the next exercise'}?`,
      [
        { text: 'Keep Going', style: 'cancel' },
        ...(!isLastExercise
          ? [{ text: 'Skip for Now, Come Back Later', onPress: handleSkip }]
          : []),
        { text: isLastExercise ? 'Finish Anyway' : 'Move On', onPress: advance },
      ]
    );
  };

  const advance = async () => {
    const finishedExerciseLog: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      logType: exercise.logType,
      // Weights are typed in the user's unit; storage is always pounds.
      sets: sets.map((set) =>
        set.weight != null ? { ...set, weight: displayToLb(set.weight, units) } : set
      ),
    };
    const nextCompleted = { ...completed, [exercise.id]: finishedExerciseLog };
    delete drafts.current[exercise.id];

    if (!isLastExercise) {
      setCompleted(nextCompleted);
      setRestEndsAt(null);
      setPosition((p) => p + 1);
      setCheer(
        makeCheer({
          exercise: exercise.name,
          next: nextExercise?.name,
          goalText: profile?.goalText,
        })
      );
      return;
    }

    const nextLogs = template.exercises
      .map((e) => nextCompleted[e.id])
      .filter((log): log is ExerciseLog => !!log);

    if (!user) return;
    // The summary opens right away; saving (and the XP the server works out)
    // finishes behind it. See lib/pendingCompletion.
    const finishedAt = new Date();
    const pending = startPendingCompletion(async () => {
      const result = await completeWorkout(template, nextLogs, elapsedSeconds);
      // Fire-and-forget: Pro + opt-in only, and never blocks finishing.
      syncCompletedWorkoutToHealth(user.uid, isPro, {
        startDate: new Date(startTime.current),
        endDate: finishedAt,
      });
      return result;
    });
    const totals = summarizeExerciseLogs(nextLogs);
    isCompletingRef.current = true;
    router.replace({
      pathname: '/workout/[id]/complete',
      params: {
        id: template.id,
        pending: String(pending),
        volume: String(totals.volume),
        reps: String(totals.reps),
        sets: String(totals.sets),
        durationSeconds: String(elapsedSeconds),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader onBack={() => router.back()} />
      <View style={styles.progressWrap}>
        <Text style={styles.timer} accessibilityLabel={`Elapsed time ${formatTime(elapsedSeconds)}`}>
          {formatTime(elapsedSeconds)}
        </Text>
        <ProgressBar progress={progress} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        {wasSkipped && (
          <Text style={styles.backTo}>Back to this one. You skipped it earlier.</Text>
        )}
        <Text style={styles.exerciseName} accessibilityRole="header">
          {exercise.name}
        </Text>
        <Text style={styles.exerciseMeta}>
          {exercise.targetSets} {exercise.targetSets === 1 ? 'Set' : 'Sets'} ·{' '}
          {exercise.logType === 'duration' ? 'Target: ' : 'Reps: '}
          {exercise.targetRepsLabel}
        </Text>
        {exercise.tips && <Text style={styles.tips}>{exercise.tips}</Text>}
        {last && <Text style={styles.lastTime}>Last time: {formatLastSets(last.sets, units)}</Text>}
        <View style={styles.notesWrap}>
          <ExerciseNotes uid={user?.uid} exerciseName={exercise.name} />
        </View>

        <View style={styles.restRow}>
          {restRemaining != null ? (
            <>
              <Text style={styles.restCountdown}>Rest {formatTime(restRemaining)}</Text>
              <Pressable
                onPress={() => setRestEndsAt(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Skip rest"
              >
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
                  hitSlop={8}
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

        {last && (
          <Text style={styles.setsHint}>
            Grey numbers are from last time. Type yours to log each set.
          </Text>
        )}

        {sets.map((set, i) => (
          <View key={i} style={styles.setRow}>
            <Text style={styles.setLabel}>Set {i + 1}</Text>
            {exercise.logType === 'duration' ? (
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                accessibilityLabel={`Set ${i + 1} seconds`}
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
                  accessibilityLabel={`Set ${i + 1} reps`}
                  placeholder={last?.sets[i]?.reps?.toString() ?? 'reps'}
                  placeholderTextColor={colors.textMuted}
                  value={set.reps?.toString() ?? ''}
                  onChangeText={(v) => updateSet(i, { reps: Number(v) || undefined })}
                />
                {exercise.tracksWeight !== false && (
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`Set ${i + 1} weight in ${weightUnit(units)}`}
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

        {position > 0 && <Text style={styles.motivation}>{message}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        {nextExercise && (
          <Text style={styles.upNext} numberOfLines={1}>
            Up next: {nextExercise.name}
          </Text>
        )}
        <View style={styles.footerButtons}>
          {!isLastExercise && (
            <Button label="Skip for Now" variant="outline" onPress={handleSkip} />
          )}
          <View style={styles.footerPrimary}>
            <Button
              label={isLastExercise ? 'Finish' : 'Next Exercise'}
              onPress={handleNext}
            />
          </View>
        </View>
      </View>
      </KeyboardAvoidingView>
      <ExerciseCheer cheer={cheer} onDone={() => setCheer(null)} />
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  restPillText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  restCountdown: { color: colors.accentFlameText, fontWeight: '800', fontSize: typography.sizes.md },
  restSkip: { color: colors.textMuted, fontWeight: '600', fontSize: typography.sizes.small },
  setsHeader: { flexDirection: 'row', marginBottom: spacing.sm, gap: spacing.md },
  setsHeaderLabel: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: typography.sizes.small },
  setsHint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    marginBottom: spacing.sm,
  },
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
    color: colors.accentFlameText,
    fontWeight: '800',
    fontSize: typography.sizes.md,
    marginTop: spacing.lg,
  },
  footer: { padding: spacing.lg, gap: spacing.sm },
  footerButtons: { flexDirection: 'row', gap: spacing.sm },
  footerPrimary: { flex: 1 },
  upNext: { textAlign: 'center', color: colors.textMuted, fontSize: typography.sizes.small },
  backTo: {
    textAlign: 'center',
    color: colors.accentFlameText,
    fontWeight: '700',
    fontSize: typography.sizes.small,
    marginBottom: spacing.xs,
  },
});
