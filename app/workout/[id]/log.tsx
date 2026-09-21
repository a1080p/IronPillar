import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { ProgressBar } from '../../../components/ProgressBar';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { colors, radii, spacing, typography } from '../../../constants/theme';
import { motivationalMessages } from '../../../constants/motivation';
import { useWorkout } from '../../../hooks/useWorkout';
import { useAuth } from '../../../contexts/AuthContext';
import { completeWorkout } from '../../../lib/workoutCompletion';
import { summarizeExerciseLogs } from '../../../lib/workoutStats';
import type { ExerciseLog, LoggedSet } from '../../../types/models';

export default function WorkoutLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { workout: template } = useWorkout(id, user?.uid);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [sets, setSets] = useState<LoggedSet[]>([]);
  const [finishing, setFinishing] = useState(false);
  const startTime = useRef(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const exercise = template?.exercises[exerciseIndex];

  useEffect(() => {
    if (!exercise) return;
    setSets(Array.from({ length: exercise.targetSets }, () => ({})));
  }, [exercise?.id]);

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
      sets,
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
      const totals = summarizeExerciseLogs(nextLogs);
      router.replace({
        pathname: '/workout/[id]/complete',
        params: {
          id: template.id,
          xpEarned: String(result.xpEarned),
          streakBonus: String(result.streakBonus),
          streakCountAfter: String(result.streakCountAfter),
          badgeEarnedId: result.badgeEarnedId ?? '',
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
        {exercise.tips && <Text style={styles.tips}>{exercise.tips}</Text>}

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
                placeholder={exercise.targetRepsLabel}
                placeholderTextColor={colors.textMuted}
                value={set.durationSeconds?.toString() ?? ''}
                onChangeText={(v) => updateSet(i, { durationSeconds: Number(v) || undefined })}
              />
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="reps"
                  placeholderTextColor={colors.textMuted}
                  value={set.reps?.toString() ?? ''}
                  onChangeText={(v) => updateSet(i, { reps: Number(v) || undefined })}
                />
                {exercise.tracksWeight !== false && (
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="lbs"
                    placeholderTextColor={colors.textMuted}
                    value={set.weight?.toString() ?? ''}
                    onChangeText={(v) => updateSet(i, { weight: Number(v) || undefined })}
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

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
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
  tips: { textAlign: 'center', color: colors.textMuted, marginBottom: spacing.lg },
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
