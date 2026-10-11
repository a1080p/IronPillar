import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { ProBadge, ProLockCard } from '../components/ProLock';
import { containsBlockedTerm } from '../constants/moderation';
import { todayDateString } from '../constants/gamification';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { usePurchases } from '../contexts/PurchasesContext';
import { useFoodLog } from '../hooks/useFoodLog';
import { useProgressMetrics } from '../hooks/useProgressMetrics';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';
import {
  MAX_CALORIE_GOAL,
  MAX_ENTRY_CALORIES,
  MEALS,
  MIN_CALORIE_GOAL,
  estimatedCalorieGoal,
  workoutCaloriesBurned,
} from '../lib/calories';
import type { Meal } from '../types/models';

function shiftDay(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return todayDateString(new Date(y, m - 1, d + days));
}

function dayLabel(date: string) {
  const today = todayDateString();
  if (date === today) return 'Today';
  if (date === shiftDay(today, -1)) return 'Yesterday';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function defaultMeal(): Meal {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export default function CaloriesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile, updateProfile } = useAuth();
  const { isPro } = usePurchases();
  const [date, setDate] = useState(todayDateString());
  const { entries, addEntry, deleteEntry } = useFoodLog(isPro ? user?.uid : undefined, date);
  const { metrics } = useProgressMetrics(user?.uid);
  const { logs } = useWorkoutLogs(user?.uid);

  const [meal, setMeal] = useState<Meal>(defaultMeal);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState('');

  const weightLb = metrics.at(-1)?.weightLb ?? profile?.startingWeightLb ?? 165;
  const estimatedGoal = profile ? estimatedCalorieGoal(profile, weightLb) : 2000;
  const goal = profile?.calorieGoal ?? estimatedGoal;

  const burned = useMemo(
    () =>
      logs
        .filter((l) => todayDateString(new Date(l.completedAt)) === date)
        .reduce((sum, l) => sum + workoutCaloriesBurned(l, weightLb), 0),
    [logs, date, weightLb]
  );
  const eaten = entries.reduce((sum, e) => sum + e.calories, 0);
  const proteinTotal = entries.reduce((sum, e) => sum + (e.proteinG ?? 0), 0);
  const budget = goal + burned;
  const remaining = budget - eaten;

  if (!isPro) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Calorie Tracking</Text>
          <ProLockCard
            title="Calorie tracking"
            description="Log meals, get a daily target built from your body and goal, and see calories burned in workouts added back."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const caloriesNum = Number(calories);
  const proteinNum = protein ? Number(protein) : undefined;
  const nameTrimmed = name.trim();
  const canAdd =
    nameTrimmed.length > 0 &&
    !containsBlockedTerm(nameTrimmed) &&
    Number.isFinite(caloriesNum) &&
    caloriesNum > 0 &&
    caloriesNum <= MAX_ENTRY_CALORIES &&
    (proteinNum == null || (Number.isFinite(proteinNum) && proteinNum >= 0 && proteinNum <= 500));

  const handleAdd = async () => {
    if (!canAdd) return;
    setAdding(true);
    try {
      await addEntry({
        meal,
        name: nameTrimmed.slice(0, 80),
        calories: Math.round(caloriesNum),
        ...(proteinNum != null ? { proteinG: Math.round(proteinNum) } : {}),
      });
      setName('');
      setCalories('');
      setProtein('');
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setAdding(false);
    }
  };

  const saveGoal = async (value: number | null) => {
    try {
      await updateProfile({ calorieGoal: value });
      setEditingGoal(false);
    } catch (e) {
      Alert.alert('Could not save goal', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const goalNum = Number(goalText);
  const goalValid = Number.isFinite(goalNum) && goalNum >= MIN_CALORIE_GOAL && goalNum <= MAX_CALORIE_GOAL;

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.heading}>Calories</Text>
            <ProBadge />
          </View>

          <View style={styles.dayRow}>
            <Pressable
              onPress={() => setDate(shiftDay(date, -1))}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Previous day"
            >
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
            <Text style={styles.dayLabel}>{dayLabel(date)}</Text>
            <Pressable
              onPress={() => setDate(shiftDay(date, 1))}
              disabled={date >= todayDateString()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Next day"
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={date >= todayDateString() ? colors.surfaceMuted : colors.primary}
              />
            </Pressable>
          </View>

          <View style={styles.summaryCard}>
            <Text style={[styles.remaining, remaining < 0 && { color: colors.danger }]}>
              {Math.abs(remaining).toLocaleString()}
            </Text>
            <Text style={styles.remainingLabel}>
              {remaining >= 0 ? 'calories left' : 'calories over'}
            </Text>
            <ProgressBar progress={budget > 0 ? Math.min(1, eaten / budget) : 0} />
            <View style={styles.equation}>
              <EquationPart label="Goal" value={goal} styles={styles} />
              <Text style={styles.op}>+</Text>
              <EquationPart label="Burned" value={burned} styles={styles} />
              <Text style={styles.op}>−</Text>
              <EquationPart label="Eaten" value={eaten} styles={styles} />
            </View>
            {proteinTotal > 0 && <Text style={styles.protein}>Protein: {proteinTotal} g</Text>}
          </View>

          {editingGoal ? (
            <View style={styles.goalEdit}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={goalText}
                onChangeText={setGoalText}
                keyboardType="number-pad"
                placeholder={String(estimatedGoal)}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel="Daily calorie goal"
                autoFocus
              />
              <Button label="Save" onPress={() => goalValid && saveGoal(Math.round(goalNum))} disabled={!goalValid} />
            </View>
          ) : (
            <Text style={styles.goalLine}>
              Daily goal {goal.toLocaleString()}
              {profile?.calorieGoal ? ' (yours)' : ' (estimated from your body and goal)'} ·{' '}
              <Text
                style={styles.link}
                onPress={() => {
                  setGoalText(String(goal));
                  setEditingGoal(true);
                }}
              >
                Edit
              </Text>
              {profile?.calorieGoal ? (
                <>
                  {' · '}
                  <Text style={styles.link} onPress={() => saveGoal(null)}>
                    Use estimate
                  </Text>
                </>
              ) : null}
            </Text>
          )}

          <View style={styles.addCard}>
            <Text style={styles.sectionHeading}>Add food</Text>
            <View style={styles.mealRow}>
              {MEALS.map((m) => (
                <Pressable
                  key={m.value}
                  style={[styles.mealChip, meal === m.value && styles.mealChipActive]}
                  onPress={() => setMeal(m.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: meal === m.value }}
                >
                  <Text style={[styles.mealChipText, meal === m.value && styles.mealChipTextActive]}>
                    {m.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="What did you eat?"
              placeholderTextColor={colors.textMuted}
              maxLength={80}
              accessibilityLabel="Food name"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={calories}
                onChangeText={setCalories}
                placeholder="Calories"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel="Calories"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={protein}
                onChangeText={setProtein}
                placeholder="Protein g (optional)"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="Protein in grams, optional"
              />
            </View>
            <Button label="Add" onPress={handleAdd} disabled={!canAdd} loading={adding} />
          </View>

          {MEALS.map((m) => {
            const mealEntries = entries.filter((e) => e.meal === m.value);
            if (mealEntries.length === 0) return null;
            const total = mealEntries.reduce((sum, e) => sum + e.calories, 0);
            return (
              <View key={m.value} style={styles.mealSection}>
                <View style={styles.mealHeader}>
                  <Text style={styles.sectionHeading}>{m.label}</Text>
                  <Text style={styles.mealTotal}>{total.toLocaleString()} cal</Text>
                </View>
                {mealEntries.map((e) => (
                  <View key={e.id} style={styles.entryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.entryName}>{e.name}</Text>
                      {e.proteinG != null && <Text style={styles.entryMeta}>{e.proteinG} g protein</Text>}
                    </View>
                    <Text style={styles.entryCalories}>{e.calories}</Text>
                    <Pressable
                      onPress={() => deleteEntry(e.id)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${e.name}`}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            );
          })}
          {entries.length === 0 && (
            <Text style={styles.empty}>Nothing logged for {dayLabel(date).toLowerCase()} yet.</Text>
          )}
          <Text style={styles.disclaimer}>
            Targets and burned calories are estimates, not medical advice.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EquationPart({
  label,
  value,
  styles,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof getStyles>;
}) {
  return (
    <View style={styles.eqPart}>
      <Text style={styles.eqValue}>{value.toLocaleString()}</Text>
      <Text style={styles.eqLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  dayLabel: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.md, minWidth: 120, textAlign: 'center' },
  summaryCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  remaining: { fontSize: 40, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  remainingLabel: { textAlign: 'center', color: colors.textMuted, marginTop: -spacing.xs },
  equation: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  eqPart: { alignItems: 'center', flex: 1 },
  eqValue: { fontWeight: '800', color: colors.text, fontSize: typography.sizes.md },
  eqLabel: { color: colors.textMuted, fontSize: typography.sizes.small },
  op: { color: colors.textMuted, fontWeight: '700', fontSize: typography.sizes.md },
  protein: { textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: typography.sizes.small },
  goalLine: { textAlign: 'center', color: colors.textMuted, fontSize: typography.sizes.small },
  link: { color: colors.primary, fontWeight: '700' },
  goalEdit: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addCard: {
    borderWidth: 1.5,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionHeading: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.md },
  mealRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  mealChip: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  mealChipActive: { backgroundColor: colors.primary },
  mealChipText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  mealChipTextActive: { color: colors.textOnDark },
  input: {
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  mealSection: { gap: spacing.xs },
  mealHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  mealTotal: { color: colors.textMuted, fontWeight: '600' },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceMuted,
  },
  entryName: { color: colors.text, fontWeight: '600' },
  entryMeta: { color: colors.textMuted, fontSize: typography.sizes.small },
  entryCalories: { color: colors.text, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center' },
  disclaimer: { color: colors.textMuted, fontSize: typography.sizes.small, textAlign: 'center', marginTop: spacing.md },
});
