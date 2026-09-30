import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Avatar } from '../../components/Avatar';
import { BadgeList } from '../../components/BadgeList';
import { ProgressBar } from '../../components/ProgressBar';
import { StatTile } from '../../components/StatTile';
import { WorkoutHeader } from '../../components/WorkoutHeader';
import { levelProgress } from '../../constants/gamification';
import { spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { BADGE_LIST } from '../../data/badges';
import { useUnits } from '../../hooks/useUnits';
import { getFriendProfile } from '../../lib/friends';
import { formatDistance, formatVolume } from '../../lib/units';
import type { FriendProfile } from '../../types/models';

// A friend's profile: level, streak, lifetime stats and badge collection.
export default function FriendProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const units = useUnits();
  const [friend, setFriend] = useState<FriendProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    setFriend(null);
    setError(null);
    getFriendProfile(uid)
      .then((profile) => {
        if (!cancelled) setFriend(profile);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load this profile.');
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const earnedAt = useMemo(
    () => Object.fromEntries((friend?.badges ?? []).map((b) => [b.badgeId, b.earnedAt])),
    [friend]
  );

  if (!friend) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.status}>{error ?? 'Loading profile...'}</Text>
      </SafeAreaView>
    );
  }

  const { level, xpInto, xpNeeded } = levelProgress(friend.xp);
  const { stats } = friend;
  const firstName = friend.name.split(' ')[0] || friend.name;
  const hours = stats.seconds != null ? stats.seconds / 3600 : null;

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.avatarWrap}>
          <Avatar url={friend.avatarUrl} presetKey={friend.avatarKey} size={112} />
          <Text style={styles.name} accessibilityRole="header">
            {friend.name}
          </Text>
          {friend.username ? <Text style={styles.handle}>@{friend.username}</Text> : null}
        </View>

        <View style={styles.levelRow}>
          <Text style={styles.levelLabel}>Lvl. {level}</Text>
          <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
            <ProgressBar progress={xpInto / xpNeeded} />
          </View>
          <Text style={styles.levelLabel}>Lvl. {level + 1}</Text>
        </View>
        <Text style={styles.xp}>{friend.xp} XP</Text>

        <Text style={styles.sectionHeading} accessibilityRole="header">
          Stats
        </Text>
        <View style={styles.tiles}>
          <StatTile value={friend.streakCount} label="Current streak" />
          <StatTile value={stats.streak ?? friend.streakCount} label="Longest streak" />
          <StatTile value={stats.workouts ?? 0} label="Workouts" />
          {stats.prs != null && <StatTile value={stats.prs} label="Personal records" />}
          {stats.volumeLb != null && stats.volumeLb > 0 && (
            <StatTile value={formatVolume(stats.volumeLb, units)} label="Total lifted" />
          )}
          {stats.distanceMeters != null && stats.distanceMeters > 0 && (
            <StatTile value={formatDistance(stats.distanceMeters, units, 1)} label="Outdoor distance" />
          )}
          {hours != null && hours > 0 && (
            <StatTile
              value={hours >= 1 ? `${hours.toFixed(hours >= 10 ? 0 : 1)} hr` : `${Math.round(hours * 60)} min`}
              label="Training time"
            />
          )}
        </View>

        <Text style={styles.sectionHeading} accessibilityRole="header">
          Collection
        </Text>
        <Text style={styles.count}>
          {friend.badges.length} of {BADGE_LIST.length} earned · Tap a badge for details
        </Text>
        <BadgeList earnedAt={earnedAt} stats={stats} ownerName={firstName} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    status: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl, padding: spacing.lg },
    scroll: { padding: spacing.lg, paddingBottom: 120 },
    avatarWrap: { alignItems: 'center', marginBottom: spacing.lg },
    name: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.text, marginTop: spacing.md },
    handle: { color: colors.textMuted, marginTop: 2 },
    levelRow: { flexDirection: 'row', alignItems: 'center' },
    levelLabel: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
    xp: { color: colors.textMuted, fontSize: typography.sizes.small, textAlign: 'center', marginTop: spacing.xs },
    sectionHeading: {
      fontSize: typography.sizes.lg,
      fontWeight: '700',
      color: colors.primary,
      marginTop: spacing.xl,
      marginBottom: spacing.md,
    },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    count: { color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.lg },
  });
