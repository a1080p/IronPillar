import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionSheet } from '../../components/ActionSheet';
import { Button } from '../../components/Button';
import { ReportUserSheet } from '../../components/ReportUserSheet';
import { WorkoutHeader } from '../../components/WorkoutHeader';
import { containsBlockedTerm } from '../../constants/moderation';
import { radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useComments, usePost } from '../../hooks/useSocial';
import { addComment, deleteComment, deletePost } from '../../lib/friends';
import type { PostComment } from '../../types/models';

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// A workout or check-in and its comments. The author can delete the post and
// any comment on it; others can delete their own comments and report the
// post or a comment.
export default function PostScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { post, missing } = usePost(id);
  const comments = useComments(id);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuComment, setMenuComment] = useState<PostComment | null>(null);
  const [postMenu, setPostMenu] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ uid: string; name: string; commentId?: string } | null>(null);

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.status}>{missing ? 'This post was deleted or isn’t available.' : 'Loading...'}</Text>
      </SafeAreaView>
    );
  }

  const isAuthor = post.authorUid === user?.uid;

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (containsBlockedTerm(body)) {
      Alert.alert('Not allowed', 'That comment includes language that isn’t allowed.');
      return;
    }
    setSending(true);
    try {
      await addComment(post.id, body);
      setText('');
    } catch (e) {
      Alert.alert('Could not comment', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  const commentActions = (c: PostComment) => {
    const actions = [];
    if (c.uid === user?.uid || isAuthor) {
      actions.push({
        label: 'Delete Comment',
        icon: 'trash-outline' as const,
        destructive: true,
        onPress: () =>
          deleteComment(post.id, c.id).catch((e) =>
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.')
          ),
      });
    }
    if (c.uid !== user?.uid) {
      actions.push({
        label: 'Report Comment',
        icon: 'flag-outline' as const,
        onPress: () => setReportTarget({ uid: c.uid, name: c.name, commentId: c.id }),
      });
    }
    return actions;
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.postHeader}>
            <Text style={styles.author}>{isAuthor ? 'You' : post.authorName}</Text>
            <Text style={styles.time}>{timeAgo(post.createdAt)}</Text>
            <Pressable
              onPress={() => setPostMenu(true)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Post options"
              style={{ marginLeft: 'auto' }}
            >
              <Text style={styles.dots}>•••</Text>
            </Pressable>
          </View>
          {post.photoUrl ? (
            <Image
              source={{ uri: post.photoUrl }}
              style={styles.photo}
              accessibilityLabel={`${post.authorName}'s check-in photo`}
            />
          ) : null}
          <Text style={styles.message}>{post.caption || post.message}</Text>

          <Text style={styles.sectionHeading} accessibilityRole="header">
            {comments.length === 0 ? 'No comments yet' : `Comments (${comments.length})`}
          </Text>
          {comments.map((c) => (
            <Pressable
              key={c.id}
              style={styles.comment}
              onLongPress={() => setMenuComment(c)}
              accessibilityHint="Long press for options"
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.commentName}>
                  {c.uid === user?.uid ? 'You' : c.name} <Text style={styles.time}>· {timeAgo(c.createdAt)}</Text>
                </Text>
                <Text style={styles.commentText}>{c.text}</Text>
              </View>
              {commentActions(c).length > 0 && (
                <Pressable
                  onPress={() => setMenuComment(c)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Comment options"
                >
                  <Text style={styles.dots}>•••</Text>
                </Pressable>
              )}
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Add a comment"
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            multiline
            accessibilityLabel="Add a comment"
          />
          <View style={styles.sendWrap}>
            <Button label="Post" onPress={send} loading={sending} disabled={!text.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>

      <ActionSheet
        visible={!!menuComment}
        onClose={() => setMenuComment(null)}
        actions={menuComment ? commentActions(menuComment) : []}
      />
      <ActionSheet
        visible={postMenu}
        onClose={() => setPostMenu(false)}
        actions={
          isAuthor
            ? [
                {
                  label: 'Delete Post',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () =>
                    Alert.alert('Delete this post?', 'It and its comments will be removed for everyone.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          deletePost(post.id)
                            .then(() => router.back())
                            .catch((e) =>
                              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.')
                            ),
                      },
                    ]),
                },
              ]
            : [
                {
                  label: 'Report Post',
                  icon: 'flag-outline',
                  onPress: () => setReportTarget({ uid: post.authorUid, name: post.authorName }),
                },
              ]
        }
      />
      {reportTarget && (
        <ReportUserSheet
          visible
          userUid={reportTarget.uid}
          userName={reportTarget.name}
          postId={post.id}
          commentId={reportTarget.commentId}
          onClose={() => setReportTarget(null)}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    status: { textAlign: 'center', color: colors.textMuted, marginTop: spacing.xl },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
    postHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
    author: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.body },
    time: { color: colors.textMuted, fontSize: typography.sizes.small, fontWeight: '400' },
    dots: { color: colors.textMuted, fontSize: typography.sizes.body, letterSpacing: 1 },
    photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    message: { color: colors.text, fontSize: typography.sizes.body, marginTop: spacing.md },
    sectionHeading: { fontWeight: '700', color: colors.primary, marginTop: spacing.xl, marginBottom: spacing.sm },
    comment: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    commentName: { fontWeight: '700', color: colors.text },
    commentText: { color: colors.text, marginTop: 2 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      padding: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    input: {
      flex: 1,
      maxHeight: 100,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
    },
    sendWrap: { width: 96 },
  });
