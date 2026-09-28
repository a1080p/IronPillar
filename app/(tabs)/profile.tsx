import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TopBar } from '../../components/TopBar';
import { ProgressBar } from '../../components/ProgressBar';
import { Avatar } from '../../components/Avatar';
import { FlameIcon, GroupIcon, GymIcon } from '../../components/icons/BrandIcons';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { levelForXp, xpIntoLevel, XP_PER_LEVEL } from '../../constants/gamification';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { useEarnedBadges } from '../../hooks/useEarnedBadges';
import { useWearableSnapshot } from '../../hooks/useWearableSnapshot';
import { connectWhoop, disconnectWhoop, isWhoopConfigured, syncWhoop } from '../../lib/whoop';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile } = useAuth();
  const { logs } = useWorkoutLogs(user?.uid);
  const { earned } = useEarnedBadges(user?.uid);

  if (!profile || !user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBar />
      </SafeAreaView>
    );
  }

  const level = levelForXp(profile.xp);
  const xpInto = xpIntoLevel(profile.xp);
  const handle = profile.username ? `@${profile.username}` : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Profile</Text>
          <Pressable
            style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
            onPress={() => router.push('/edit-profile')}
            hitSlop={8}
          >
            <Ionicons name="pencil" size={16} color={colors.primary} />
            <Text style={styles.editButtonLabel}>Edit</Text>
          </Pressable>
        </View>

        <View style={styles.avatarWrap}>
          <Avatar url={profile.avatarUrl} presetKey={profile.avatarKey} size={120} />
          <Text style={styles.name}>{profile.name}</Text>
          {handle ? <Text style={styles.handle}>{handle}</Text> : null}
        </View>

        <View style={styles.levelRow}>
          <Text style={styles.levelLabel}>Lvl. {level}</Text>
          <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
            <ProgressBar progress={xpInto / XP_PER_LEVEL} />
          </View>
          <Text style={styles.levelLabel}>Lvl. {level + 1}</Text>
        </View>
        <Text style={styles.xpIntoLabel}>
          {xpInto}/{XP_PER_LEVEL} xp
        </Text>

        <View style={styles.statsRow}>
          <Stat icon={<FlameIcon size={16} color={colors.accentFlame} />} value={profile.streakCount} />
          <Stat icon={<GymIcon size={16} color={colors.primary} />} value={logs.length} />
          <Stat label="xp" value={profile.xp} />
          <Stat icon={<GroupIcon size={16} color={colors.primary} />} value={profile.friendCount} />
        </View>

        <Text style={styles.sectionHeading}>Collection</Text>
        {earned.length === 0 ? (
          <Text style={styles.note}>Complete a workout to earn your first badge.</Text>
        ) : (
          <View style={styles.badgeRow}>
            {earned.map((badge) => (
              <View key={badge.id} style={styles.badgeItem}>
                <View style={styles.badgeCircle}>
                  <Ionicons name="ribbon" size={28} color={colors.primary} />
                </View>
                <Text style={styles.badgeName} numberOfLines={2}>
                  {badge.name}
                </Text>
              </View>
            ))}
          </View>
        )}

        <WearablesSection uid={user.uid} />
      </ScrollView>
    </SafeAreaView>
  );
}

function WearablesSection({ uid }: { uid: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { snapshot } = useWearableSnapshot(uid);
  const [busy, setBusy] = useState(false);
  const connected = !!snapshot?.connected;

  const handleConnect = async () => {
    setBusy(true);
    try {
      await connectWhoop();
    } catch (e) {
      Alert.alert('Could not connect WHOOP', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    try {
      await syncWhoop();
    } catch (e) {
      Alert.alert('Sync failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectWhoop();
    } catch (e) {
      Alert.alert('Could not disconnect', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const hasStats =
    snapshot?.recoveryScore != null || snapshot?.sleepPerformancePct != null || snapshot?.dayStrain != null;

  return (
    <>
      <Text style={styles.sectionHeading}>Wearables</Text>
      {!isWhoopConfigured ? (
        <Text style={styles.note}>WHOOP isn't set up on this build yet.</Text>
      ) : connected ? (
        <View style={styles.wearableCard}>
          <View style={styles.wearableHeader}>
            <Text style={styles.wearableTitle}>WHOOP</Text>
            <Text style={styles.wearableConnected}>Connected</Text>
          </View>
          {hasStats && (
            <View style={styles.wearableStatsRow}>
              {snapshot?.recoveryScore != null && (
                <WearableStat label="Recovery" value={`${Math.round(snapshot.recoveryScore)}%`} />
              )}
              {snapshot?.hrvMs != null && (
                <WearableStat label="HRV" value={`${Math.round(snapshot.hrvMs)}ms`} />
              )}
              {snapshot?.sleepPerformancePct != null && (
                <WearableStat label="Sleep" value={`${Math.round(snapshot.sleepPerformancePct)}%`} />
              )}
              {snapshot?.dayStrain != null && (
                <WearableStat label="Strain" value={snapshot.dayStrain.toFixed(1)} />
              )}
            </View>
          )}
          <View style={styles.wearableActions}>
            <Text
              style={styles.wearableAction}
              onPress={busy ? undefined : handleSync}
              accessibilityRole="button"
            >
              {busy ? 'Working...' : 'Sync now'}
            </Text>
            <Text
              style={styles.wearableActionMuted}
              onPress={busy ? undefined : handleDisconnect}
              accessibilityRole="button"
            >
              Disconnect
            </Text>
          </View>
        </View>
      ) : (
        <Pressable
          style={styles.connectButton}
          onPress={handleConnect}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Connect WHOOP"
        >
          <Text style={styles.connectButtonLabel}>{busy ? 'Connecting...' : 'Connect WHOOP'}</Text>
        </Pressable>
      )}
    </>
  );
}

function WearableStat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.wearableStat}>
      <Text style={styles.wearableStatValue}>{value}</Text>
      <Text style={styles.wearableStatLabel}>{label}</Text>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label?: string;
  value: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      {icon ?? <Text style={styles.statUnit}>{label}</Text>}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  editButtonPressed: { backgroundColor: colors.surfaceMuted },
  editButtonLabel: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  avatarWrap: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  name: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary },
  handle: { color: colors.textMuted, fontSize: typography.sizes.small },
  levelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  levelLabel: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  xpIntoLabel: { textAlign: 'center', color: colors.primary, marginBottom: spacing.lg },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.body },
  statUnit: { color: colors.primary, fontSize: typography.sizes.small },
  sectionHeading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  note: { color: colors.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  badgeItem: { alignItems: 'center', width: 84 },
  badgeCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  badgeName: { fontSize: typography.sizes.small, color: colors.text, textAlign: 'center' },
  connectButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  connectButtonLabel: { color: colors.primary, fontWeight: '700' },
  wearableCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  wearableHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wearableTitle: { fontWeight: '700', color: colors.text },
  wearableConnected: { color: colors.success, fontWeight: '700', fontSize: typography.sizes.small },
  wearableStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  wearableStat: { alignItems: 'center' },
  wearableStatValue: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.body },
  wearableStatLabel: { fontSize: typography.sizes.small, color: colors.textMuted },
  wearableActions: { flexDirection: 'row', justifyContent: 'space-between' },
  wearableAction: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  wearableActionMuted: { color: colors.textMuted, fontWeight: '600', fontSize: typography.sizes.small },
});
