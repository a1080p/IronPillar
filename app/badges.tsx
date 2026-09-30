import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeList } from '../components/BadgeList';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { BADGE_LIST } from '../data/badges';
import { useAchievementStats } from '../hooks/useAchievementStats';
import { useEarnedBadges } from '../hooks/useEarnedBadges';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';

// Every badge in the app, earned or not. Tap one for how it's unlocked and
// your score toward it.
export default function BadgesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile } = useAuth();
  const { earnedAt } = useEarnedBadges(user?.uid);
  const { logs } = useWorkoutLogs(user?.uid);
  const stats = useAchievementStats(user?.uid, profile, logs.length);

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Collection
        </Text>
        <Text style={styles.count}>
          {Object.keys(earnedAt).length} of {BADGE_LIST.length} earned · Tap a badge for details
        </Text>
        <BadgeList earnedAt={earnedAt} stats={stats} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: 120 },
    heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
    count: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  });
