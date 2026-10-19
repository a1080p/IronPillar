import { StyleSheet, Text } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';

const OPTIONS = [2, 3, 4, 5, 6];

// The weekly goal: how many workouts make a week count. Hitting it week after
// week is the streak, so rest days never break it.
export default function WeeklyGoalScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data, setWeeklyGoal } = useOnboarding();
  const [goal, setGoal] = useState(data.weeklyGoal);

  const handleNext = () => {
    setWeeklyGoal(goal);
    router.push('/onboarding/avatar');
  };

  return (
    <OnboardingScreen
      heading="How Many Days a Week Can You Train?"
      onBack={() => router.back()}
      onNext={handleNext}
      step={5}
      totalSteps={6}
    >
      <Text style={styles.helper}>
        Hit this many workouts in a week and the week counts toward your streak. Rest days never
        break it. Pick what fits a busy week, not your best one. You can change it anytime.
      </Text>
      {OPTIONS.map((n) => (
        <SelectableOption
          key={n}
          label={`${n} days a week${n === 3 ? ' (most popular)' : ''}`}
          selected={goal === n}
          onPress={() => setGoal(n)}
        />
      ))}
    </OnboardingScreen>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    helper: {
      color: colors.textMuted,
      fontSize: typography.sizes.small,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: spacing.xs,
    },
  });
