import type { WorkoutLog } from '../types/models';

// Logs come back newest-first (see useWorkoutLogs), but the same workout can
// appear many times — keep only each workout's most recent completion, for
// quick-access "jump back in" rows. Outdoor activities (walk/run/bike) get a
// fresh synthetic workoutId every session (see completeOutdoorActivity), so
// deduping on workoutId alone never collapsed repeat walks/runs into one card
// — key those on activityType instead, so "Walk" shows once no matter how
// many times it's been logged.
export function dedupeRecentWorkouts(logs: WorkoutLog[], max = 5): WorkoutLog[] {
  const seen = new Set<string>();
  const recent: WorkoutLog[] = [];
  for (const log of logs) {
    const key =
      log.workoutSource === 'outdoor' && log.activityType
        ? `outdoor:${log.activityType}`
        : log.workoutId;
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(log);
    if (recent.length === max) break;
  }
  return recent;
}
