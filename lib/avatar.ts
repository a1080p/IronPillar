import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase/config';

// Uploads a locally-picked image to `avatars/<uid>` and returns its public
// download URL. Overwrites any previous photo for the same user.
export async function uploadAvatar(uid: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const objectRef = ref(storage, `avatars/${uid}`);
  await uploadBytes(objectRef, blob, { contentType: blob.type || 'image/jpeg' });
  return getDownloadURL(objectRef);
}

// Removes a user's uploaded avatar photo. Safe to call when none exists.
export async function deleteAvatar(uid: string): Promise<void> {
  try {
    await deleteObject(ref(storage, `avatars/${uid}`));
  } catch (e) {
    // object-not-found is fine — nothing to clean up.
    if (e instanceof Error && 'code' in e && (e as { code?: string }).code === 'storage/object-not-found') {
      return;
    }
    throw e;
  }
}
