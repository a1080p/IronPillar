import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';

const deleteAccountFn = httpsCallable<void, { success: boolean }>(functions, 'deleteAccount');

export async function deleteAccount() {
  await deleteAccountFn();
}

const changeUsernameFn = httpsCallable<{ username: string }, { username: string }>(functions, 'changeUsername');

// Claims a new username; the server refuses one that someone else has.
export async function changeUsername(username: string) {
  const { data } = await changeUsernameFn({ username });
  return data.username;
}
