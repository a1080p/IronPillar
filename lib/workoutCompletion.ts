import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';
import type { ExerciseLog, OutdoorActivityType, RoutePoint } from '../types/models';

export interface CompletionResult {
  xpEarned: number;
  streakBonus: number;
  streakCountAfter: number;
  badgeEarnedId: string | null;
}

export interface CompletedWorkoutRef {
  id: string;
  name: string;
  category: 'preset' | 'quick_start' | 'browse' | 'custom' | 'outdoor';
}

const completeWorkoutFn = httpsCallable<
  {
    workout: CompletedWorkoutRef;
    exercises: ExerciseLog[];
    durationSeconds: number;
    activityType?: OutdoorActivityType;
    distanceMeters?: number;
    route?: RoutePoint[];
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

// Same server function, different shape — a GPS-tracked walk/run/bike has no
// exercises/sets, just a distance and route.
export async function completeOutdoorActivity(
  activityId: string,
  activityType: OutdoorActivityType,
  durationSeconds: number,
  distanceMeters: number,
  route: RoutePoint[]
): Promise<CompletionResult> {
  const names: Record<OutdoorActivityType, string> = {
    walk: 'Outdoor Walk',
    run: 'Outdoor Run',
    bike: 'Outdoor Bike Ride',
  };
  const { data } = await completeWorkoutFn({
    workout: { id: activityId, name: names[activityType], category: 'outdoor' },
    exercises: [],
    durationSeconds,
    activityType,
    distanceMeters,
    route,
  });
  return data;
}
