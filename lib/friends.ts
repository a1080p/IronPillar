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
