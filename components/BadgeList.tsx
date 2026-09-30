import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BadgeMedal } from './BadgeMedal';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { BADGE_CATEGORIES, BADGE_LIST } from '../data/badges';
import { useUnits } from '../hooks/useUnits';
import { formatDistance, formatVolume } from '../lib/units';
import type { AchievementStats, Badge, BadgeMetric, UnitSystem } from '../types/models';

const TIER_LABELS: Record<Badge['tier'], string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

// What each metric is called on a badge's detail sheet.
const METRIC_LABELS: Record<BadgeMetric, string> = {
  workouts: 'Workouts completed',
  streak: 'Longest streak',
  level: 'Level',
  prs: 'Personal records set',
  volumeLb: 'Total weight lifted',
  distanceMeters: 'Total outdoor distance',
  singleDistanceMeters: 'Longest outdoor activity',
  seconds: 'Total training time',
  singleSeconds: 'Longest workout',
  early: 'Workouts before 7 AM',
  late: 'Workouts after 9 PM',
  variety: 'Different workouts tried',
};

function formatHours(seconds: number) {
  const hours = seconds / 3600;
  if (hours >= 10) return `${Math.round(hours)} hr`;
  if (hours >= 1) return `${hours.toFixed(1)} hr`;
  return `${Math.round(seconds / 60)} min`;
}

// A metric's value in words, in the viewer's units.
function formatMetric(metric: BadgeMetric, value: number, units: UnitSystem) {
  switch (metric) {
    case 'streak':
      return `${value} ${value === 1 ? 'day' : 'days'}`;
    case 'volumeLb':
      return formatVolume(value, units);
    case 'distanceMeters':
    case 'singleDistanceMeters':
      return formatDistance(value, units, value >= 100000 ? 0 : 1);
    case 'seconds':
      return formatHours(value);
    case 'singleSeconds':
      return `${Math.round(value / 60)} min`;
    default:
      return String(Math.round(value));
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Every badge, grouped by what it rewards. Tapping one opens a sheet with how
// it's unlocked, when it was earned, and the person's current score for it.
// `earnedAt` maps earned badge ids to the date earned (null when unknown);
// `ownerName` is set when looking at a friend's collection.
export function BadgeList({
  earnedAt,
  stats,
  ownerName,
}: {
  earnedAt: Record<string, string | null>;
  stats: AchievementStats;
  ownerName?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [selected, setSelected] = useState<Badge | null>(null);

  return (
    <>
      {BADGE_CATEGORIES.map((category) => (
        <View key={category.key} style={styles.section}>
          <Text style={styles.sectionHeading} accessibilityRole="header">
            {category.label}
          </Text>
          {BADGE_LIST.filter((b) => b.category === category.key).map((badge) => {
            const isEarned = badge.id in earnedAt;
            return (
              <Pressable
                key={badge.id}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => setSelected(badge)}
                accessibilityRole="button"
                accessibilityLabel={`${badge.name}, ${isEarned ? 'earned' : 'locked'}. ${badge.description}`}
                accessibilityHint="Shows how this badge is unlocked"
              >
                <BadgeMedal badge={badge} size={52} locked={!isEarned} />
                <View style={styles.rowText}>
                  <Text style={[styles.name, !isEarned && styles.nameLocked]}>{badge.name}</Text>
                  <Text style={styles.description}>{badge.description}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <BadgeDetail
        badge={selected}
        earned={!!selected && selected.id in earnedAt}
        earnedAt={selected ? earnedAt[selected.id] : null}
        stats={stats}
        ownerName={ownerName}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

export function BadgeDetail({
  badge,
  earned,
  earnedAt,
  stats,
  ownerName,
  onClose,
}: {
  badge: Badge | null;
  earned: boolean;
  earnedAt?: string | null;
  stats: AchievementStats;
  ownerName?: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const units = useUnits();
  if (!badge) return null;

  const value = stats[badge.metric];
  const who = ownerName ? `${ownerName} has` : 'You have';
  const status = earned
    ? earnedAt
      ? `Earned ${formatDate(earnedAt)}`
      : 'Earned'
    : ownerName
      ? 'Not earned yet'
      : 'Locked';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close badge details">
        <Pressable style={styles.card} accessible={false} onPress={() => {}}>
          <BadgeMedal badge={badge} size={112} locked={!earned} />
          <Text style={styles.detailName} accessibilityRole="header">
            {badge.name}
          </Text>
          <Text style={styles.detailTier}>
            {TIER_LABELS[badge.tier]} · {status}
          </Text>

          <Text style={styles.detailLabel}>How to unlock</Text>
          <Text style={styles.detailText}>{badge.description}</Text>

          {value != null && (
            <>
              <Text style={styles.detailLabel}>{METRIC_LABELS[badge.metric]}</Text>
              <Text style={styles.detailScore}>{formatMetric(badge.metric, value, units)}</Text>
              {!earned && (
                <View style={styles.progressWrap}>
                  <ProgressBar progress={badge.threshold > 0 ? value / badge.threshold : 0} />
                  <Text style={styles.progressText}>
                    {who} {formatMetric(badge.metric, value, units)} of{' '}
                    {formatMetric(badge.metric, badge.threshold, units)}
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={styles.closeButton}>
            <Button label="Close" variant="outline" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    section: { marginBottom: spacing.lg },
    sectionHeading: {
      fontSize: typography.sizes.md,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.md,
    },
    rowPressed: { backgroundColor: colors.surfaceMuted },
    rowText: { flex: 1 },
    name: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.body },
    nameLocked: { color: colors.textMuted },
    description: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      alignSelf: 'stretch',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    detailName: {
      fontSize: typography.sizes.lg,
      fontWeight: '800',
      color: colors.primary,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    detailTier: { color: colors.textMuted, marginTop: spacing.xs },
    detailLabel: {
      color: colors.textMuted,
      fontSize: typography.sizes.small,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: spacing.lg,
    },
    detailText: { color: colors.text, textAlign: 'center', marginTop: spacing.xs },
    detailScore: {
      color: colors.accentFlameText,
      fontSize: typography.sizes.xl,
      fontWeight: '800',
      marginTop: spacing.xs,
    },
    progressWrap: { alignSelf: 'stretch', marginTop: spacing.sm, gap: spacing.xs },
    progressText: { color: colors.textMuted, fontSize: typography.sizes.small, textAlign: 'center' },
    closeButton: { alignSelf: 'stretch', marginTop: spacing.lg },
  });
