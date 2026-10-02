import type { FriendProfile } from '../types/models';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';

interface AddFriendResult {
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
const reportUserFn = httpsCallable<{ uid: string; reason: ReportReason; details: string }, { reported: boolean }>(
  functions,
  'reportUser'
);

export type ReportReason = 'offensive_profile' | 'harassment' | 'impersonation' | 'spam' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'offensive_profile', label: 'Offensive name or photo' },
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

export async function reportUser(uid: string, reason: ReportReason, details: string) {
  await reportUserFn({ uid, reason, details });
}
