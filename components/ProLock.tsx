import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

export function ProBadge() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>PRO</Text>
    </View>
  );
}

// Shown in place of a Pro-only feature for free users. Tapping opens the paywall.
export function ProLockCard({ title, description }: { title: string; description: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push('/paywall')}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Unlock with Pro`}
    >
      <View style={styles.header}>
        <Ionicons name="lock-closed" size={16} color={colors.primary} />
        <Text style={styles.title}>{title}</Text>
        <ProBadge />
      </View>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.cta}>Unlock with Pro →</Text>
    </Pressable>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    badge: {
      backgroundColor: colors.primary,
      borderRadius: radii.sm,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    badgeText: { color: colors.textOnDark, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    card: {
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderStyle: 'dashed',
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.xs,
      marginBottom: spacing.lg,
    },
    cardPressed: { backgroundColor: colors.surfaceMuted },
    header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    title: { flex: 1, fontWeight: '700', color: colors.text },
    description: { color: colors.textMuted, fontSize: typography.sizes.small },
    cta: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small, marginTop: 2 },
  });
