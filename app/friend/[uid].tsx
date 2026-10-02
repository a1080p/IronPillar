import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { ReportUserSheet } from '../../components/ReportUserSheet';
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
import { blockUser, getFriendProfile, removeFriend } from '../../lib/friends';
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
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const runAndLeave = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      router.back();
    } catch (e) {
      setBusy(false);
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again.');
    }
  };

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

        <View style={styles.actions}>
          <Button
            label="Remove Friend"
            variant="outline"
            disabled={busy}
            onPress={() =>
              Alert.alert(`Remove ${friend.name}?`, 'You will stop seeing each other’s activity.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => runAndLeave(() => removeFriend(friend.uid)),
                },
              ])
            }
          />
          <Button label={`Report ${firstName}`} variant="outline" onPress={() => setReporting(true)} />
          <Button
            label={`Block ${firstName}`}
            variant="ghost"
            disabled={busy}
            onPress={() =>
              Alert.alert(
                `Block ${friend.name}?`,
                'They’ll be removed from your friends, their activity will disappear from your feed, and they won’t be able to find or add you. You can unblock them in Settings.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Block', style: 'destructive', onPress: () => runAndLeave(() => blockUser(friend.uid)) },
                ]
              )
            }
          />
        </View>
      </ScrollView>
      <ReportUserSheet
        visible={reporting}
        userUid={friend.uid}
        userName={friend.name}
        onClose={() => setReporting(false)}
      />
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
    actions: { marginTop: spacing.lg, gap: spacing.md },
    count: { color: colors.textMuted, marginTop: -spacing.sm, marginBottom: spacing.lg },
  });
