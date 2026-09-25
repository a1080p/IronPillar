import { StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS } from '../../../constants/options';
import { spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function GoalsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data, toggleGoal, setExperienceLevel } = useOnboarding();

  const canContinue = data.goals.length > 0 && !!data.experienceLevel;

  return (
    <OnboardingScreen
      heading={`It's Nice to Meet You, ${data.name || 'there'}!`}
      onBack={() => router.back()}
      onNext={() => router.push('/onboarding/avatar')}
      nextDisabled={!canContinue}
      step={3}
      totalSteps={4}
    >
      <Text style={styles.groupLabel}>What are your goals?</Text>
      {GOAL_OPTIONS.map((goal) => (
        <SelectableOption
          key={goal.value}
          label={goal.label}
          selected={data.goals.includes(goal.value)}
          onPress={() => toggleGoal(goal.value)}
        />
      ))}

      <Text style={[styles.groupLabel, styles.secondGroup]}>How experienced are you?</Text>
      {EXPERIENCE_OPTIONS.map((level) => (
        <SelectableOption
          key={level.value}
          label={level.label}
          selected={data.experienceLevel === level.value}
          onPress={() => setExperienceLevel(level.value)}
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
  secondGroup: {
    marginTop: spacing.lg,
  },
});
