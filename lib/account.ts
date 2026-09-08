import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';

const deleteAccountFn = httpsCallable<void, { success: boolean }>(functions, 'deleteAccount');

export async function deleteAccount() {
  await deleteAccountFn();
}
