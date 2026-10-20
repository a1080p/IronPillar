import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Logo } from './Logo';
import { MoreMenu } from './MoreMenu';
import { spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { RankBadge } from './RankEmblem';

export function WorkoutHeader({ onBack }: { onBack?: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
      </View>
      <Logo />
      <View style={styles.right}>
        <RankBadge />
        <MoreMenu color={colors.text} />
      </View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  // Left and right take equal width so the logo stays centered.
  side: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  right: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md },
});
