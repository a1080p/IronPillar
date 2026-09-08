import type { ExerciseLog, WorkoutLog } from '../types/models';

// Everything here is derived on the client from the workoutLogs the
// completeWorkout Cloud Function already stores (name, timestamp,
// durationSeconds, and the full per-set reps/weight/duration payload).
// No extra data needs to be collected — the log has it all.

export interface LogSummary {
  volume: number; // Σ reps × weight, in lb
  reps: number; // Σ reps across weighted/bodyweight sets
  sets: number; // sets with any value entered
  activeSeconds: number; // Σ seconds across timed sets
  exercises: number;
  minutes: number; // wall-clock workout length
}

export interface ExerciseTotals {
  volume: number;
  reps: number;
  sets: number;
  activeSeconds: number;
}

export function summarizeExerciseLogs(exercises: ExerciseLog[]): ExerciseTotals {
  let volume = 0;
  let reps = 0;
  let sets = 0;
  let activeSeconds = 0;

  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      const hasValue =
        set.reps != null || set.weight != null || set.durationSeconds != null;
      if (hasValue) sets += 1;
      if (set.reps != null) reps += set.reps;
      if (set.reps != null && set.weight != null) volume += set.reps * set.weight;
      if (set.durationSeconds != null) activeSeconds += set.durationSeconds;
    }
  }

  return { volume, reps, sets, activeSeconds };
}

export function summarizeLog(log: WorkoutLog): LogSummary {
  return {
    ...summarizeExerciseLogs(log.exercises),
    exercises: log.exercises.length,
    minutes: Math.round(log.durationSeconds / 60),
  };
}

export interface AllTimeStats {
  workouts: number;
  volume: number;
  minutes: number;
  reps: number;
  sets: number;
}

export function allTimeStats(logs: WorkoutLog[]): AllTimeStats {
  return logs.reduce<AllTimeStats>(
    (acc, log) => {
      const s = summarizeLog(log);
      acc.workouts += 1;
      acc.volume += s.volume;
      acc.minutes += s.minutes;
      acc.reps += s.reps;
      acc.sets += s.sets;
      return acc;
    },
    { workouts: 0, volume: 0, minutes: 0, reps: 0, sets: 0 }
  );
}

// Monday-aligned start of the week containing `d`, at local midnight.
export function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const mondayOffset = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

export interface WeekBucket {
  start: Date;
  label: string; // "M/D"
  workouts: number;
  volume: number;
  minutes: number;
}

export function weeklyBuckets(logs: WorkoutLog[], weeks = 8): WeekBucket[] {
  const thisWeek = weekStart(new Date());
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    buckets.push({
      start,
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      workouts: 0,
      volume: 0,
      minutes: 0,
    });
  }

  const earliest = buckets[0].start.getTime();
  for (const log of logs) {
    const ws = weekStart(new Date(log.completedAt)).getTime();
    if (ws < earliest) continue;
    const index = Math.round((ws - earliest) / (7 * 24 * 60 * 60 * 1000));
    const bucket = buckets[index];
    if (!bucket) continue;
    const s = summarizeLog(log);
    bucket.workouts += 1;
    bucket.volume += s.volume;
    bucket.minutes += s.minutes;
  }

  return buckets;
}

export interface WeekComparison {
  thisWeek: { workouts: number; volume: number; minutes: number };
  lastWeek: { workouts: number; volume: number; minutes: number };
}

export function thisWeekVsLast(logs: WorkoutLog[]): WeekComparison {
  const buckets = weeklyBuckets(logs, 2);
  const [last, current] = buckets;
  return {
    thisWeek: { workouts: current.workouts, volume: current.volume, minutes: current.minutes },
    lastWeek: { workouts: last.workouts, volume: last.volume, minutes: last.minutes },
  };
}

export interface PersonalRecord {
  exerciseName: string;
  weight: number;
  reps: number;
  estimatedOneRepMax: number; // Epley: w × (1 + reps/30)
  achievedAt: string;
}

export function personalRecords(logs: WorkoutLog[], limit = 5): PersonalRecord[] {
  const best = new Map<string, PersonalRecord>();

  for (const log of logs) {
    for (const exercise of log.exercises) {
      for (const set of exercise.sets) {
        if (!set.weight || !set.reps) continue;
        const oneRm = set.weight * (1 + set.reps / 30);
        const key = exercise.exerciseName.toLowerCase();
        const existing = best.get(key);
        if (!existing || oneRm > existing.estimatedOneRepMax) {
          best.set(key, {
            exerciseName: exercise.exerciseName,
            weight: set.weight,
            reps: set.reps,
            estimatedOneRepMax: Math.round(oneRm),
            achievedAt: log.completedAt,
          });
        }
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => b.estimatedOneRepMax - a.estimatedOneRepMax)
    .slice(0, limit);
}

export function formatVolume(lb: number): string {
  if (lb >= 1000) return `${(lb / 1000).toFixed(lb >= 10000 ? 0 : 1)}k`;
  return String(Math.round(lb));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
