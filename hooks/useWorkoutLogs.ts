import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { WorkoutLog } from '../types/models';

export function useWorkoutLogs(uid: string | undefined) {
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'workoutLogs', uid, 'logs'), orderBy('completedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setLogs(snap.docs.map((d) => d.data() as WorkoutLog));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  return { logs, loading };
}
