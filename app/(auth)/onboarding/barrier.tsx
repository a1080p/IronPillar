import { StyleSheet, Text, TextInput } from 'react-native';
import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { BARRIER_OPTIONS, GOAL_TEXT_MAX } from '../../../constants/options';
import { containsBlockedTerm } from '../../../constants/moderation';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function BarrierScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data, setBarrier } = useOnboarding();
  const [barrier, setChoice] = useState(data.barrier);
  const [other, setOther] = useState(data.barrierOther);

  const otherTrimmed = other.trim();
  const otherBlocked = containsBlockedTerm(otherTrimmed);
  const canContinue =
    !!barrier && (barrier !== 'other' || (otherTrimmed.length > 0 && !otherBlocked));

  const handleNext = () => {
    if (!barrier) return;
    setBarrier(barrier, barrier === 'other' ? otherTrimmed : '');
    router.push('/onboarding/weekly');
  };

  return (
    <OnboardingScreen
      heading="What's Holding You Back the Most?"
      onBack={() => router.back()}
      onNext={handleNext}
      nextDisabled={!canContinue}
      step={4}
      totalSteps={6}
    >
      <Text style={styles.helper}>
        Pick the one that fits best. It helps us make Iron Pillar work better for you.
      </Text>
      {BARRIER_OPTIONS.map((option) => (
        <SelectableOption
          key={option.value}
          label={option.label}
          selected={barrier === option.value}
          onPress={() => setChoice(option.value)}
        />
      ))}
      {barrier === 'other' && (
        <TextInput
          style={styles.otherInput}
          value={other}
          onChangeText={setOther}
          placeholder="Tell us what gets in the way"
          placeholderTextColor={colors.textMuted}
          maxLength={GOAL_TEXT_MAX}
          autoFocus
          accessibilityLabel="What's holding you back"
        />
      )}
      {barrier === 'other' && otherBlocked && (
        <Text style={styles.error}>Please reword that.</Text>
      )}
    </OnboardingScreen>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  helper: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: 'center',
  },
  otherInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.sizes.body,
  },
  error: { color: colors.danger, textAlign: 'center' },
});
