import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { formatVolume } from '../../../lib/units';
import { useUnits } from '../../../hooks/useUnits';
import { useAuth } from '../../../contexts/AuthContext';
import { XpBreakdown } from '../../../components/XpBreakdown';
import { MoreMenu } from '../../../components/MoreMenu';
import { Confetti } from '../../../components/Confetti';
import { completionMessages, pickMessage } from '../../../constants/motivation';
import { CelebrationFlow, PersonalRecordPopup, hasCelebrations } from '../../../components/Celebrations';
import type { CompletionResult } from '../../../lib/workoutCompletion';

export default function WorkoutCompleteScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const {
    xpEarned,
    xpMultiplier,
    streakBonus,
    streakCountAfter,
    badgeEarnedId,
    volume,
    reps,
    sets,
    durationSeconds,
    result: resultJson,
  } =
    useLocalSearchParams<{
      result?: string;
      xpEarned: string;
      xpMultiplier?: string;
      streakBonus: string;
      streakCountAfter: string;
      badgeEarnedId: string;
      volume: string;
      reps: string;
      sets: string;
      durationSeconds: string;
    }>();
  const { profile } = useAuth();
  const units = useUnits();
  const [celebrating, setCelebrating] = useState(false);

  // Full server result (with the per-source XP breakdown). Older call sites
  // only pass the flat params, so rebuild a minimal result from those.
  const result = useMemo<CompletionResult>(() => {
    if (resultJson) {
      try {
        return JSON.parse(resultJson) as CompletionResult;
      } catch {
        // fall through
      }
    }
    return {
      xpEarned: Number(xpEarned) || 0,
      streakBonus: Number(streakBonus) || 0,
      streakCountAfter: Number(streakCountAfter) || 0,
      badgeEarnedId: badgeEarnedId || null,
      xpMultiplier: Number(xpMultiplier) || 1,
    };
  }, [resultJson, xpEarned, streakBonus, streakCountAfter, badgeEarnedId, xpMultiplier]);

  const volumeNum = Number(volume) || 0;
  const repsNum = Number(reps) || 0;
  const setsNum = Number(sets) || 0;
  const minutes = Math.round((Number(durationSeconds) || 0) / 60);
  const summaryChips = [
    `${minutes} min`,
    volumeNum > 0 ? `${formatVolume(volumeNum, units)} lifted` : null,
    repsNum > 0 ? `${repsNum} reps` : null,
    setsNum > 0 ? `${setsNum} ${setsNum === 1 ? 'set' : 'sets'}` : null,
  ].filter(Boolean) as string[];

  const message = pickMessage(completionMessages, result.xpEarned + result.streakCountAfter);

  // Level-up and badge screens (if any) come between this summary and Home.
  const celebrations = hasCelebrations(result);
  const handleNext = () => {
    if (celebrations) setCelebrating(true);
    else router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.more}>
          <MoreMenu />
        </View>
        <Text style={styles.heading}>{message.heading}</Text>
        <Text style={styles.subheading}>
          {message.sub}
          {profile?.name ? `, ${profile.name}` : ''}.
        </Text>

        {summaryChips.length > 0 && (
          <View style={styles.summaryRow}>
            {summaryChips.map((chip) => (
              <View key={chip} style={styles.summaryChip}>
                <Text style={styles.summaryChipText}>{chip}</Text>
              </View>
            ))}
          </View>
        )}

        <XpBreakdown result={result} />

        <Text style={styles.streakLabel}>
          Streak: <Text style={styles.streakValue}>{result.streakCountAfter}</Text>
        </Text>
      </ScrollView>
      <View style={styles.footer}>
        <Button label={celebrations ? 'Next' : 'Done'} onPress={handleNext} />
      </View>
      <Confetti />
      <PersonalRecordPopup records={result.personalRecords} />
      <CelebrationFlow result={result} visible={celebrating} onDone={() => router.replace('/')} />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center', padding: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  subheading: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  streakLabel: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary, marginTop: spacing.sm },
  streakValue: { color: colors.accentFlameText },
  xpLine: { fontSize: typography.sizes.md, color: colors.primary, marginTop: spacing.sm },
  streakBonus: { fontSize: typography.sizes.body, color: colors.text, marginTop: spacing.xs },
  xpUnit: { color: colors.primary, fontSize: typography.sizes.small },
  proXp: { color: colors.accentFlameText, fontWeight: '800', fontSize: typography.sizes.small, marginTop: spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  summaryChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  summaryChipText: { color: colors.text, fontSize: typography.sizes.small, fontWeight: '600' },
  more: { alignSelf: 'flex-end', marginBottom: -spacing.md },
  footer: { padding: spacing.lg },
});
