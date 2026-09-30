import { Ionicons } from '@expo/vector-icons';
import { FlameIcon } from './icons/BrandIcons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Logo } from './Logo';
import { MoreMenu } from './MoreMenu';
import { spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export function WorkoutHeader({ onBack }: { onBack?: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { profile } = useAuth();
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
        <View
          style={styles.streak}
          accessible
          accessibilityLabel={`${profile?.streakCount ?? 0} day streak`}
        >
          <Text style={styles.streakCount}>{profile?.streakCount ?? 0}</Text>
          <FlameIcon size={20} color={colors.accentFlame} />
        </View>
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
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakCount: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: colors.primary,
  },
});
