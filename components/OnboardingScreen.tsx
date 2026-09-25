import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Logo } from './Logo';
import { ProgressBar } from './ProgressBar';
import { spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

interface OnboardingScreenProps {
  heading: string;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  step?: number;
  totalSteps?: number;
  children: React.ReactNode;
}

export function OnboardingScreen({
  heading,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  step,
  totalSteps,
  children,
}: OnboardingScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Logo />
          {step != null && totalSteps != null && (
            <View style={styles.progressGroup}>
              <Text style={styles.stepLabel}>
                Step {step} of {totalSteps}
              </Text>
              <ProgressBar progress={step / totalSteps} />
            </View>
          )}
          <Text style={styles.heading}>{heading}</Text>
          <View style={styles.content}>{children}</View>
        </ScrollView>
        <View style={styles.footer}>
          {onBack ? (
            <Button label="Back" variant="outline" onPress={onBack} />
          ) : (
            <View style={{ minWidth: 120 }} />
          )}
          <Button label={nextLabel} onPress={onNext} disabled={nextDisabled} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    flexGrow: 1,
  },
  progressGroup: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  stepLabel: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    fontWeight: '600',
  },
  heading: {
    textAlign: 'center',
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  content: {
    flex: 1,
    gap: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
});
