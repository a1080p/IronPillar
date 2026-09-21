import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { WorkoutHeader } from '../../components/WorkoutHeader';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { createCustomWorkout } from '../../hooks/useCustomWorkouts';
import { generateWorkoutDetails } from '../../lib/workoutDetails';
import type { ExerciseSpec, GeneratedWorkoutDetails } from '../../types/models';

type LogType = ExerciseSpec['logType'];

export default function NewWorkoutScreen() {
  const { user } = useAuth();
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState<ExerciseSpec[]>([]);

  const [exerciseName, setExerciseName] = useState('');
  const [logType, setLogType] = useState<LogType>('reps_weight');
  const [sets, setSets] = useState('3');
  const [targetLabel, setTargetLabel] = useState('');

  const [saving, setSaving] = useState(false);
  const [savingStatus, setSavingStatus] = useState('');

  const handleAddExercise = () => {
    const setsNum = Number(sets);
    if (!exerciseName.trim() || !targetLabel.trim() || !setsNum || setsNum < 1) {
      Alert.alert('Missing info', 'Give the exercise a name, set count, and a target (reps or time).');
      return;
    }
    setExercises((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${prev.length}`,
        name: exerciseName.trim(),
        logType,
        targetSets: setsNum,
        targetRepsLabel: targetLabel.trim(),
      },
    ]);
    setExerciseName('');
    setSets('3');
    setTargetLabel('');
    setLogType('reps_weight');
  };

  const handleRemoveExercise = (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!workoutName.trim()) {
      Alert.alert('Name your workout', 'Give your workout a name before saving.');
      return;
    }
    if (exercises.length === 0) {
      Alert.alert('Add an exercise', 'Add at least one exercise before saving.');
      return;
    }
    setSaving(true);

    // Let AI fill in the overview / time / calories / equipment / tips. This is
    // best-effort — if it fails, the workout still saves without those extras
    // and the detail screen surfaces a "couldn't generate" note.
    setSavingStatus('Generating workout details with AI...');
    let details: GeneratedWorkoutDetails | null = null;
    try {
      details = await generateWorkoutDetails(workoutName.trim(), exercises);
    } catch (e) {
      console.warn('generateWorkoutDetails failed', e);
    }

    setSavingStatus('Saving...');
    try {
      const id = await createCustomWorkout(user.uid, workoutName.trim(), exercises, details);
      router.replace(`/workout/${id}?generated=${details ? '1' : 'failed'}`);
    } catch (e) {
      Alert.alert('Could not save workout', e instanceof Error ? e.message : 'Try again.');
      setSaving(false);
      setSavingStatus('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Create Your Own Workout</Text>

        <TextInput
          style={styles.nameInput}
          placeholder="Workout name"
          placeholderTextColor={colors.textMuted}
          value={workoutName}
          onChangeText={setWorkoutName}
        />

        <Text style={styles.aiNote}>
          Just add the exercises — when you save, AI fills in the overview, time, calorie
          estimate, equipment, and coaching tips. You can edit them afterward.
        </Text>

        {exercises.map((ex, i) => (
          <View key={ex.id} style={styles.exerciseRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.exerciseName}>
                {i + 1}: {ex.name}
              </Text>
              <Text style={styles.exerciseDetail}>
                {ex.targetSets} sets · {ex.targetRepsLabel}
                {ex.logType === 'duration' ? ' (timed)' : ''}
              </Text>
            </View>
            <Pressable onPress={() => handleRemoveExercise(ex.id)} hitSlop={12}>
              <Ionicons name="close-circle" size={24} color={colors.textMuted} />
            </Pressable>
          </View>
        ))}

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Add an Exercise</Text>
          <TextInput
            style={styles.input}
            placeholder="Exercise name"
            placeholderTextColor={colors.textMuted}
            value={exerciseName}
            onChangeText={setExerciseName}
          />

          <View style={styles.typeRow}>
            <Pressable
              style={[styles.typeOption, logType === 'reps_weight' && styles.typeOptionActive]}
              onPress={() => setLogType('reps_weight')}
            >
              <Text
                style={[styles.typeLabel, logType === 'reps_weight' && styles.typeLabelActive]}
              >
                Reps & Weight
              </Text>
            </Pressable>
            <Pressable
              style={[styles.typeOption, logType === 'duration' && styles.typeOptionActive]}
              onPress={() => setLogType('duration')}
            >
              <Text style={[styles.typeLabel, logType === 'duration' && styles.typeLabelActive]}>
                Timed
              </Text>
            </Pressable>
          </View>

          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Sets"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={sets}
              onChangeText={setSets}
            />
            <TextInput
              style={[styles.input, { flex: 2 }]}
              placeholder={logType === 'duration' ? 'e.g. 45 sec' : 'e.g. 8-10 reps'}
              placeholderTextColor={colors.textMuted}
              value={targetLabel}
              onChangeText={setTargetLabel}
            />
          </View>

          <Button label="Add Exercise" variant="outline" onPress={handleAddExercise} />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {saving && savingStatus ? <Text style={styles.savingStatus}>{savingStatus}</Text> : null}
        <Button label="Save Workout" onPress={handleSave} loading={saving} />
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  nameInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  aiNote: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  savingStatus: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  exerciseName: { fontWeight: '700', color: colors.primary, marginBottom: 2 },
  exerciseDetail: { color: colors.textMuted, fontSize: typography.sizes.small },
  addCard: {
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  addTitle: { fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
    marginBottom: spacing.md,
  },
  typeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  typeOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  typeOptionActive: { backgroundColor: colors.primary },
  typeLabel: { color: colors.primary, fontWeight: '600', fontSize: typography.sizes.small },
  typeLabelActive: { color: colors.textOnDark },
  row: { flexDirection: 'row', gap: spacing.md },
  footer: { padding: spacing.lg },
});
