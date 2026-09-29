import type { WorkoutLog } from '../types/models';
import { summarizeLog, weekStart } from './workoutStats';

// Pro "Insights" math (plus the free consistency calendar and "last time"
// hint). Like workoutStats, everything is derived on the client from the
// workoutLogs the completeWorkout Cloud Function already stores.

const DAY_MS = 24 * 60 * 60 * 1000;

const epley = (weight: number, reps: number) => weight * (1 + reps / 30);

export interface ExerciseSession {
  at: number; // ms since epoch
  bestE1rm: number;
  topWeight: number;
  repsAtTopWeight: number[]; // every set performed at topWeight, in order
  volume: number;
}

export interface ExerciseHistory {
  name: string;
  sessions: ExerciseSession[]; // oldest first
}

// Weighted exercise history keyed by case-insensitive name, most-trained first.
export function exerciseHistories(logs: WorkoutLog[]): ExerciseHistory[] {
  const byName = new Map<string, ExerciseHistory>();

  for (const log of logs) {
    const at = new Date(log.completedAt).getTime();
    for (const exercise of log.exercises) {
      const weighted = exercise.sets.filter((s) => s.weight && s.reps);
      if (weighted.length === 0) continue;

      const topWeight = Math.max(...weighted.map((s) => s.weight!));
      const session: ExerciseSession = {
        at,
        bestE1rm: Math.round(Math.max(...weighted.map((s) => epley(s.weight!, s.reps!)))),
        topWeight,
        repsAtTopWeight: weighted.filter((s) => s.weight === topWeight).map((s) => s.reps!),
        volume: weighted.reduce((sum, s) => sum + s.weight! * s.reps!, 0),
      };

      const key = exercise.exerciseName.trim().toLowerCase();
      const entry = byName.get(key) ?? { name: exercise.exerciseName.trim(), sessions: [] };
      entry.sessions.push(session);
      byName.set(key, entry);
    }
  }

  for (const entry of byName.values()) entry.sessions.sort((a, b) => a.at - b.at);
  return [...byName.values()].sort((a, b) => b.sessions.length - a.sessions.length);
}

export interface ProgressionTarget {
  weight: number;
  reps: number;
  action: 'add_weight' | 'add_rep';
  reason: string;
}

// Next-session target by double progression: if every set at last session's
// top weight held the first set's rep count (no drop-off) and that count was
// at least 5, the weight is ready to go up. Otherwise stay put and add a rep
// to the sets that fell short.
export function nextTarget(history: ExerciseHistory): ProgressionTarget | null {
  const last = history.sessions[history.sessions.length - 1];
  if (!last || last.repsAtTopWeight.length === 0) return null;

  const firstSetReps = last.repsAtTopWeight[0];
  const minReps = Math.min(...last.repsAtTopWeight);
  const increment = last.topWeight >= 50 ? 5 : 2.5;

  if (minReps >= firstSetReps && firstSetReps >= 5) {
    return {
      weight: last.topWeight + increment,
      reps: Math.max(5, firstSetReps - 2),
      action: 'add_weight',
      reason: `You held ${firstSetReps} reps on every set at ${last.topWeight} lb.`,
    };
  }
  return {
    weight: last.topWeight,
    reps: Math.min(firstSetReps, minReps + 1),
    action: 'add_rep',
    reason:
      minReps < firstSetReps
        ? `Reps dropped to ${minReps} on later sets — own this weight first.`
        : 'Build up to at least 5 clean reps before adding weight.',
  };
}

// Stalled = at least 4 sessions and the best of the last 3 is no better than
// the best before them.
export function isPlateaued(history: ExerciseHistory): boolean {
  const s = history.sessions;
  if (s.length < 4) return false;
  const recentBest = Math.max(...s.slice(-3).map((x) => x.bestE1rm));
  const priorBest = Math.max(...s.slice(0, -3).map((x) => x.bestE1rm));
  return recentBest <= priorBest;
}

// % change in best estimated 1RM: last `days` vs everything before that.
export function e1rmChangePct(history: ExerciseHistory, days = 30): number | null {
  const cutoff = Date.now() - days * DAY_MS;
  const before = history.sessions.filter((s) => s.at < cutoff);
  const recent = history.sessions.filter((s) => s.at >= cutoff);
  if (before.length === 0 || recent.length === 0) return null;
  const a = Math.max(...before.map((s) => s.bestE1rm));
  const b = Math.max(...recent.map((s) => s.bestE1rm));
  return a > 0 ? Math.round(((b - a) / a) * 100) : null;
}

