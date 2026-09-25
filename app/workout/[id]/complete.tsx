import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { badges } from '../../../data/badges';
import { formatVolume } from '../../../lib/workoutStats';
import { useAuth } from '../../../contexts/AuthContext';

export default function WorkoutCompleteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { xpEarned, streakBonus, streakCountAfter, badgeEarnedId, volume, reps, sets, durationSeconds } =
    useLocalSearchParams<{
      xpEarned: string;
      streakBonus: string;
      streakCountAfter: string;
      badgeEarnedId: string;
      volume: string;
      reps: string;
      sets: string;
      durationSeconds: string;
    }>();
  const { profile } = useAuth();
  const [showBadge, setShowBadge] = useState(false);

  const badge = badgeEarnedId ? badges[badgeEarnedId] : null;

  const volumeNum = Number(volume) || 0;
  const repsNum = Number(reps) || 0;
  const setsNum = Number(sets) || 0;
  const minutes = Math.round((Number(durationSeconds) || 0) / 60);
  const summaryChips = [
    `${minutes} min`,
    volumeNum > 0 ? `${formatVolume(volumeNum)} lb lifted` : null,
    repsNum > 0 ? `${repsNum} reps` : null,
    setsNum > 0 ? `${setsNum} sets` : null,
  ].filter(Boolean) as string[];

  const handleNext = () => {
    if (badge && !showBadge) {
      setShowBadge(true);
    } else {
      router.replace('/');
    }
  };

  if (showBadge && badge) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.congrats}>Congrats!</Text>
          <Text style={styles.subheading}>You Earned a Badge</Text>
          <View style={styles.badgeCircle}>
            <Ionicons name="ribbon" size={56} color={colors.primary} />
          </View>
          <Text style={styles.badgeName}>{badge.name}</Text>
        </View>
        <View style={styles.footer}>
          <Button label="Done" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centered}>
        <Text style={styles.heading}>Workout Completed!</Text>
        <Text style={styles.subheading}>Awesome Job{profile?.name ? `, ${profile.name}` : ''}!</Text>

        <Text style={styles.streakLabel}>
          Streak: <Text style={styles.streakValue}>{streakCountAfter}</Text>
        </Text>
        <Text style={styles.xpLine}>
          {xpEarned}
          <Text style={styles.xpUnit}>xp</Text>
        </Text>
        {Number(streakBonus) > 0 && (
          <Text style={styles.streakBonus}>
            Streak Bonus: {streakBonus}
            <Text style={styles.xpUnit}>xp</Text>
          </Text>
        )}

        {summaryChips.length > 0 && (
          <View style={styles.summaryRow}>
            {summaryChips.map((chip) => (
              <View key={chip} style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <Button label="Next" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  subheading: { fontSize: typography.sizes.md, color: colors.primary, marginTop: spacing.xs, marginBottom: spacing.lg },
  streakLabel: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  streakValue: { color: colors.accentFlame },
  xpLine: { fontSize: typography.sizes.md, color: colors.primary, marginTop: spacing.sm },
  streakBonus: { fontSize: typography.sizes.body, color: colors.text, marginTop: spacing.xs },
  xpUnit: { color: colors.primary, fontSize: typography.sizes.small },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  summaryChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  summaryChipText: { color: colors.text, fontSize: typography.sizes.small, fontWeight: '600' },
  congrats: { fontSize: typography.sizes.xl, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  badgeCircle: {
    width: 140,
    height: 140,
    borderRadius: radii.pill,
    borderWidth: 3,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  badgeName: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  footer: { padding: spacing.lg },
});
