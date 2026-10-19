import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseLog, LoggedSet } from '../types/models';

// A strength workout in progress, saved on the device as it changes so leaving
// the logger (or the app being closed) doesn't lose the sets. One per user:
// starting a different workout replaces it. Dropped after DRAFT_MAX_AGE_MS
// without a change, and as soon as the workout is finished or discarded.
export const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// What's typed for one exercise. Weights are in the user's display unit, as
// typed; they're converted to pounds only when the exercise is finished.
export interface ExerciseWork {
  sets: LoggedSet[];
  weightText: Record<number, string>;
  done: boolean[];
}

export interface WorkoutDraft {
  version: 1;
  workoutId: string;
  workoutName: string;
  savedAt: number;
  elapsedSeconds: number; // time spent in the logger; paused while away
  order: number[];
  position: number;
  completed: Record<string, ExerciseLog>; // finished exercises, weights in lb
  work: Record<string, ExerciseWork>; // by template exercise id
  swaps: Record<string, string>; // template exercise id -> catalog id
  skippedIds: string[];
  restSeconds: number;
}

const key = (uid: string) => `workout_draft_${uid}`;

export async function loadWorkoutDraft(uid: string, workoutId?: string): Promise<WorkoutDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(uid));
    if (!raw) return null;
    const draft = JSON.parse(raw) as WorkoutDraft;
    if (draft.version !== 1 || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      await AsyncStorage.removeItem(key(uid));
      return null;
    }
    if (workoutId && draft.workoutId !== workoutId) return null;
    return draft;
  } catch {
    return null;
  }
}

export async function saveWorkoutDraft(uid: string, draft: Omit<WorkoutDraft, 'version' | 'savedAt'>) {
  try {
    await AsyncStorage.setItem(key(uid), JSON.stringify({ ...draft, version: 1, savedAt: Date.now() }));
  } catch {
    // Best effort: a failed save only means less to resume.
  }
}

export async function clearWorkoutDraft(uid: string) {
  await AsyncStorage.removeItem(key(uid)).catch(() => {});
}
