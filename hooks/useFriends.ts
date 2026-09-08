import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { Friend } from '../types/models';

export function useFriends(uid: string | undefined) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'friendships', uid, 'friends'), orderBy('since', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setFriends(snap.docs.map((d) => d.data() as Friend));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  return { friends, loading };
}
