import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TopBar } from '../../components/TopBar';
import { ProgressBar } from '../../components/ProgressBar';
import { Avatar } from '../../components/Avatar';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { levelForXp, xpIntoLevel, XP_PER_LEVEL } from '../../constants/gamification';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { useEarnedBadges } from '../../hooks/useEarnedBadges';

export default function ProfileScreen() {
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
          <Stat icon="flame" iconColor={colors.accentFlame} value={profile.streakCount} />
          <Stat icon="barbell" iconColor={colors.primary} value={logs.length} />
          <Stat label="xp" value={profile.xp} />
          <Stat icon="people" iconColor={colors.primary} value={profile.friendCount} />
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
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({
  icon,
  iconColor,
  label,
  value,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label?: string;
  value: number;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      {icon ? (
        <Ionicons name={icon} size={16} color={iconColor} />
      ) : (
        <Text style={styles.statUnit}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
