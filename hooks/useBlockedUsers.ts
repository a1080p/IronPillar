import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export interface BlockedUser {
  uid: string;
  name: string;
  username: string;
  since: string;
}

export function useBlockedUsers(uid: string | undefined) {
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      collection(db, 'blocks', uid, 'blocked'),
      (snap) => {
        setBlocked(snap.docs.map((d) => d.data() as BlockedUser));
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [uid]);

  return { blocked, loading };
}
