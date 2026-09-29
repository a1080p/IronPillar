// Finds weekly habits in a user's workout history — "legs every Friday",
// "runs on Tuesdays", or just "always trains on Mondays" — so reminders can
// speak to what the user actually does instead of a generic nudge. Pure
// functions over WorkoutLog[] (no I/O), in the same spirit as
// lib/recommendations.ts: the log history *is* the model.
import type { WorkoutLog } from '../types/models';

export type WorkoutFocus =
  | 'legs'
  | 'upper body'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'full body'
  | 'cardio'
  | 'HIIT'
  | 'yoga'
  | 'run'
  | 'walk'
  | 'bike'
  | 'swim';

export interface WorkoutPattern {
  weekday: number; // 0 = Sunday, matching Date#getDay
  // Set when the same kind of workout dominates this weekday; null means the
  // user reliably trains that day but mixes it up.
  focus: WorkoutFocus | null;
  occurrences: number; // how many of those weekdays had a workout
  typicalStartMinutes: number; // local minutes after midnight
}

// Only recent habits count — what someone did two months ago isn't a
// pattern any more if they've since changed their split.
export const PATTERN_LOOKBACK_DAYS = 56;
const MIN_OCCURRENCES = 3;
// Share of this weekday (since the user's first workout in the window) that
// must have had a workout for it to count as "their day".
const MIN_WEEKDAY_HIT_RATE = 0.6;
// Share of this weekday's workouts that must share a focus to name it.
const MIN_FOCUS_SHARE = 0.6;

// Checked in order, first match wins — so "Leg Day" is legs and "Upper Body
// Strength Builder" is upper body before any exercise-level guessing.
const NAME_KEYWORDS: [RegExp, WorkoutFocus][] = [
  [/\b(leg|legs|lower body|quad|glute|hamstring)\b/i, 'legs'],
  [/\bupper body\b/i, 'upper body'],
  [/\bfull[- ]body\b/i, 'full body'],
  [/\b(chest|push)\b/i, 'chest'],
  [/\b(back|pull)\b/i, 'back'],
  [/\bshoulder/i, 'shoulders'],
  [/\b(arm|arms|bicep|tricep)/i, 'arms'],
  [/\b(core|abs|pilates)\b/i, 'core'],
  [/\bhiit\b/i, 'HIIT'],
  [/\byoga\b/i, 'yoga'],
  [/\bswim/i, 'swim'],
  [/\b(cycl|bike|spin)/i, 'bike'],
  [/\b(run|jog)/i, 'run'],
  [/\bcardio\b/i, 'cardio'],
];

type MuscleGroup = 'legs' | 'chest' | 'back' | 'shoulders' | 'arms' | 'core';

// Core is listed first so "Leg Raises" counts as core, not legs.
const EXERCISE_KEYWORDS: [RegExp, MuscleGroup][] = [
  [/plank|crunch|sit-up|sit up|twist|leg raise|\babs?\b|hollow|dead bug/i, 'core'],
  [/squat|lunge|leg press|leg curl|leg extension|deadlift|calf|glute|hip thrust|step-up|step up/i, 'legs'],
  [/bench|chest|push-up|push up|pushup|\bfly|flye|\bdips?\b/i, 'chest'],
  [/\brow|pull-up|pull up|pullup|chin-up|pulldown/i, 'back'],
  [/overhead press|shoulder|lateral raise|front raise|arnold|face pull/i, 'shoulders'],
  [/curl|tricep|skull/i, 'arms'],
];

const UPPER_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms'];
const DOMINANT_SHARE = 0.6;

export function classifyWorkoutFocus(log: WorkoutLog): WorkoutFocus | null {
  if (log.workoutSource === 'outdoor' && log.activityType) return log.activityType;

  for (const [re, focus] of NAME_KEYWORDS) {
    if (re.test(log.workoutName)) return focus;
  }

  const counts = new Map<MuscleGroup, number>();
  for (const ex of log.exercises) {
    const match = EXERCISE_KEYWORDS.find(([re]) => re.test(ex.exerciseName));
    if (match) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const legs = counts.get('legs') ?? 0;
  const upper = UPPER_GROUPS.reduce((sum, g) => sum + (counts.get(g) ?? 0), 0);
  if (legs / total >= DOMINANT_SHARE) return 'legs';
  if (upper / total >= DOMINANT_SHARE) {
    // Name a single upper-body group only when it clearly dominates.
    for (const g of UPPER_GROUPS) {
      if ((counts.get(g) ?? 0) / total >= DOMINANT_SHARE) return g;
    }
    return 'upper body';
  }
  if ((counts.get('core') ?? 0) / total >= DOMINANT_SHARE) return 'core';
  if (legs > 0 && upper > 0) return 'full body';
  return null;
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function detectWorkoutPatterns(logs: WorkoutLog[], now = new Date()): WorkoutPattern[] {
  const cutoff = now.getTime() - PATTERN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const recent = logs.filter((l) => {
    const t = new Date(l.completedAt).getTime();
    return t >= cutoff && t <= now.getTime();
  });
  if (recent.length === 0) return [];

  // Don't hold weeks before someone joined against them — a user two weeks
  // in who's trained all three Fridays already has a Friday habit.
  const earliest = new Date(Math.min(...recent.map((l) => new Date(l.completedAt).getTime())));
  earliest.setHours(0, 0, 0, 0);

  const patterns: WorkoutPattern[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const dayLogs = recent.filter((l) => new Date(l.completedAt).getDay() === weekday);
    // One entry per calendar day — two workouts on the same Friday are one
    // Friday, not two.
    const byDate = new Map<string, WorkoutLog[]>();
    for (const l of dayLogs) {
      const key = localDateKey(new Date(l.completedAt));
      byDate.set(key, [...(byDate.get(key) ?? []), l]);
    }
    const occurrences = byDate.size;
    if (occurrences < MIN_OCCURRENCES) continue;

    let possible = 0;
    for (const d = new Date(earliest); d <= now; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === weekday) possible++;
    }
    if (possible === 0 || occurrences / possible < MIN_WEEKDAY_HIT_RATE) continue;

    const focusCounts = new Map<WorkoutFocus, number>();
    for (const sameDay of byDate.values()) {
      // Count each focus at most once per day.
      const focuses = new Set(
        sameDay.map(classifyWorkoutFocus).filter((f): f is WorkoutFocus => !!f)
      );
      focuses.forEach((f) => focusCounts.set(f, (focusCounts.get(f) ?? 0) + 1));
    }
    let focus: WorkoutFocus | null = null;
    let best = 0;
    for (const [f, n] of focusCounts) {
      if (n > best) {
        best = n;
        focus = f;
      }
    }
    if (best < MIN_OCCURRENCES || best / occurrences < MIN_FOCUS_SHARE) focus = null;

    const startMinutes = dayLogs.map((l) => {
      const start = new Date(new Date(l.completedAt).getTime() - l.durationSeconds * 1000);
      return start.getHours() * 60 + start.getMinutes();
    });

    patterns.push({
      weekday,
      focus,
      occurrences,
      typicalStartMinutes: median(startMinutes),
    });
  }
  return patterns;
}
