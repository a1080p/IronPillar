import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { WearableSnapshot } from '../types/models';

export function useWearableSnapshot(uid: string | undefined) {
  const [snapshot, setSnapshot] = useState<WearableSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(
      doc(db, 'wearableSnapshots', uid),
      (snap) => {
        setSnapshot(snap.exists() ? (snap.data() as WearableSnapshot) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  return { snapshot, loading };
}
