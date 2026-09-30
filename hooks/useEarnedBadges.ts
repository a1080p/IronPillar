import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { badges as badgeCatalog } from '../data/badges';
import type { Badge } from '../types/models';

export function useEarnedBadges(uid: string | undefined) {
  const [earned, setEarned] = useState<Badge[]>([]);
  // badge id -> ISO date it was earned
  const [earnedAt, setEarnedAt] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'badges'), orderBy('earnedAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEarned(
          snap.docs
            .map((d) => badgeCatalog[d.id])
            .filter((b): b is Badge => !!b)
        );
        setEarnedAt(
          Object.fromEntries(
            snap.docs.map((d) => {
              const at = d.get('earnedAt');
              return [d.id, at && typeof at.toDate === 'function' ? at.toDate().toISOString() : null];
            })
          )
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  return { earned, earnedAt, loading };
}
