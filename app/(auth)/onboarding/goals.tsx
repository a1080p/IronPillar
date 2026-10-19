import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { EXPERIENCE_OPTIONS, GOAL_EXAMPLES, GOAL_TEXT_MAX } from '../../../constants/options';
import { containsBlockedTerm } from '../../../constants/moderation';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data, setGoal } = useOnboarding();
  const [goalText, setGoalText] = useState(data.goalText);
  const [experience, setExperience] = useState(data.experienceLevel);

  const trimmed = goalText.trim();
  const blocked = containsBlockedTerm(trimmed);
  const canContinue = trimmed.length >= 3 && !blocked && !!experience;

  const handleNext = () => {
    if (!experience) return;
    setGoal(trimmed, experience);
    router.push('/onboarding/barrier');
  };

  return (
    <OnboardingScreen
      heading={`Nice to Meet You${data.name ? `, ${data.name}` : ''}!`}
      onBack={() => router.back()}
      onNext={handleNext}
      nextDisabled={!canContinue}
      step={3}
      totalSteps={6}
    >
      <Text style={styles.groupLabel}>What do you want to achieve?</Text>
      <Text style={styles.helper}>In your own words. We use it to pick your workouts.</Text>
      <TextInput
        style={styles.goalInput}
        value={goalText}
        onChangeText={setGoalText}
        placeholder="e.g. Get strong enough to deadlift my body weight"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={GOAL_TEXT_MAX}
        accessibilityLabel="Your goal"
      />
      <View style={styles.chips}>
        {GOAL_EXAMPLES.map((example) => (
          <Pressable
            key={example}
            style={styles.chip}
            onPress={() => setGoalText(example)}
            accessibilityRole="button"
            accessibilityLabel={`Use goal: ${example}`}
          >
            <Text style={styles.chipText}>{example}</Text>
          </Pressable>
        ))}
      </View>
      {blocked && <Text style={styles.error}>Please reword your goal.</Text>}

      <Text style={[styles.groupLabel, styles.secondGroup]}>How experienced are you?</Text>
      {EXPERIENCE_OPTIONS.map((level) => (
        <SelectableOption
          key={level.value}
          label={level.label}
          selected={experience === level.value}
          onPress={() => setExperience(level.value)}
        />
      ))}
    </OnboardingScreen>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  groupLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: 'center',
  },
  goalInput: {
    minHeight: 88,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.sizes.body,
    textAlignVertical: 'top',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { color: colors.text, fontSize: typography.sizes.small, fontWeight: '600' },
  error: { color: colors.danger, textAlign: 'center' },
  secondGroup: {
    marginTop: spacing.lg,
  },
});
