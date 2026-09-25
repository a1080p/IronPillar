import { StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from './TopBar';
import { spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

export function PlaceholderTab({ title, note }: { title: string; note: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <View style={styles.content}>
        <Text style={styles.heading}>{title}</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  note: {
    color: colors.textMuted,
  },
});
