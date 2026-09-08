import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Logo } from './Logo';
import { colors, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export function WorkoutHeader({ onBack }: { onBack?: () => void }) {
  const { profile } = useAuth();
  return (
    <View style={styles.bar}>
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12}>
        <Ionicons name="chevron-back" size={26} color={colors.primary} />
      </Pressable>
      <Logo />
      <View style={styles.streak}>
        <Text style={styles.streakCount}>{profile?.streakCount ?? 0}</Text>
        <Ionicons name="flame" size={20} color={colors.accentFlame} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
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
