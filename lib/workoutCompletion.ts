import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';
import { deviceTimeZone } from '../constants/gamification';
import type { ExerciseLog, OutdoorActivityType, RoutePoint } from '../types/models';

export interface XpBreakdown {
  exercises: number;
  exerciseXp: number;
  sets: number;
  setXp: number;
  distanceXp: number;
  prBonus?: number; // personal records; absent from older functions
  improvements?: { label: string; xp: number }[]; // ways this beat last time
  baseStreakBonus: number; // before the Pro multiplier
}

export interface PersonalRecordResult {
  exerciseName: string;
  weight: number; // lb
  reps: number;
  estimatedOneRepMax: number;
  previousOneRepMax: number;
}

export interface CompletionResult {
  xpEarned: number;
  streakBonus: number; // after the Pro multiplier
  streakCountAfter: number;
  badgeEarnedId: string | null;
  // The three below are absent from older functions.
  badgesEarned?: string[]; // every badge this workout unlocked
  personalRecords?: PersonalRecordResult[];
  levelBefore?: number;
  levelAfter?: number;
  xpMultiplier?: number; // 2 for Pro subscribers; absent from older functions
  breakdown?: XpBreakdown; // absent from older functions
  dayMinutes?: number; // today's combined workout minutes, this one included
  dayMinutesBefore?: number; // the same, before this workout
  minStreakDayMinutes?: number; // minutes a day needs to count toward the streak
  dayCountedNow?: boolean; // this workout pushed today over the threshold
  dayAlreadyCounted?: boolean; // today had already counted before this workout
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
    timeZone?: string;
  },
  CompletionResult
>(functions, 'completeWorkout');

// Streak/XP/badges are computed server-side (see functions/src/index.ts) —
// the client only reports what was done, it can't set the resulting numbers.
// The time zone only tells the server whose midnight to use; "now" is still
// the server's clock.
export async function completeWorkout(
  workout: CompletedWorkoutRef,
  exerciseLogs: ExerciseLog[],
  durationSeconds: number
): Promise<CompletionResult> {
  const { data } = await completeWorkoutFn({
    workout,
    exercises: exerciseLogs,
    durationSeconds,
    timeZone: deviceTimeZone(),
  });
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
    timeZone: deviceTimeZone(),
  });
  return data;
}

const deleteWorkoutLogFn = httpsCallable<{ logId: string }, { deleted: boolean; xpRemoved: number }>(
  functions,
  'deleteWorkoutLog'
);

// Deletes one of your own logged workouts. The server also takes back the XP
// it earned; past streak days are kept.
export async function deleteWorkoutLog(logId: string) {
  const { data } = await deleteWorkoutLogFn({ logId });
  return data;
}
