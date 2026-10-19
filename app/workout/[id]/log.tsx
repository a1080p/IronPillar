import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { appAlert } from '../../../lib/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/ProgressBar';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { ExerciseNotes } from '../../../components/ExerciseNotes';
import { ExerciseCheer } from '../../../components/ExerciseCheer';
import { ExerciseFormPhotos } from '../../../components/ExerciseForm';
import { SwapExerciseSheet } from '../../../components/SwapExerciseSheet';
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
import {
  clearWorkoutDraft,
  loadWorkoutDraft,
  saveWorkoutDraft,
  type ExerciseWork,
  type WorkoutDraft,
} from '../../../lib/workoutDraft';
import { catalogExerciseById, findCatalogExercise } from '../../../data/exercises';
import { useUnits } from '../../../hooks/useUnits';
import type { UnitSystem } from '../../../types/models';
import { useWorkoutLogs } from '../../../hooks/useWorkoutLogs';
import { usePurchases } from '../../../contexts/PurchasesContext';
import { syncCompletedWorkoutToHealth } from '../../../hooks/useAppleHealth';
import type { ExerciseLog, ExerciseSpec, LoggedSet } from '../../../types/models';

const REST_OPTIONS = [60, 90, 120];
// Rest that starts by itself when a set is checked off, until another length
// is picked from the rest pills.
const DEFAULT_REST_SECONDS = 90;

function freshWork(setCount: number): ExerciseWork {
  return {
    sets: Array.from({ length: setCount }, () => ({})),
    weightText: {},
    done: Array.from({ length: setCount }, () => false),
  };
}

function isFilled(set: LoggedSet | undefined) {
  return !!set && (set.reps != null || set.durationSeconds != null);
}

// A swapped slot keeps its sets and target but takes the catalog exercise's
// name (which is what its history is kept under) and way of logging weight.
function applySwap(spec: ExerciseSpec, catalogId: string | undefined): ExerciseSpec {
  const swap = catalogExerciseById(catalogId);
  if (!swap) return spec;
  return {
    ...spec,
    name: swap.name,
    catalogId: swap.id,
    tracksWeight: swap.tracksWeight,
    tips: undefined,
  };
}

