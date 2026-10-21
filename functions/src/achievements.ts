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

// Template exercises that were renamed to their exercise-catalog name
// (data/exercises.ts in the app lists these as aliases). Personal-record
// bests are keyed by lowercase name, so a best stored under an old name is
// carried over to the new one; without this the first workout after the
// rename would count as a brand-new record.
const RENAMED_EXERCISES: Record<string, string> = {
  'bent-over barbell row': 'barbell bent-over row',
  'conventional deadlift': 'barbell deadlift',
  'overhead press (standing)': 'barbell overhead press',
  'dumbbell incline press': 'incline dumbbell press',
  'front plank': 'plank',
  'pull-ups (or lat pulldown)': 'pull-ups',
  'dumbbell rows (single arm)': 'single-arm dumbbell row',
};

function exerciseKey(name: string) {
  const key = name.trim().toLowerCase();
  return RENAMED_EXERCISES[key] ?? key;
}

// Moves bests stored under old names onto the current name, keeping the
// higher of the two.
function mergeRenamedBests(bests: Record<string, number>): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const [name, best] of Object.entries(bests)) {
    const key = exerciseKey(name);
    merged[key] = Math.max(merged[key] ?? 0, best);
  }
  return merged;
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
  const next: UserStats = {
    ...stats,
    bests: mergeRenamedBests(stats.bests),
    workoutIds: [...stats.workoutIds],
  };
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
    const key = exerciseKey(exercise.exerciseName);
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

  // Week streaks: consecutive weeks the weekly goal was hit. (The old
  // daily-streak badges, streak-3 … streak-365, are no longer awarded; the
  // app still shows them to people who earned them.)
  rule('weeks-2', 'Back to Back', 'streak', 2),
  rule('weeks-4', 'A Month Strong', 'streak', 4),
  rule('weeks-8', 'Two Months Strong', 'streak', 8),
  rule('weeks-12', 'A Season of Iron', 'streak', 12),
  rule('weeks-26', 'Half a Year', 'streak', 26),
  rule('weeks-52', 'A Year Strong', 'streak', 52),

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
export function qualifyingBadgeIds(stats: UserStats, longestWeekStreak: number, level: number): string[] {
  const values: Record<Metric, number> = {
    workouts: stats.workoutCount,
    streak: longestWeekStreak,
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

// A set counts once something was actually logged for it. Rows left blank on
// the logging screen earn nothing.
export function isCompletedSet(set: LoggedSet | undefined) {
  return !!set && ((Number(set.reps) || 0) > 0 || (Number(set.durationSeconds) || 0) > 0);
}

export interface WorkoutTotals {
  exercisesDone: number; // exercises with at least one completed set
  setsDone: number;
  reps: number;
  volumeLb: number;
  holdSeconds: number;
}

export function workoutTotals(exercises: ExerciseLog[] | undefined): WorkoutTotals {
  const totals: WorkoutTotals = { exercisesDone: 0, setsDone: 0, reps: 0, volumeLb: 0, holdSeconds: 0 };
  for (const exercise of exercises ?? []) {
    let done = 0;
    for (const set of exercise.sets ?? []) {
      if (!isCompletedSet(set)) continue;
      done += 1;
      const reps = Number(set.reps) || 0;
      totals.reps += reps;
      totals.volumeLb += reps * (Number(set.weight) || 0);
      totals.holdSeconds += Number(set.durationSeconds) || 0;
    }
    totals.setsDone += done;
    if (done > 0) totals.exercisesDone += 1;
  }
  return totals;
}

export interface Improvement {
  label: string;
  xp: number;
}

export interface ComparableWorkout {
  exercises: ExerciseLog[];
  durationSeconds: number;
  distanceMeters: number;
}

export const XP_PER_IMPROVEMENT = 30;
export const XP_PER_PERSONAL_RECORD = 50;
// Pace is only compared once both efforts are long enough to mean something.
const MIN_PACE_DISTANCE_METERS = 400;

// The ways this workout beat the last time the same workout (or the same kind
// of outdoor activity) was done. Each one earns a bonus.
export function improvementsOver(
  current: ComparableWorkout,
  previous: ComparableWorkout | null,
  isOutdoor: boolean
): Improvement[] {
  if (!previous) return [];
  const improvements: Improvement[] = [];
  const add = (label: string) => improvements.push({ label, xp: XP_PER_IMPROVEMENT });

  if (isOutdoor) {
    if (previous.distanceMeters > 0 && current.distanceMeters > previous.distanceMeters) {
      add('Went farther than last time');
    }
    if (
      current.distanceMeters >= MIN_PACE_DISTANCE_METERS &&
      previous.distanceMeters >= MIN_PACE_DISTANCE_METERS &&
      current.durationSeconds > 0 &&
      previous.durationSeconds > 0 &&
      current.durationSeconds / current.distanceMeters < previous.durationSeconds / previous.distanceMeters
    ) {
      add('Faster pace than last time');
    }
    return improvements;
  }

  const now = workoutTotals(current.exercises);
  const before = workoutTotals(previous.exercises);
  if (before.volumeLb > 0 && now.volumeLb > before.volumeLb) add('Moved more weight than last time');
  if (before.reps > 0 && now.reps > before.reps) add('More reps than last time');
  if (before.holdSeconds > 0 && now.holdSeconds > before.holdSeconds) add('Longer holds than last time');
  if (before.setsDone > 0 && now.setsDone > before.setsDone) add('More sets than last time');
  return improvements;
}

// ---- Weekly goal --------------------------------------------------------
// The streak counts weeks, not days: a week counts once the user logs their
// weekly goal of workouts (2-6, their choice) in it. Rest days cost nothing.
// One missed week a calendar month is forgiven automatically (a "shield").
// Weeks start on Monday, in the user's own time zone.

export const WEEKLY_GOAL_MIN = 2;
export const WEEKLY_GOAL_MAX = 6;
export const WEEKLY_GOAL_DEFAULT = 3;
// A workout counts toward the week with at least one completed set, or, for
// timed activities like walks and yoga, this long.
export const MIN_GOAL_WORKOUT_SECONDS = 10 * 60;
export const XP_WEEK_GOAL = 100;
export const XP_PER_WEEK_STREAK = 25; // extra per week of streak, capped below
const MAX_WEEK_STREAK_BONUS_STEPS = 8;

export function clampWeeklyGoal(goal: unknown): number {
  // Number(null) and Number('') are 0, which would clamp to 2, not the default.
  if (goal == null || goal === '') return WEEKLY_GOAL_DEFAULT;
  const n = Math.round(Number(goal));
  if (!Number.isFinite(n)) return WEEKLY_GOAL_DEFAULT;
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, n));
}

