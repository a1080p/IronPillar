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
