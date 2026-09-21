import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { colors, radii, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { updateCustomWorkout } from '../../../hooks/useCustomWorkouts';
import { useWorkout } from '../../../hooks/useWorkout';
import type { InfoSection } from '../../../types/models';

interface DraftSection {
  heading: string;
  bulletsText: string; // one bullet per line
}

function toDraft(sections: InfoSection[]): DraftSection[] {
  return sections.map((s) => ({ heading: s.heading, bulletsText: s.bullets.join('\n') }));
}

function fromDraft(drafts: DraftSection[]): InfoSection[] {
  return drafts
    .map((d) => ({
      heading: d.heading.trim(),
      bullets: d.bulletsText
        .split('\n')
        .map((b) => b.trim())
        .filter(Boolean),
    }))
    .filter((s) => s.heading && s.bullets.length > 0);
}

export default function EditWorkoutDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { workout, loading } = useWorkout(id, user?.uid);

  const editable = !!workout && workout.category === 'custom' && workout.createdBy === user?.uid;

  const initial = useMemo(
    () => ({
      name: workout?.name ?? '',
      duration: workout ? String(workout.durationMinutes) : '',
      calories: workout?.caloriesRangeLabel ?? '',
      equipmentRequired: workout?.equipmentRequired ?? false,
      overview: workout?.overview ?? '',
      tips: toDraft(workout?.workoutTips ?? []),
      equipment: toDraft(workout?.equipment ?? []),
    }),
    // Only seed once the workout first loads.
    [workout?.id, loading] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [name, setName] = useState(initial.name);
  const [duration, setDuration] = useState(initial.duration);
  const [calories, setCalories] = useState(initial.calories);
  const [equipmentRequired, setEquipmentRequired] = useState(initial.equipmentRequired);
  const [overview, setOverview] = useState(initial.overview);
  const [tips, setTips] = useState<DraftSection[]>(initial.tips);
  const [equipment, setEquipment] = useState<DraftSection[]>(initial.equipment);
  const [saving, setSaving] = useState(false);
  const [seededFor, setSeededFor] = useState<string | undefined>(undefined);

  // Seed local state once, when the workout arrives from the snapshot listener.
  if (workout && seededFor !== workout.id) {
    setSeededFor(workout.id);
    setName(initial.name);
    setDuration(initial.duration);
    setCalories(initial.calories);
    setEquipmentRequired(initial.equipmentRequired);
    setOverview(initial.overview);
    setTips(initial.tips);
    setEquipment(initial.equipment);
  }

  const updateSection = (
    list: DraftSection[],
    setList: (v: DraftSection[]) => void,
    index: number,
    patch: Partial<DraftSection>
  ) => {
    setList(list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const handleSave = async () => {
    if (!user || !workout) return;
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the workout a name.');
      return;
    }
    const durationNum = Number(duration);
    if (!durationNum || durationNum < 1) {
      Alert.alert('Time required', 'Enter the workout length in minutes.');
      return;
    }
    setSaving(true);
    try {
      await updateCustomWorkout(user.uid, workout.id, {
        name: name.trim(),
        durationMinutes: Math.round(durationNum),
        caloriesRangeLabel: calories.trim() || 'Varies',
        equipmentRequired,
        overview: overview.trim(),
        workoutTips: fromDraft(tips),
        equipment: fromDraft(equipment),
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.note}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!editable) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.note}>You can only edit workouts you created.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Edit Details</Text>

        <Field label="Workout name">
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </Field>

        <View style={styles.row}>
          <Field label="Time (minutes)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              keyboardType="number-pad"
            />
          </Field>
          <Field label="Calories" style={{ flex: 2 }}>
            <TextInput
              style={styles.input}
              value={calories}
              onChangeText={setCalories}
              placeholder="e.g. 320-450 Calories"
              placeholderTextColor={colors.textMuted}
            />
          </Field>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Equipment required</Text>
          <Switch value={equipmentRequired} onValueChange={setEquipmentRequired} />
        </View>

        <Field label="Overview">
          <TextInput
            style={[styles.input, styles.multiline]}
            value={overview}
            onChangeText={setOverview}
            multiline
            placeholder="What this session targets and how it should feel"
            placeholderTextColor={colors.textMuted}
          />
        </Field>

        <SectionEditor
          title="Workout Tips"
          sections={tips}
          onChange={(i, patch) => updateSection(tips, setTips, i, patch)}
        />
        <SectionEditor
          title="Equipment"
          sections={equipment}
          onChange={(i, patch) => updateSection(equipment, setEquipment, i, patch)}
        />

        <Text style={styles.hint}>
          One bullet per line. Empty sections are dropped when you save. To rebuild these from
          scratch, create a new workout.
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Save Changes" onPress={handleSave} loading={saving} />
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function SectionEditor({
  title,
  sections,
  onChange,
}: {
  title: string;
  sections: DraftSection[];
  onChange: (index: number, patch: Partial<DraftSection>) => void;
}) {
  return (
    <View style={styles.sectionEditor}>
      <Text style={styles.sectionEditorTitle}>{title}</Text>
      {sections.length === 0 && <Text style={styles.hint}>Nothing here yet.</Text>}
      {sections.map((s, i) => (
        <View key={i} style={styles.sectionCard}>
          <TextInput
            style={[styles.input, styles.sectionHeading]}
            value={s.heading}
            onChangeText={(v) => onChange(i, { heading: v })}
            placeholder="Section heading"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={s.bulletsText}
            onChangeText={(v) => onChange(i, { bulletsText: v })}
            multiline
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  note: { textAlign: 'center', marginTop: spacing.xl, color: colors.textMuted },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  field: { marginBottom: spacing.md },
  label: { fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: spacing.md },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionEditor: { marginTop: spacing.md },
  sectionEditorTitle: {
    fontWeight: '700',
    color: colors.primary,
    fontSize: typography.sizes.md,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  sectionHeading: { fontWeight: '700', color: colors.primary },
  hint: { color: colors.textMuted, fontSize: typography.sizes.small, lineHeight: 18 },
  footer: { padding: spacing.lg },
});
