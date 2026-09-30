import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeMedal } from '../components/BadgeMedal';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { BADGE_CATEGORIES, BADGE_LIST } from '../data/badges';
import { useEarnedBadges } from '../hooks/useEarnedBadges';

// Every badge in the app, earned or not, grouped by what it rewards.
export default function BadgesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const { earned } = useEarnedBadges(user?.uid);
  const earnedIds = useMemo(() => new Set(earned.map((b) => b.id)), [earned]);

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Collection</Text>
        <Text style={styles.count}>
          {earnedIds.size} of {BADGE_LIST.length} earned
        </Text>

        {BADGE_CATEGORIES.map((category) => (
          <View key={category.key} style={styles.section}>
            <Text style={styles.sectionHeading}>{category.label}</Text>
            {BADGE_LIST.filter((b) => b.category === category.key).map((badge) => {
              const isEarned = earnedIds.has(badge.id);
              return (
                <View key={badge.id} style={styles.row}>
                  <BadgeMedal badge={badge} size={52} locked={!isEarned} />
                  <View style={styles.rowText}>
                    <Text style={[styles.name, !isEarned && styles.nameLocked]}>{badge.name}</Text>
                    <Text style={styles.description}>{badge.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
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
    section: { marginBottom: spacing.lg },
    sectionHeading: {
      fontSize: typography.sizes.md,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
    rowText: { flex: 1 },
    name: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.body },
    nameLocked: { color: colors.textMuted },
    description: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
  });
