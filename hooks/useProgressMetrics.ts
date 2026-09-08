import { useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { ProgressMetric } from '../types/models';

export function useProgressMetrics(uid: string | undefined) {
  const [metrics, setMetrics] = useState<ProgressMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'users', uid, 'metrics'), orderBy('recordedAt', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setMetrics(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ProgressMetric));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  async function addMetric(uid: string, bmi: number, bodyFatPercent: number) {
    await addDoc(collection(db, 'users', uid, 'metrics'), {
      recordedAt: new Date().toISOString(),
      bmi,
      bodyFatPercent,
    });
  }

  return { metrics, loading, addMetric };
}
