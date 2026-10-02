import type { FriendProfile } from '../types/models';
import { httpsCallable } from 'firebase/functions';
import { functions, storage } from './firebase/config';
import { ref, uploadBytes } from 'firebase/storage';

interface AddFriendResult {
  // 'requested' sends a request; 'friends' when they had already asked you.
  status?: 'requested' | 'friends';
  uid: string;
  name: string;
  username: string;
}

const addFriendFn = httpsCallable<{ username: string }, AddFriendResult>(functions, 'addFriend');

export async function addFriend(username: string): Promise<AddFriendResult> {
  const { data } = await addFriendFn({ username });
  return data;
}

export type Reaction = 'heart' | 'congrats';

const reactToActivityFn = httpsCallable<
  { itemId: string; reaction: Reaction },
  { reacted: boolean; alreadySent: boolean }
>(functions, 'reactToActivity');

// Sends a ❤️ or 🎉 to the friend behind an item in your activity feed.
export async function reactToActivity(itemId: string, reaction: Reaction) {
  const { data } = await reactToActivityFn({ itemId, reaction });
  return data;
}

const getFriendProfileFn = httpsCallable<{ uid: string }, FriendProfile>(functions, 'getFriendProfile');

// A friend's name, level, streak, badges and lifetime totals. The server
// refuses anyone who isn't a friend.
export async function getFriendProfile(uid: string): Promise<FriendProfile> {
  const { data } = await getFriendProfileFn({ uid });
  return data;
}

const removeFriendFn = httpsCallable<{ uid: string }, { removed: boolean }>(functions, 'removeFriend');
const blockUserFn = httpsCallable<{ uid: string }, { blocked: boolean }>(functions, 'blockUser');
const unblockUserFn = httpsCallable<{ uid: string }, { unblocked: boolean }>(functions, 'unblockUser');
const reportUserFn = httpsCallable<
  { uid: string; reason: ReportReason; details: string; postId?: string; commentId?: string },
  { reported: boolean }
>(
  functions,
  'reportUser'
);

export type ReportReason = 'offensive_profile' | 'harassment' | 'impersonation' | 'spam' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'offensive_profile', label: 'Offensive name, photo or comment' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'impersonation', label: 'Pretending to be someone else' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

export async function removeFriend(uid: string) {
  await removeFriendFn({ uid });
}

// Removes the friendship, clears their activity from your feed, and stops
// them finding or adding you.
export async function blockUser(uid: string) {
  await blockUserFn({ uid });
}

export async function unblockUser(uid: string) {
  await unblockUserFn({ uid });
}

// Reports a user, or something they posted when postId (and commentId) is given.
export async function reportUser(
  uid: string,
  reason: ReportReason,
  details: string,
  target: { postId?: string; commentId?: string } = {}
) {
  await reportUserFn({ uid, reason, details, ...target });
}

const respondFn = httpsCallable<{ uid: string; accept: boolean }, { status: string }>(functions, 'respondFriendRequest');
const cancelRequestFn = httpsCallable<{ uid: string }, { cancelled: boolean }>(functions, 'cancelFriendRequest');

export async function respondFriendRequest(uid: string, accept: boolean) {
  await respondFn({ uid, accept });
}

export async function cancelFriendRequest(uid: string) {
  await cancelRequestFn({ uid });
}

const addCommentFn = httpsCallable<{ postId: string; text: string }, { id: string }>(functions, 'addComment');
const deleteCommentFn = httpsCallable<{ postId: string; commentId: string }, { deleted: boolean }>(
  functions,
  'deleteComment'
);
const deletePostFn = httpsCallable<{ postId: string }, { deleted: boolean }>(functions, 'deletePost');
const createCheckInFn = httpsCallable<{ photoPath: string; caption: string }, { postId: string }>(
  functions,
  'createCheckIn'
);

export async function addComment(postId: string, text: string) {
  await addCommentFn({ postId, text });
}

export async function deleteComment(postId: string, commentId: string) {
  await deleteCommentFn({ postId, commentId });
}

export async function deletePost(postId: string) {
  await deletePostFn({ postId });
}

// Uploads a check-in photo, then shares it with friends.
export async function createCheckIn(uid: string, localUri: string, caption: string) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const photoPath = `checkins/${uid}/${name}.jpg`;
  const blob = await (await fetch(localUri)).blob();
  await uploadBytes(ref(storage, photoPath), blob, { contentType: 'image/jpeg' });
  const { data } = await createCheckInFn({ photoPath, caption });
  return data.postId;
}
