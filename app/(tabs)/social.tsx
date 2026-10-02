import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { TopBar } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { FlameIcon, GymIcon } from '../../components/icons/BrandIcons';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFriends } from '../../hooks/useFriends';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import {
  addFriend,
  cancelFriendRequest,
  reactToActivity,
  respondFriendRequest,
  type Reaction,
} from '../../lib/friends';
import { useFriendRequests, usePost } from '../../hooks/useSocial';
import { CheckInSheet } from '../../components/CheckInSheet';
import type { ActivityFeedItem } from '../../types/models';

const getIconForType = (colors: ThemeColors): Record<ActivityFeedItem['type'], ReactNode> => ({
  badge_earned: <Ionicons name="ribbon" size={22} color={colors.primary} />,
  streak_milestone: <FlameIcon size={22} color={colors.accentFlame} />,
  friend_workout: <GymIcon size={22} color={colors.primary} />,
  reaction: <Ionicons name="heart" size={22} color={colors.danger} />,
  check_in: <Ionicons name="camera" size={22} color={colors.primary} />,
  comment: <Ionicons name="chatbubble" size={22} color={colors.primary} />,
  friend_request_accepted: <Ionicons name="person-add" size={22} color={colors.primary} />,
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
  const { incoming, outgoing } = useFriendRequests(user?.uid);
  const [checkInOpen, setCheckInOpen] = useState(false);

  const respond = (uid: string, accept: boolean) =>
    respondFriendRequest(uid, accept).catch((e) =>
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Try again.')
    );

  const [username, setUsername] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddFriend = async () => {
    if (!username.trim()) return;
    setAdding(true);
    try {
      const friend = await addFriend(username.trim());
      setUsername('');
      if (friend.status === 'requested') {
        Alert.alert('Request sent', `${friend.name} will see your friend request and can accept it.`);
      } else {
        Alert.alert('Friend added', `You and ${friend.name} are now friends.`);
      }
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
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { marginBottom: 0 }]} accessibilityRole="header">
            Social
          </Text>
          <Pressable
            style={styles.checkInButton}
            onPress={() => setCheckInOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Post a workout check-in photo"
          >
            <Ionicons name="camera" size={22} color={colors.textOnDark} />
          </Pressable>
        </View>

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Add a Friend</Text>
          <Text style={styles.addHint}>Send a request by username. They'll need to accept it.</Text>
          {profile?.username && (
            <Text style={styles.yourUsername}>Your username: @{profile.username}</Text>
          )}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="username"
              accessibilityLabel="Friend's username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
            <Button label="Send" onPress={handleAddFriend} loading={adding} />
          </View>
          {friends.length > 0 && (
            <Text style={styles.friendCount}>
              {friends.length} friend{friends.length === 1 ? '' : 's'}
            </Text>
          )}
        </View>

        {incoming.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Friend Requests</Text>
            {incoming.map((r) => (
              <View key={r.uid} style={styles.friendRow}>
                <Ionicons name="person-circle" size={36} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{r.name}</Text>
                  <Text style={styles.friendHandle}>@{r.username}</Text>
                </View>
                <Pressable
                  style={styles.acceptButton}
                  onPress={() => respond(r.uid, true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Accept ${r.name}'s request`}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={styles.declineButton}
                  onPress={() => respond(r.uid, false)}
                  accessibilityRole="button"
                  accessibilityLabel={`Decline ${r.name}'s request`}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
              </View>
            ))}
            <View style={{ height: spacing.lg }} />
          </>
        )}

        {outgoing.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Sent Requests</Text>
            {outgoing.map((r) => (
              <View key={r.uid} style={styles.friendRow}>
                <Ionicons name="time-outline" size={28} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{r.name}</Text>
                  <Text style={styles.friendHandle}>@{r.username} · waiting</Text>
                </View>
                <Pressable
                  onPress={() =>
                    cancelFriendRequest(r.uid).catch((e) =>
                      Alert.alert('Could not cancel', e instanceof Error ? e.message : 'Try again.')
                    )
                  }
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Cancel request to ${r.name}`}
                >
                  <Text style={styles.declineText}>Cancel</Text>
                </Pressable>
              </View>
            ))}
            <View style={{ height: spacing.lg }} />
          </>
        )}

        {friends.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Friends</Text>
            <View style={styles.friendList}>
              {friends.map((friend) => (
                <Pressable
                  key={friend.uid}
                  style={({ pressed }) => [styles.friendRow, pressed && styles.friendRowPressed]}
                  onPress={() => router.push(`/friend/${friend.uid}` as Href)}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${friend.name}'s profile`}
                >
                  <Ionicons name="person-circle" size={36} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{friend.name}</Text>
                    <Text style={styles.friendHandle}>@{friend.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionHeading}>Activity</Text>
        {items.length === 0 ? (
          <Text style={styles.note}>
            No activity yet — add a friend and complete a workout to see updates here.
          </Text>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.feedItem}>
              {iconForType[item.type] ?? iconForType.friend_workout}
              <View style={{ flex: 1 }}>
                <Text
                  style={styles.feedMessage}
                  onPress={
                    item.actorUid !== user?.uid
                      ? () => router.push(`/friend/${item.actorUid}` as Href)
                      : undefined
                  }
                >
                  {item.message}
                </Text>
                {item.photoUrl ? (
                  <Pressable
                    onPress={() => item.postId && router.push(`/post/${item.postId}` as Href)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.actorName}'s check-in photo. Opens comments`}
                  >
                    <Image source={{ uri: item.photoUrl }} style={styles.feedPhoto} />
                  </Pressable>
                ) : null}
                {item.caption ? <Text style={styles.feedCaption}>{item.caption}</Text> : null}
                <Text style={styles.feedTime}>{timeAgo(item.createdAt)}</Text>
                <View style={styles.itemActions}>
                  {item.type !== 'reaction' &&
                    item.type !== 'comment' &&
                    item.type !== 'friend_request_accepted' &&
                    item.actorUid !== user?.uid && <ReactionButtons item={item} />}
                  {item.postId && <CommentsButton postId={item.postId} />}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
      {user && <CheckInSheet visible={checkInOpen} uid={user.uid} onClose={() => setCheckInOpen(false)} />}
    </SafeAreaView>
  );
}

// "Comment" link with the live count, under any feed item that's a post.
function CommentsButton({ postId }: { postId: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { post, missing } = usePost(postId);
  if (missing) return null;
  const count = post?.commentCount ?? 0;
  return (
    <Pressable
      style={styles.reactionButton}
      onPress={() => router.push(`/post/${postId}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `${count} comments. Open comments` : 'Comment'}
    >
      <Ionicons name="chatbubble-outline" size={15} color={colors.textMuted} />
      <Text style={styles.reactionText}>{count > 0 ? count : 'Comment'}</Text>
    </Pressable>
  );
}

// ❤️ / 🎉 on a friend's workout, badge, or streak. Optimistic: the button
// flips immediately and reverts if the server call fails.
function ReactionButtons({ item }: { item: ActivityFeedItem }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [sent, setSent] = useState(item.myReactions ?? {});

  const send = async (reaction: Reaction) => {
    if (sent[reaction]) return;
    setSent((prev) => ({ ...prev, [reaction]: true }));
    try {
      await reactToActivity(item.id, reaction);
    } catch (e) {
      setSent((prev) => ({ ...prev, [reaction]: false }));
      Alert.alert('Could not send', e instanceof Error ? e.message : 'Try again.');
    }
  };

  const congratsLabel =
    item.type === 'friend_workout' ? 'Nice work' : 'Congrats';

  return (
    <View style={styles.reactionRow}>
      <Pressable
        onPress={() => send('heart')}
        style={[styles.reactionButton, sent.heart && styles.reactionButtonSent]}
        accessibilityRole="button"
        accessibilityLabel={sent.heart ? 'Heart sent' : `Send ${item.actorName} a heart`}
      >
        <Ionicons
          name={sent.heart ? 'heart' : 'heart-outline'}
          size={16}
          color={sent.heart ? colors.danger : colors.textMuted}
        />
      </Pressable>
      <Pressable
        onPress={() => send('congrats')}
        style={[styles.reactionButton, sent.congrats && styles.reactionButtonSent]}
        accessibilityRole="button"
        accessibilityLabel={sent.congrats ? 'Congrats sent' : `Congratulate ${item.actorName}`}
      >
        <Text style={[styles.reactionText, sent.congrats && styles.reactionTextSent]}>
          🎉 {sent.congrats ? 'Sent' : congratsLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  checkInButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addHint: { color: colors.textMuted, fontSize: typography.sizes.small, marginBottom: spacing.sm },
  acceptButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  acceptText: { color: colors.textOnDark, fontWeight: '700', fontSize: typography.sizes.small },
  declineButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2 },
  declineText: { color: colors.textMuted, fontWeight: '700', fontSize: typography.sizes.small },
  feedPhoto: {
    width: '100%',
    aspectRatio: 4 / 5,
    borderRadius: radii.md,
    marginTop: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  feedCaption: { color: colors.text, marginTop: spacing.xs },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.sm },
  friendList: { marginBottom: spacing.lg },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  friendRowPressed: { backgroundColor: colors.surfaceMuted },
  friendName: { color: colors.text, fontWeight: '700', fontSize: typography.sizes.body },
  friendHandle: { color: colors.textMuted, fontSize: typography.sizes.small },
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
  reactionRow: { flexDirection: 'row', gap: spacing.sm },
  reactionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.background,
  },
  reactionButtonSent: { borderColor: colors.primary },
  reactionText: { fontSize: typography.sizes.small, color: colors.textMuted, fontWeight: '600' },
  reactionTextSent: { color: colors.primary },
});