// yyyy-mm-dd shifted by whole days (pure calendar arithmetic).
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The Monday of the week `date` (yyyy-mm-dd) falls in.
export function weekStartOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dayOfWeek + 6) % 7));
}

export interface WeekState {
  weekStart?: string | null; // Monday of the week weekCount belongs to
  weekCount?: number; // workouts counted that week
  weekGoal?: number; // the goal locked in for that week
  streakCount?: number; // weeks in a row the goal was hit
  longestWeekStreak?: number;
  lastGoalWeek?: string | null; // Monday of the last week the goal was hit
  shieldMonth?: string | null; // yyyy-mm a shield was last used in
}

// Whether a missed week can still be forgiven when `weekStart`'s week hits
// its goal: the week before it was missed, the one before that was hit, and
// no shield has been used this calendar month.
function shieldCovers(state: WeekState, weekStart: string) {
  return (
    state.lastGoalWeek === addDays(weekStart, -14) &&
    state.shieldMonth !== weekStart.slice(0, 7)
  );
}

// The week streak as of `today`: still alive if last week (or this week) hit
// the goal, or if a shield can still cover a single missed week.
export function activeWeekStreak(state: WeekState, today: string): number {
  const count = state.streakCount ?? 0;
  const last = state.lastGoalWeek;
  if (!last || count <= 0) return 0;
  const thisWeek = weekStartOf(today);
  if (last >= addDays(thisWeek, -7)) return count;
  return shieldCovers(state, thisWeek) ? count : 0;
}

export interface WeekResult {
  next: Required<Omit<WeekState, 'shieldMonth' | 'lastGoalWeek' | 'weekStart'>> & {
    weekStart: string;
    lastGoalWeek: string | null;
    shieldMonth: string | null;
  };
  counted: boolean; // this workout counted toward the week
  goalHitNow: boolean; // this workout completed the week's goal
  shieldUsed: boolean;
  bonusXp: number; // before any Pro multiplier
}

// Applies one finished workout to the week state. `today` is the local date
// it was finished on. `weeklyGoal` is the user's current setting; a change
// only takes effect from the next week, so it can't be lowered mid-week to
// hit it.
export function applyWeekGoal(
  state: WeekState,
  today: string,
  weeklyGoal: unknown,
  workout: { setsDone: number; durationSeconds: number }
): WeekResult {
  const thisWeek = weekStartOf(today);
  // `>=`: after a westward time-zone change the stored week can be later than
  // "this" week; treat it as the same week rather than starting over.
  const sameWeek = !!state.weekStart && state.weekStart >= thisWeek;
  const weekStart = sameWeek ? (state.weekStart as string) : thisWeek;
  const weekGoal = sameWeek && state.weekGoal ? clampWeeklyGoal(state.weekGoal) : clampWeeklyGoal(weeklyGoal);
  const countBefore = sameWeek ? Math.max(0, state.weekCount ?? 0) : 0;
  const counted = workout.setsDone > 0 || workout.durationSeconds >= MIN_GOAL_WORKOUT_SECONDS;
  const weekCount = countBefore + (counted ? 1 : 0);
  const goalHitNow = counted && countBefore < weekGoal && weekCount >= weekGoal;

  let streak = activeWeekStreak(state, today);
  let lastGoalWeek = state.lastGoalWeek ?? null;
  let shieldMonth = state.shieldMonth ?? null;
  let shieldUsed = false;
  if (goalHitNow) {
    if (lastGoalWeek === addDays(weekStart, -7)) {
      streak = (state.streakCount ?? 0) + 1;
    } else if (shieldCovers(state, weekStart) && (state.streakCount ?? 0) > 0) {
      streak = (state.streakCount ?? 0) + 1;
      shieldUsed = true;
      shieldMonth = weekStart.slice(0, 7);
    } else {
      streak = 1;
    }
    lastGoalWeek = weekStart;
  }
  const bonusXp = goalHitNow
    ? XP_WEEK_GOAL + XP_PER_WEEK_STREAK * Math.min(streak - 1, MAX_WEEK_STREAK_BONUS_STEPS)
    : 0;

  return {
    next: {
      weekStart,
      weekCount,
      weekGoal,
      streakCount: streak,
      longestWeekStreak: Math.max(state.longestWeekStreak ?? 0, streak),
      lastGoalWeek,
      shieldMonth,
    },
    counted,
    goalHitNow,
    shieldUsed,
    bonusXp,
  };
}
