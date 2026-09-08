import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Logo } from './Logo';
import { colors, spacing, typography } from '../constants/theme';

interface OnboardingScreenProps {
  heading: string;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
}

export function OnboardingScreen({
  heading,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  children,
}: OnboardingScreenProps) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Logo />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    flexGrow: 1,
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
