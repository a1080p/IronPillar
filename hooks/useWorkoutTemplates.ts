import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { WorkoutTemplate } from '../types/models';

export function useWorkoutTemplates() {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'workoutTemplates'),
      (snap) => {
        setTemplates(snap.docs.map((d) => d.data() as WorkoutTemplate));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, []);

  return { templates, loading };
}

export function useWorkoutTemplate(id: string | undefined) {
  const { templates, loading } = useWorkoutTemplates();
  const template = templates.find((t) => t.id === id);
  return { template, loading };
}
