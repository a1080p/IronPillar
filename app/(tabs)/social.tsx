import { useMemo, useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { FlameIcon, GymIcon } from '../../components/icons/BrandIcons';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFriends } from '../../hooks/useFriends';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { addFriend } from '../../lib/friends';
import type { ActivityFeedItem } from '../../types/models';

const getIconForType = (colors: ThemeColors): Record<ActivityFeedItem['type'], ReactNode> => ({
  badge_earned: <Ionicons name="ribbon" size={22} color={colors.primary} />,
  streak_milestone: <FlameIcon size={22} color={colors.accentFlame} />,
  friend_workout: <GymIcon size={22} color={colors.primary} />,
});

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SocialScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const iconForType = useMemo(() => getIconForType(colors), [colors]);
  const { user, profile } = useAuth();
  const { friends } = useFriends(user?.uid);
  const { items } = useActivityFeed(user?.uid);

  const [username, setUsername] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddFriend = async () => {
    if (!username.trim()) return;
    setAdding(true);
    try {
      const friend = await addFriend(username.trim());
      setUsername('');
      Alert.alert('Friend added', `You and ${friend.name} are now friends.`);
    } catch (e) {
      Alert.alert('Could not add friend', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Social</Text>

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Add a Friend</Text>
          {profile?.username && (
            <Text style={styles.yourUsername}>Your username: @{profile.username}</Text>
          )}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <Button label="Add" onPress={handleAddFriend} loading={adding} />
          </View>
          {friends.length > 0 && (
            <Text style={styles.friendCount}>
              {friends.length} friend{friends.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>

        <Text style={styles.sectionHeading}>Activity</Text>
        {items.length === 0 ? (
          <Text style={styles.note}>
            No activity yet — add a friend and complete a workout to see updates here.
          </Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.feedItem}>
              {iconForType[item.type]}
              <View style={{ flex: 1 }}>
                <Text style={styles.feedMessage}>{item.message}</Text>
                <Text style={styles.feedTime}>{timeAgo(item.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.lg },
  addCard: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  addTitle: { fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  yourUsername: { color: colors.textMuted, fontSize: typography.sizes.small, marginBottom: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  friendCount: { color: colors.primary, fontWeight: '600', marginTop: spacing.sm },
  sectionHeading: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  note: { color: colors.textMuted },
  feedItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  feedMessage: { color: colors.text, fontWeight: '600' },
  feedTime: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
});
