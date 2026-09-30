// Badge rules, lifetime stats, personal records and levels for the
// completeWorkout Cloud Function. Everything here is pure: the function reads
// the data, this decides what was earned.
//
// The badge ids and thresholds must match the client catalog in
// data/badges.ts, which holds the names, descriptions and icons shown in the
// app.

export interface LoggedSet {
  reps?: number;
  weight?: number;
  durationSeconds?: number;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  logType: 'reps_weight' | 'duration';
  sets: LoggedSet[];
}

// One workout, reduced to what the stats need.
export interface StatsWorkout {
  workoutId: string;
  isOutdoor: boolean;
  completedAt: Date;
  durationSeconds: number;
  exercises: ExerciseLog[];
  distanceMeters: number;
}

// Lifetime totals, kept in the server-only userStats/{uid} doc so a workout
// completion doesn't have to re-read the whole history.
export interface UserStats {
  version: number;
  workoutCount: number;
  prCount: number;
  totalVolumeLb: number;
  totalDistanceMeters: number;
  maxDistanceMeters: number;
  totalSeconds: number;
  maxSeconds: number;
  earlyCount: number; // workouts finished before 7 AM local
  lateCount: number; // workouts finished at or after 9 PM local
  workoutIds: string[]; // distinct non-outdoor workouts done
  bests: Record<string, number>; // exercise name (lowercase) -> best estimated 1RM, lb
}

export const STATS_VERSION = 1;
const MAX_TRACKED_WORKOUT_IDS = 60;
const EARLY_BEFORE_HOUR = 7;
const LATE_FROM_HOUR = 21;

export interface PersonalRecord {
  exerciseName: string;
  weight: number; // lb
  reps: number;
  estimatedOneRepMax: number;
  previousOneRepMax: number;
}

export function emptyStats(): UserStats {
  return {
    version: STATS_VERSION,
    workoutCount: 0,
    prCount: 0,
    totalVolumeLb: 0,
    totalDistanceMeters: 0,
    maxDistanceMeters: 0,
    totalSeconds: 0,
    maxSeconds: 0,
    earlyCount: 0,
    lateCount: 0,
    workoutIds: [],
    bests: {},
  };
}

// Same level curve as constants/gamification.ts in the app.
const FIRST_LEVEL_XP = 400;
const XP_RAMP_PER_LEVEL = 150;
const FLAT_FROM_LEVEL = 15;

function xpForLevel(level: number) {
  const step = Math.min(Math.max(level, 1), FLAT_FROM_LEVEL) - 1;
  return FIRST_LEVEL_XP + step * XP_RAMP_PER_LEVEL;
}

export function levelForXp(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}

// Epley estimate, the same formula the app's analytics use.
const epley = (weight: number, reps: number) => weight * (1 + reps / 30);

function localHour(date: Date, timeZone: string) {
  const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(date)
    .find((p) => p.type === 'hour')?.value;
  return Number(hour ?? 12);
}

// Adds one workout to the running totals and returns the personal records it
// set. An exercise's first logged weight is a baseline, not a record.
export function applyWorkout(
  stats: UserStats,
  workout: StatsWorkout,
  timeZone: string
): { stats: UserStats; personalRecords: PersonalRecord[] } {
  const next: UserStats = { ...stats, bests: { ...stats.bests }, workoutIds: [...stats.workoutIds] };
  const personalRecords: PersonalRecord[] = [];

  next.workoutCount += 1;
  const seconds = Math.max(0, workout.durationSeconds || 0);
  next.totalSeconds += seconds;
  next.maxSeconds = Math.max(next.maxSeconds, seconds);

  const distance = Math.max(0, workout.distanceMeters || 0);
  next.totalDistanceMeters += distance;
  next.maxDistanceMeters = Math.max(next.maxDistanceMeters, distance);

  const hour = localHour(workout.completedAt, timeZone);
  if (hour < EARLY_BEFORE_HOUR) next.earlyCount += 1;
  if (hour >= LATE_FROM_HOUR) next.lateCount += 1;

  if (
    !workout.isOutdoor &&
    !next.workoutIds.includes(workout.workoutId) &&
    next.workoutIds.length < MAX_TRACKED_WORKOUT_IDS
  ) {
    next.workoutIds.push(workout.workoutId);
  }

  for (const exercise of workout.exercises ?? []) {
    let sessionBest: { weight: number; reps: number; oneRm: number } | null = null;
    for (const set of exercise.sets ?? []) {
      const weight = Number(set.weight) || 0;
      const reps = Number(set.reps) || 0;
      if (weight <= 0 || reps <= 0) continue;
      next.totalVolumeLb += weight * reps;
      const oneRm = epley(weight, reps);
      if (!sessionBest || oneRm > sessionBest.oneRm) sessionBest = { weight, reps, oneRm };
    }
    if (!sessionBest || typeof exercise.exerciseName !== 'string') continue;
    const key = exercise.exerciseName.trim().toLowerCase();
    if (!key) continue;
    const previous = next.bests[key];
    if (previous === undefined) {
      next.bests[key] = sessionBest.oneRm;
    } else if (sessionBest.oneRm > previous + 0.01) {
      next.bests[key] = sessionBest.oneRm;
      next.prCount += 1;
      personalRecords.push({
        exerciseName: exercise.exerciseName,
        weight: sessionBest.weight,
        reps: sessionBest.reps,
        estimatedOneRepMax: Math.round(sessionBest.oneRm),
        previousOneRepMax: Math.round(previous),
      });
    }
  }

  return { stats: next, personalRecords };
}

