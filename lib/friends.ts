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
