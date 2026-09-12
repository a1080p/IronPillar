import type { WorkoutLog } from '../types/models';

// Logs come back newest-first (see useWorkoutLogs), but the same workout can
// appear many times — keep only each workout's most recent completion, for
// quick-access "jump back in" rows.
export function dedupeRecentWorkouts(logs: WorkoutLog[], max = 5): WorkoutLog[] {
  const seen = new Set<string>();
  const recent: WorkoutLog[] = [];
  for (const log of logs) {
    if (seen.has(log.workoutId)) continue;
    seen.add(log.workoutId);
    recent.push(log);
    if (recent.length === max) break;
  }
  return recent;
}