type Metric =
  | 'workouts'
  | 'streak'
  | 'level'
  | 'prs'
  | 'volumeLb'
  | 'distanceMeters'
  | 'singleDistanceMeters'
  | 'seconds'
  | 'singleSeconds'
  | 'early'
  | 'late'
  | 'variety';

interface BadgeRule {
  id: string;
  name: string;
  metric: Metric;
  threshold: number;
}

const rule = (id: string, name: string, metric: Metric, threshold: number): BadgeRule => ({
  id,
  name,
  metric,
  threshold,
});

export const BADGE_RULES: BadgeRule[] = [
  rule('the-journey-begins', 'The Journey Begins', 'workouts', 1),
  rule('workouts-5', 'Finding a Rhythm', 'workouts', 5),
  rule('workouts-10', 'Double Digits', 'workouts', 10),
  rule('workouts-25', 'Committed', 'workouts', 25),
  rule('workouts-50', 'Fifty Strong', 'workouts', 50),
  rule('workouts-100', 'Century Club', 'workouts', 100),
  rule('workouts-250', 'Iron Regular', 'workouts', 250),
  rule('workouts-500', 'Pillar of Iron', 'workouts', 500),

  rule('streak-3', 'Three in a Row', 'streak', 3),
  rule('streak-7', 'One Week Strong', 'streak', 7),
  rule('streak-14', 'Two Weeks Strong', 'streak', 14),
  rule('streak-30', '30-Day Streak', 'streak', 30),
  rule('streak-60', '60-Day Streak', 'streak', 60),
  rule('streak-100', '100-Day Streak', 'streak', 100),
  rule('streak-365', 'Year of Iron', 'streak', 365),

  rule('level-5', 'Level 5', 'level', 5),
  rule('level-10', 'Level 10', 'level', 10),
  rule('level-15', 'Level 15', 'level', 15),
  rule('level-20', 'Level 20', 'level', 20),
  rule('level-25', 'Level 25', 'level', 25),
  rule('level-30', 'Level 30', 'level', 30),
  rule('level-40', 'Level 40', 'level', 40),
  rule('level-50', 'Level 50', 'level', 50),

  rule('pr-1', 'First Personal Record', 'prs', 1),
  rule('pr-5', '5 Personal Records', 'prs', 5),
  rule('pr-10', '10 Personal Records', 'prs', 10),
  rule('pr-25', '25 Personal Records', 'prs', 25),
  rule('pr-50', '50 Personal Records', 'prs', 50),

  rule('volume-10k', '10,000 lb Lifted', 'volumeLb', 10_000),
  rule('volume-50k', '50,000 lb Lifted', 'volumeLb', 50_000),
  rule('volume-100k', '100,000 lb Lifted', 'volumeLb', 100_000),
  rule('volume-250k', '250,000 lb Lifted', 'volumeLb', 250_000),
  rule('volume-500k', 'Half a Million Pounds', 'volumeLb', 500_000),
  rule('volume-1m', 'Million Pound Club', 'volumeLb', 1_000_000),

  rule('distance-first', 'Out the Door', 'distanceMeters', 1),
  rule('distance-25k', 'Road Tested', 'distanceMeters', 25_000),
  rule('distance-100k', 'Distance Builder', 'distanceMeters', 100_000),
  rule('distance-250k', 'Long Hauler', 'distanceMeters', 250_000),
  rule('distance-500k', 'Ultra Distance', 'distanceMeters', 500_000),

  rule('single-5k', '5K', 'singleDistanceMeters', 5_000),
  rule('single-10k', '10K', 'singleDistanceMeters', 10_000),
  rule('single-half', 'Half Marathon', 'singleDistanceMeters', 21_097),

  rule('time-10h', '10 Hours In', 'seconds', 10 * 3600),
  rule('time-50h', '50 Hours In', 'seconds', 50 * 3600),
  rule('time-100h', '100 Hours In', 'seconds', 100 * 3600),
  rule('time-250h', '250 Hours In', 'seconds', 250 * 3600),

  rule('session-60', 'Hour of Power', 'singleSeconds', 60 * 60),
  rule('early-bird', 'Early Bird', 'early', 5),
  rule('night-owl', 'Night Owl', 'late', 5),
  rule('variety-5', 'Explorer', 'variety', 5),
  rule('variety-15', 'Well-Rounded', 'variety', 15),
];

export const BADGE_NAMES: Record<string, string> = Object.fromEntries(
  BADGE_RULES.map((r) => [r.id, r.name])
);

// Every badge these totals qualify for, earned already or not.
export function qualifyingBadgeIds(stats: UserStats, longestStreak: number, level: number): string[] {
  const values: Record<Metric, number> = {
    workouts: stats.workoutCount,
    streak: longestStreak,
    level,
    prs: stats.prCount,
    volumeLb: stats.totalVolumeLb,
    distanceMeters: stats.totalDistanceMeters,
    singleDistanceMeters: stats.maxDistanceMeters,
    seconds: stats.totalSeconds,
    singleSeconds: stats.maxSeconds,
    early: stats.earlyCount,
    late: stats.lateCount,
    variety: stats.workoutIds.length,
  };
  return BADGE_RULES.filter((r) => values[r.metric] >= r.threshold).map((r) => r.id);
}
