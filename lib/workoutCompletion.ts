import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';
import type { ExerciseLog } from '../types/models';

export interface CompletionResult {
  xpEarned: number;
  streakBonus: number;
  streakCountAfter: number;
  badgeEarnedId: string | null;
}

export interface CompletedWorkoutRef {
  id: string;
  name: string;
  category: 'preset' | 'quick_start' | 'browse' | 'custom';
}

const completeWorkoutFn = httpsCallable<
  {
    workout: CompletedWorkoutRef;
    exercises: ExerciseLog[];
    durationSeconds: number;
  },
  CompletionResult
>(functions, 'completeWorkout');

// Streak/XP/badges are computed server-side (see functions/src/index.ts) —
// the client only reports what was done, it can't set the resulting numbers.
export async function completeWorkout(
  workout: CompletedWorkoutRef,
  exerciseLogs: ExerciseLog[],
  durationSeconds: number
): Promise<CompletionResult> {
  const { data } = await completeWorkoutFn({ workout, exercises: exerciseLogs, durationSeconds });
  return data;
}