// The first number in a target like "8-10 reps" (8) or "30-45 second hold"
// (30); minutes become seconds. Used to suggest a set when there's no history.
function targetFromLabel(label: string): number | undefined {
  const match = label.match(/\d+/);
  if (!match) return undefined;
  const n = Number(match[0]);
  return /min/i.test(label) && !/sec/i.test(label) ? n * 60 : n;
}

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
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);

  // The order exercises are done in, as indexes into the template. "Skip for
  // now" moves the current one to the back, so `position` is where we are in
  // this queue rather than in the template.
  const [order, setOrder] = useState<number[] | null>(null);
  const [position, setPosition] = useState(0);
  // Finished exercises by id; reassembled in template order at the end.
  const [completed, setCompleted] = useState<Record<string, ExerciseLog>>({});
  // What's typed for each exercise, by id, so a skipped one keeps its sets.
  const [work, setWork] = useState<Record<string, ExerciseWork>>({});
  // Exercises swapped for another from the catalog: template id -> catalog id.
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [swapOpen, setSwapOpen] = useState(false);
  const [cheer, setCheer] = useState<Cheer | null>(null);
  // Nothing is saved as a draft until any earlier draft has been resumed or
  // set aside, so opening the screen can't overwrite it.
  const [draftChecked, setDraftChecked] = useState(false);

  useEffect(() => {
    if (template && !order) setOrder(template.exercises.map((_, i) => i));
  }, [template?.id]);
  const exercises = useMemo(
    () => template?.exercises.map((e) => applySwap(e, swaps[e.id])) ?? [],
    [template, swaps]
  );
  const exerciseIndex = order?.[position] ?? 0;
  // Time in the logger. Restored (not counting time away) when a draft is
  // resumed.
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
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const applyDraft = (draft: WorkoutDraft) => {
    setOrder(draft.order);
    setPosition(draft.position);
    setCompleted(draft.completed);
    setWork(draft.work);
    setSwaps(draft.swaps);
    setSkippedIds(draft.skippedIds);
    setRestSeconds(draft.restSeconds || DEFAULT_REST_SECONDS);
    startTime.current = Date.now() - draft.elapsedSeconds * 1000;
    setElapsedSeconds(draft.elapsedSeconds);
  };

  // Offer to pick up an unfinished session of this workout, or warn that one
  // of a different workout will be replaced.
  useEffect(() => {
    if (!template || !user || draftChecked) return;
    let cancelled = false;
    loadWorkoutDraft(user.uid).then((draft) => {
      if (cancelled) return;
      if (!draft) {
        setDraftChecked(true);
        return;
      }
      if (draft.workoutId !== template.id) {
        appAlert(
          `Finish ${draft.workoutName} first?`,
          `You have an unfinished ${draft.workoutName}. Starting this workout replaces it.`,
          [
            {
              text: `Resume ${draft.workoutName}`,
              onPress: () => {
                isCompletingRef.current = true; // leave without the quit prompt
                router.replace(`/workout/${draft.workoutId}/log`);
              },
            },
            { text: 'Start This One', onPress: () => setDraftChecked(true) },
          ]
        );
        return;
      }
      // The workout changed since (exercises added or removed): start fresh.
      if (draft.order.length !== template.exercises.length) {
        clearWorkoutDraft(user.uid);
        setDraftChecked(true);
        return;
      }
      const setsDone =
        Object.values(draft.completed).reduce((n, e) => n + e.sets.filter(isFilled).length, 0) +
        Object.entries(draft.work)
          .filter(([exId]) => !draft.completed[exId])
          .reduce((n, [, w]) => n + w.sets.filter(isFilled).length, 0);
      appAlert(
        'Pick up where you left off?',
        `You logged ${setsDone} ${setsDone === 1 ? 'set' : 'sets'} of this workout earlier.`,
        [
          {
            text: 'Start Over',
            style: 'destructive',
            onPress: () => {
              clearWorkoutDraft(user.uid);
              setDraftChecked(true);
            },
          },
          {
            text: 'Resume',
            onPress: () => {
              applyDraft(draft);
              setDraftChecked(true);
            },
          },
        ]
      );
    });
    return () => {
      cancelled = true;
    };
  }, [template?.id, user?.uid]);

  const hasProgress =
    position > 0 ||
    Object.keys(completed).length > 0 ||
    Object.keys(swaps).length > 0 ||
    Object.values(work).some((w) => w.sets.some(isFilled));

  const snapshot = (): Omit<WorkoutDraft, 'version' | 'savedAt'> | null =>
    template && order
      ? {
          workoutId: template.id,
          workoutName: template.name,
          elapsedSeconds: Math.floor((Date.now() - startTime.current) / 1000),
          order,
          position,
          completed,
          work,
          swaps,
          skippedIds,
          restSeconds,
        }
      : null;

  // The quit prompt and app-background save are registered once, so they
  // read the latest state through this ref.
  const latest = useRef({ hasProgress, snapshot, draftChecked });
  latest.current = { hasProgress, snapshot, draftChecked };
  const saveNow = async () => {
    const snap = latest.current.snapshot();
    if (user && snap && latest.current.draftChecked && !isCompletingRef.current) {
      await saveWorkoutDraft(user.uid, snap);
    }
  };

  useEffect(() => {
    if (!user || !draftChecked || !hasProgress || isCompletingRef.current) return;
    const timer = setTimeout(saveNow, 400);
    return () => clearTimeout(timer);
  }, [order, position, completed, work, swaps, skippedIds, restSeconds, draftChecked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && latest.current.hasProgress) saveNow();
    });
    return () => sub.remove();
  }, [user?.uid]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isCompletingRef.current || !latest.current.hasProgress) return;
      e.preventDefault();
      appAlert(
        'Leave this workout?',
        'Save it and your sets stay on this phone for 12 hours. Open the workout again to pick up where you left off.',
        [
          { text: 'Keep Going', style: 'cancel' },
          {
            text: 'Discard Workout',
            style: 'destructive',
            onPress: async () => {
              isCompletingRef.current = true;
              if (user) await clearWorkoutDraft(user.uid);
              navigation.dispatch(e.data.action);
            },
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              await saveNow();
              isCompletingRef.current = true;
              navigation.dispatch(e.data.action);
            },
          },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, user?.uid]);

  const exercise = exercises[exerciseIndex];
  const catalogExercise = exercise ? findCatalogExercise(exercise) : undefined;
  const current: ExerciseWork =
    (exercise && work[exercise.id]) || freshWork(exercise?.targetSets ?? 0);
  const sets = current.sets;
  // Free: what you did for this exercise last time, shown as a hint and used
  // to suggest each set so matching or beating it is one tap away.
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

  // Lock-screen Live Activity: the workout timer, the current exercise and
  // set, and the rest countdown. The set shown is the first one not filled in.
  const firstEmptySet = sets.findIndex((set) => !isFilled(set));
  const currentSet = sets.length === 0 ? 1 : firstEmptySet === -1 ? sets.length : firstEmptySet + 1;
  useEffect(() => {
    if (!template || !exercise) return;
    const props = {
      title: template.name,
      headline: exercise.name,
      detail: `Exercise ${position + 1} of ${exercises.length} · Set ${currentSet} of ${sets.length}`,
      icon: 'figure.strengthtraining.traditional',
      timerStart: startTime.current,
      ...(restEndsAt ? { restEndsAt } : {}),
    };
    if (hasWorkoutActivity()) updateWorkoutActivity(props);
    else startWorkoutActivity(props);
  }, [template?.id, exercise?.id, exercise?.name, position, currentSet, sets.length, restEndsAt, draftChecked]);

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

  // Progress is sets logged out of sets planned, not time: a slow, careful
  // session isn't "behind".
  const setProgress = exercises.reduce(
    (acc, e) => {
      const list = completed[e.id]?.sets ?? work[e.id]?.sets;
      acc.total += list ? list.length : e.targetSets;
      acc.done += list ? list.filter(isFilled).length : 0;
      return acc;
    },
    { done: 0, total: 0 }
  );
  const progress = setProgress.total > 0 ? setProgress.done / setProgress.total : 0;

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
  const nextExercise = isLastExercise ? null : exercises[order[position + 1]];
  const wasSkipped = skippedIds.includes(exercise.id);
  const filledSets = sets.filter(isFilled).length;
  const tracksWeight = exercise.logType === 'reps_weight' && exercise.tracksWeight !== false;

  const updateWork = (fn: (w: ExerciseWork) => ExerciseWork) => {
    setWork((prev) => ({
      ...prev,
      [exercise.id]: fn(prev[exercise.id] ?? freshWork(exercise.targetSets)),
    }));
  };

  const updateSet = (setIndex: number, patch: Partial<LoggedSet>) => {
    updateWork((w) => {
      const nextSets = w.sets.map((s, i) => (i === setIndex ? { ...s, ...patch } : s));
      return {
        ...w,
        sets: nextSets,
        // Clearing a checked set's numbers un-checks it.
        done: w.done.map((d, i) => (i === setIndex ? d && isFilled(nextSets[i]) : d)),
      };
    });
  };

  // What each set is likely to be: last time's numbers for that set, else
  // this session's previous set, else the target. Weight carries down from the
  // set above, since most people keep it the same across sets.
  const suggestion = (i: number): LoggedSet => {
    const prev = i > 0 ? sets[i - 1] : undefined;
    const lastSet = last ? (last.sets[i] ?? last.sets[last.sets.length - 1]) : undefined;
    const target = targetFromLabel(exercise.targetRepsLabel);
    if (exercise.logType === 'duration') {
      return { durationSeconds: lastSet?.durationSeconds ?? prev?.durationSeconds ?? target };
    }
    const lastWeight = lastSet?.weight != null ? lbToDisplay(lastSet.weight, units) : undefined;
    return {
      reps: lastSet?.reps ?? prev?.reps ?? target,
      weight: tracksWeight ? (prev?.weight ?? lastWeight) : undefined,
    };
  };

  // Check off a set: anything left blank takes the suggested number, and the
  // rest timer starts.
  const toggleDone = (i: number) => {
    if (current.done[i]) {
      updateWork((w) => ({ ...w, done: w.done.map((d, j) => (j === i ? false : d)) }));
      return;
    }
    const set = sets[i];
    const suggested = suggestion(i);
    const filled: LoggedSet =
      exercise.logType === 'duration'
        ? { ...set, durationSeconds: set.durationSeconds ?? suggested.durationSeconds }
        : { ...set, reps: set.reps ?? suggested.reps, weight: set.weight ?? suggested.weight };
    if (!isFilled(filled)) {
      appAlert(exercise.logType === 'duration' ? 'Enter the seconds first' : 'Enter your reps first');
      return;
    }
    updateWork((w) => ({
      sets: w.sets.map((s, j) => (j === i ? filled : s)),
      weightText:
        filled.weight != null ? { ...w.weightText, [i]: String(filled.weight) } : w.weightText,
      done: w.done.map((d, j) => (j === i ? true : d)),
    }));
    const othersDone = current.done.filter((d, j) => d && j !== i).length;
    const finishesWorkout = isLastExercise && othersDone + 1 >= sets.length;
    if (!finishesWorkout) setRestEndsAt(Date.now() + restSeconds * 1000);
  };

  const addSet = () =>
    updateWork((w) => ({ ...w, sets: [...w.sets, {}], done: [...w.done, false] }));

  const removeSet = () => {
    if (sets.length <= 1) return;
    updateWork((w) => {
      const lastIndex = w.sets.length - 1;
      const weightText = { ...w.weightText };
      delete weightText[lastIndex];
      return { sets: w.sets.slice(0, -1), weightText, done: w.done.slice(0, -1) };
    });
  };

  const swapTo = (catalogId: string | null) => {
    setSwaps((prev) => {
      const next = { ...prev };
      if (catalogId) next[exercise.id] = catalogId;
      else delete next[exercise.id];
      return next;
    });
    // Numbers typed for the old exercise don't apply to the new one.
    setWork((prev) => ({ ...prev, [exercise.id]: freshWork(sets.length) }));
    setRestEndsAt(null);
  };

  // Machine taken, or just want a different order: send this exercise to the
  // back of the queue, keeping anything already typed, and go to the next.
  const handleSkip = () => {
    if (isLastExercise) return;
    setSkippedIds((prev) => (prev.includes(exercise.id) ? prev : [...prev, exercise.id]));
    setRestEndsAt(null);
    setOrder((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const [moved] = next.splice(position, 1);
      next.push(moved);
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

    const nextLogs = exercises
      .map((e) => nextCompleted[e.id])
      .filter((log): log is ExerciseLog => !!log);

    if (!user) return;
    isCompletingRef.current = true;
    clearWorkoutDraft(user.uid);
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
        <View style={styles.progressLabels}>
          <Text style={styles.timer} accessibilityLabel={`Elapsed time ${formatTime(elapsedSeconds)}`}>
            {formatTime(elapsedSeconds)}
          </Text>
          <Text style={styles.timer}>
            {setProgress.done} of {setProgress.total} sets
          </Text>
        </View>
        <ProgressBar progress={progress} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {wasSkipped && (
          <Text style={styles.backTo}>Back to this one. You skipped it earlier.</Text>
        )}
        <Text style={styles.exerciseName} accessibilityRole="header">
          {exercise.name}
        </Text>
        <Text style={styles.exerciseMeta}>
          {exercise.logType === 'duration' ? 'Target: ' : 'Reps: '}
          {exercise.targetRepsLabel}
        </Text>
        <View style={styles.chipRow}>
          <Pressable
            style={styles.chip}
            onPress={() => setSwapOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Swap ${exercise.name} for another exercise`}
          >
            <Ionicons name="swap-horizontal" size={14} color={colors.primary} />
            <Text style={styles.chipText}>{swaps[exercise.id] ? 'Swapped' : 'Swap'}</Text>
          </Pressable>
        </View>
        <View style={styles.formWrap}>
          <ExerciseFormPhotos exercise={catalogExercise} height={150} />
        </View>
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
              <Text style={styles.restLabel}>Rest</Text>
              {REST_OPTIONS.map((sec) => (
                <Pressable
                  key={sec}
                  style={[styles.restPill, sec === restSeconds && styles.restPillActive]}
                  hitSlop={8}
                  onPress={() => {
                    setRestSeconds(sec);
                    setRestEndsAt(Date.now() + sec * 1000);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Start ${sec} second rest`}
                  accessibilityState={{ selected: sec === restSeconds }}
                >
                  <Text style={[styles.restPillText, sec === restSeconds && styles.restPillTextActive]}>
                    {sec < 120 ? `${sec}s` : `${sec / 60}:00`}
                  </Text>
                </Pressable>
              ))}
            </>
          )}
        </View>

        <View style={styles.setsHeader}>
          <Text style={[styles.setsHeaderLabel, styles.setCol]}>Set</Text>
          {exercise.logType === 'duration' ? (
            <Text style={styles.setsHeaderLabel}>Seconds</Text>
          ) : (
            <>
              <Text style={styles.setsHeaderLabel}>Reps</Text>
              {tracksWeight && <Text style={styles.setsHeaderLabel}>{weightUnit(units)}</Text>}
            </>
          )}
          <View style={styles.checkCol} />
        </View>

        {sets.map((set, i) => {
          const suggested = suggestion(i);
          const done = !!current.done[i];
          return (
            <View key={i} style={[styles.setRow, done && styles.setRowDone]}>
              <Text style={[styles.setLabel, styles.setCol]}>{i + 1}</Text>
              {exercise.logType === 'duration' ? (
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  accessibilityLabel={`Set ${i + 1} seconds`}
                  placeholder={suggested.durationSeconds?.toString() ?? 'sec'}
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
                    placeholder={suggested.reps?.toString() ?? 'reps'}
                    placeholderTextColor={colors.textMuted}
                    value={set.reps?.toString() ?? ''}
                    onChangeText={(v) => updateSet(i, { reps: Number(v) || undefined })}
                  />
                  {tracksWeight && (
                    <TextInput
                      style={styles.input}
                      keyboardType="decimal-pad"
                      accessibilityLabel={`Set ${i + 1} weight in ${weightUnit(units)}`}
                      placeholder={suggested.weight?.toString() ?? weightUnit(units)}
                      placeholderTextColor={colors.textMuted}
                      value={current.weightText[i] ?? set.weight?.toString() ?? ''}
                      onChangeText={(v) => {
                        // Raw text is kept so a half-typed decimal like "22."
                        // isn't parsed away mid-typing (kg users need decimals).
                        const cleaned = v.replace(',', '.');
                        updateWork((w) => ({ ...w, weightText: { ...w.weightText, [i]: cleaned } }));
                        updateSet(i, { weight: Number(cleaned) || undefined });
                      }}
                    />
                  )}
                </>
              )}
              <Pressable
                style={styles.checkCol}
                onPress={() => toggleDone(i)}
                hitSlop={8}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                accessibilityLabel={`Set ${i + 1} done`}
                accessibilityHint={done ? undefined : 'Fills in any blank numbers and starts the rest timer'}
              >
                <Ionicons
                  name={done ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={30}
                  color={done ? colors.primary : colors.textMuted}
                />
              </Pressable>
            </View>
          );
        })}

        <View style={styles.setActions}>
          <Pressable onPress={addSet} hitSlop={8} accessibilityRole="button" style={styles.setAction}>
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.setActionText}>Add Set</Text>
          </Pressable>
          {sets.length > 1 && (
            <Pressable onPress={removeSet} hitSlop={8} accessibilityRole="button" style={styles.setAction}>
              <Ionicons name="remove" size={16} color={colors.textMuted} />
              <Text style={[styles.setActionText, styles.setActionMuted]}>Remove Set</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.setsHint}>
          Grey numbers are suggestions{last ? ' from last time' : ''}. Tap ✓ to log them, or type your own.
        </Text>

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
      <SwapExerciseSheet
        visible={swapOpen}
        current={exercise}
        currentCatalog={catalogExercise}
        canRestore={!!swaps[exercise.id]}
        onPick={(picked) => swapTo(picked.id)}
        onRestore={() => swapTo(null)}
        onClose={() => setSwapOpen(false)}
      />
    </SafeAreaView>
  );
}

function formatLastSets(sets: LoggedSet[], units: UnitSystem) {
  return sets
    .filter(isFilled)
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
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
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
  chipRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  formWrap: { marginBottom: spacing.md },
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
  restPillActive: { backgroundColor: colors.primary },
  restPillText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  restPillTextActive: { color: colors.textOnDark },
  restCountdown: { color: colors.accentFlameText, fontWeight: '800', fontSize: typography.sizes.md },
  restSkip: { color: colors.textMuted, fontWeight: '600', fontSize: typography.sizes.small },
  setsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.md },
  setsHeaderLabel: { flex: 1, textAlign: 'center', color: colors.textMuted, fontSize: typography.sizes.small },
  setCol: { flex: 0, width: 28 },
  checkCol: { width: 34, alignItems: 'center' },
  setsHint: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    marginTop: spacing.sm,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  setRowDone: { opacity: 0.75 },
  setLabel: { fontWeight: '700', color: colors.primary, textAlign: 'center' },
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
  setActions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.xs },
  setAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  setActionText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  setActionMuted: { color: colors.textMuted },
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
