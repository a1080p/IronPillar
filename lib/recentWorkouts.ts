import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutLog } from '../types/models';

// Logs come back newest-first (see useWorkoutLogs), but the same workout can
// appear many times — keep only each workout's most recent completion, for
// quick-access "jump back in" rows. Outdoor activities (walk/run/bike) get a
// fresh synthetic workoutId every session (see completeOutdoorActivity), so
// deduping on workoutId alone never collapsed repeat walks/runs into one card
// — key those on activityType instead, so "Walk" shows once no matter how
// many times it's been logged.
export function recentKey(log: WorkoutLog): string {
  return log.workoutSource === 'outdoor' && log.activityType
    ? `outdoor:${log.activityType}`
    : log.workoutId;
}

// `hidden` maps a recentKey to when the user hid it from Recent Workouts:
// completions up to then stay hidden, but doing that workout again brings
// it back.
export function dedupeRecentWorkouts(
  logs: WorkoutLog[],
  max = 5,
  hidden: Record<string, string> = {}
): WorkoutLog[] {
  const seen = new Set<string>();
  const recent: WorkoutLog[] = [];
  for (const log of logs) {
    const key = recentKey(log);
    const hiddenAt = hidden[key];
    if (hiddenAt && log.completedAt <= hiddenAt) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    recent.push(log);
    if (recent.length === max) break;
  }
  return recent;
}

const hiddenStorageKey = (uid: string) => `recentHidden:${uid}`;

export async function loadHiddenRecents(uid: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(hiddenStorageKey(uid));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function hideRecent(uid: string, log: WorkoutLog): Promise<Record<string, string>> {
  const hidden = await loadHiddenRecents(uid);
  hidden[recentKey(log)] = new Date().toISOString();
  await AsyncStorage.setItem(hiddenStorageKey(uid), JSON.stringify(hidden));
  return hidden;
}
