import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/ProgressBar';
import { RankEmblem } from '../components/RankEmblem';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { RANKS, rankProgress } from '../constants/rank';
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { usePurchases } from '../contexts/PurchasesContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';

// Your rank, how far to the next one, and the whole ladder.
export default function RankScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile } = useAuth();
  const { isPro } = usePurchases();
  const { logs } = useWorkoutLogs(user?.uid);
  const progress = rankProgress(profile?.xp);
  const { rank, next } = progress;

  // Typical XP a workout, from the last 10 that earned any, to turn "XP to go"
  // into "about N workouts".
  const perWorkout = useMemo(() => {
    const recent = logs.filter((l) => l.xpEarned > 0).slice(0, 10);
    return recent.length ? recent.reduce((n, l) => n + l.xpEarned, 0) / recent.length : 0;
  }, [logs]);
  const workoutsToNext = perWorkout > 0 ? Math.max(1, Math.ceil(progress.xpToNext / perWorkout)) : null;

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <RankEmblem rank={rank} size={120} framed={isPro} />
          <Text style={styles.rankName} accessibilityRole="header">
            {rank.name}
          </Text>
          <Text style={styles.xpTotal}>{(profile?.xp ?? 0).toLocaleString()} XP total</Text>
        </View>

        {next ? (
          <View style={styles.progressBox}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>Next: {next.name}</Text>
              <Text style={styles.progressValue}>{progress.xpToNext.toLocaleString()} XP to go</Text>
            </View>
            <ProgressBar progress={progress.progress} />
            {workoutsToNext && (
              <Text style={styles.progressHint}>
                About {workoutsToNext} more workout{workoutsToNext === 1 ? '' : 's'} at your usual pace.
              </Text>
            )}
          </View>
        ) : (
          <Text style={styles.top}>You've reached the top. Welcome to the Pillar.</Text>
        )}

        <Text style={styles.how}>
          Every completed set, exercise, personal record and session where you beat last time earns XP,
          and hitting your weekly goal adds a bonus. Your rank only goes up.
          {isPro ? ' Your gold frame is a Pro perk.' : ''}
        </Text>

        <Text style={styles.ladderHeading}>All ranks</Text>
        {[...RANKS].reverse().map((r) => {
          const current = r.index === rank.index;
          const reached = r.index <= rank.index;
          return (
            <View key={r.index} style={[styles.ladderRow, current && styles.ladderRowCurrent]}>
              <View style={!reached && styles.locked}>
                <RankEmblem rank={r} size={30} />
              </View>
              <Text style={[styles.ladderName, !reached && styles.lockedText]}>{r.name}</Text>
              <Text style={[styles.ladderXp, !reached && styles.lockedText]}>
                {current ? 'You are here' : `${r.minXp.toLocaleString()} XP`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: 60 },
    hero: { alignItems: 'center', marginBottom: spacing.lg },
    rankName: { fontSize: typography.sizes.xl, fontWeight: '800', color: colors.primary, marginTop: spacing.md },
    xpTotal: { color: colors.textMuted, marginTop: spacing.xs },
    progressBox: { backgroundColor: colors.surfaceMuted, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
    progressLabel: { fontWeight: '700', color: colors.primary },
    progressValue: { fontWeight: '700', color: colors.text },
    progressHint: { color: colors.textMuted, fontSize: typography.sizes.small },
    top: { textAlign: 'center', fontWeight: '700', color: colors.primary },
    how: { color: colors.textMuted, lineHeight: 20, marginVertical: spacing.lg },
    ladderHeading: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
    ladderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
    },
    ladderRowCurrent: { backgroundColor: colors.surfaceMuted },
    ladderName: { flex: 1, fontWeight: '700', color: colors.text },
    ladderXp: { color: colors.textMuted, fontSize: typography.sizes.small },
    locked: { opacity: 0.35 },
    lockedText: { color: colors.textMuted, opacity: 0.7 },
  });
