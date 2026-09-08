import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { CustomWorkout, ExerciseSpec, GeneratedWorkoutDetails } from '../types/models';

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

// Merges AI-generated detail (if any) onto the user's exercise list. Per-exercise
// tips are matched back by exact name. Falls back to a rough time estimate and
// neutral labels when no detail was generated.
function buildWorkout(
  id: string,
  uid: string,
  name: string,
  exercises: ExerciseSpec[],
  details: GeneratedWorkoutDetails | null
): CustomWorkout {
  const exercisesWithTips =
    details?.exerciseTips && details.exerciseTips.length > 0
      ? exercises.map((e) => {
          const match = details.exerciseTips.find(
            (t) => t.name.toLowerCase() === e.name.toLowerCase()
          );
          return match ? { ...e, tips: match.tips } : e;
        })
      : exercises;

  const workout: CustomWorkout = {
    id,
    name,
    durationMinutes: details?.durationMinutes ?? Math.max(10, exercises.length * 5),
    caloriesRangeLabel: details?.caloriesRangeLabel ?? 'Varies',
    equipmentRequired: details?.equipmentRequired ?? false,
    category: 'custom',
    tags: [],
    workoutTips: details?.workoutTips ?? [],
    equipment: details?.equipment ?? [],
    exercises: exercisesWithTips,
    createdBy: uid,
    detailsGenerated: Boolean(details),
  };
  // Firestore rejects `undefined` — only attach overview when we actually have one.
  if (details?.overview) {
    workout.overview = details.overview;
  }
  return workout;
}

export async function createCustomWorkout(
  uid: string,
  name: string,
  exercises: ExerciseSpec[],
  details: GeneratedWorkoutDetails | null = null
): Promise<string> {
  const col = collection(db, 'userWorkouts', uid, 'customWorkouts');
  const ref = doc(col);
  await setDoc(ref, buildWorkout(ref.id, uid, name, exercises, details));
  return ref.id;
}

// Partial edit of an existing custom workout (used by the edit-details screen).
export async function updateCustomWorkout(
  uid: string,
  workoutId: string,
  patch: Partial<
    Pick<
      CustomWorkout,
      'name' | 'durationMinutes' | 'caloriesRangeLabel' | 'equipmentRequired' | 'overview' | 'workoutTips' | 'equipment'
    >
  >
): Promise<void> {
  const ref = doc(db, 'userWorkouts', uid, 'customWorkouts', workoutId);
  await updateDoc(ref, patch);
}

export async function deleteCustomWorkout(uid: string, workoutId: string): Promise<void> {
  await deleteDoc(doc(db, 'userWorkouts', uid, 'customWorkouts', workoutId));
}

// Copies an existing custom workout into a new doc ("… (Copy)").
export async function duplicateCustomWorkout(
  uid: string,
  source: CustomWorkout
): Promise<string> {
  const col = collection(db, 'userWorkouts', uid, 'customWorkouts');
  const ref = doc(col);
  const copy: CustomWorkout = {
    ...source,
    id: ref.id,
    name: `${source.name} (Copy)`,
    createdBy: uid,
  };
  await setDoc(ref, copy);
  return ref.id;
}