export function e1rmSeries(history: ExerciseHistory, limit = 12) {
  return history.sessions.slice(-limit).map((s) => {
    const d = new Date(s.at);
    return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: s.bestE1rm };
  });
}

export interface TrainingMix {
  strength: number;
  timed: number;
  outdoor: number;
}

export function trainingMix(logs: WorkoutLog[]): TrainingMix {
  const mix: TrainingMix = { strength: 0, timed: 0, outdoor: 0 };
  for (const log of logs) {
    if (log.workoutSource === 'outdoor') mix.outdoor += 1;
    else if (log.exercises.some((e) => e.logType === 'reps_weight')) mix.strength += 1;
    else mix.timed += 1;
  }
  return mix;
}

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

export function timeOfDayBreakdown(logs: WorkoutLog[]): { label: TimeOfDay; value: number }[] {
  const counts: Record<TimeOfDay, number> = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
  for (const log of logs) {
    const h = new Date(log.completedAt).getHours();
    if (h >= 5 && h < 12) counts.Morning += 1;
    else if (h >= 12 && h < 17) counts.Afternoon += 1;
    else if (h >= 17 && h < 22) counts.Evening += 1;
    else counts.Night += 1;
  }
  return (Object.keys(counts) as TimeOfDay[]).map((label) => ({ label, value: counts[label] }));
}

// Empty Monday-aligned week buckets ending with the current week.
function emptyWeeks(weeks: number) {
  const thisWeek = weekStart(new Date());
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (weeks - 1 - i) * 7);
    return { start: start.getTime(), label: `${start.getMonth() + 1}/${start.getDate()}`, value: 0 };
  });
}

export function outdoorMilesByWeek(logs: WorkoutLog[], weeks = 8) {
  const buckets = emptyWeeks(weeks);
  for (const log of logs) {
    if (log.workoutSource !== 'outdoor' || !log.distanceMeters) continue;
    const ws = weekStart(new Date(log.completedAt)).getTime();
    const bucket = buckets.find((b) => b.start === ws);
    if (bucket) bucket.value += log.distanceMeters / 1609.344;
  }
  return buckets.map(({ label, value }) => ({ label, value: Math.round(value * 10) / 10 }));
}

export function weeklyMinutes(logs: WorkoutLog[], weeks = 12) {
  const buckets = emptyWeeks(weeks);
  for (const log of logs) {
    const ws = weekStart(new Date(log.completedAt)).getTime();
    const bucket = buckets.find((b) => b.start === ws);
    if (bucket) bucket.value += summarizeLog(log).minutes;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

// ---- Free: consistency calendar ------------------------------------------

export interface CalendarDay {
  date: Date;
  count: number;
  isFuture: boolean;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// `weeks` columns of Monday→Sunday days ending with the current week, for a
// GitHub-style consistency grid. Days are local-calendar days.
export function activityCalendar(logs: WorkoutLog[], weeks = 12): CalendarDay[][] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const key = dayKey(new Date(log.completedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstMonday = weekStart(today);
  firstMonday.setDate(firstMonday.getDate() - (weeks - 1) * 7);

  const columns: CalendarDay[][] = [];
  for (let w = 0; w < weeks; w += 1) {
    const column: CalendarDay[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(firstMonday);
      date.setDate(firstMonday.getDate() + w * 7 + d);
      column.push({ date, count: counts.get(dayKey(date)) ?? 0, isFuture: date > today });
    }
    columns.push(column);
  }
  return columns;
}

// Distinct local days trained in the last `days` days.
export function activeDays(logs: WorkoutLog[], days = 30): number {
  const cutoff = Date.now() - days * DAY_MS;
  const set = new Set<string>();
  for (const log of logs) {
    const d = new Date(log.completedAt);
    if (d.getTime() >= cutoff) set.add(dayKey(d));
  }
  return set.size;
}

// ---- Free: "last time" hint during logging -------------------------------

// The sets logged for this exercise in the most recent workout that included
// it (logs arrive newest-first from useWorkoutLogs).
export function lastPerformance(logs: WorkoutLog[], exerciseName: string) {
  const key = exerciseName.trim().toLowerCase();
  for (const log of logs) {
    const match = log.exercises.find((e) => e.exerciseName.trim().toLowerCase() === key);
    if (match && match.sets.some((s) => s.reps != null || s.durationSeconds != null)) {
      return { completedAt: log.completedAt, sets: match.sets };
    }
  }
  return null;
}
