import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { CustomWorkout, ExerciseSpec } from '../types/models';

export function useCustomWorkouts(uid: string | undefined) {
  const [customWorkouts, setCustomWorkouts] = useState<CustomWorkout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = onSnapshot(
      collection(db, 'userWorkouts', uid, 'customWorkouts'),
      (snap) => {
        setCustomWorkouts(snap.docs.map((d) => d.data() as CustomWorkout));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid]);

  return { customWorkouts, loading };
}

export async function createCustomWorkout(
  uid: string,
  name: string,
  exercises: ExerciseSpec[]
): Promise<string> {
  const col = collection(db, 'userWorkouts', uid, 'customWorkouts');
  const ref = doc(col);
  const workout: CustomWorkout = {
    id: ref.id,
    name,
    durationMinutes: Math.max(10, exercises.length * 5),
    caloriesRangeLabel: 'Varies',
    equipmentRequired: false,
    category: 'custom',
    tags: [],
    workoutTips: [],
    equipment: [],
    exercises,
    createdBy: uid,
  };
  await setDoc(ref, workout);
  return ref.id;
}
