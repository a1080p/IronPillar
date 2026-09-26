import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { RoutePoint } from '../types/models';

// Must be defined at true module top level (not inside a component or a
// function called later) — this file is imported for its side effects at
// the very top of app/_layout.tsx, so the task is registered before iOS/
// Android need to relaunch the app in the background to deliver a location
// update, which is what lets tracking survive the screen being locked.
export const LOCATION_TASK_NAME = 'iron-pillar-outdoor-tracking';
const STORAGE_KEY = 'outdoorTracking.points';
const STARTED_AT_KEY = 'outdoorTracking.startedAt';
const PAUSED_MS_KEY = 'outdoorTracking.pausedMs';
const PAUSED_AT_KEY = 'outdoorTracking.pausedAt';

const LOCATION_UPDATE_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 3000,
  distanceInterval: 5,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Iron Pillar',
    notificationBody: 'Tracking your outdoor workout',
  },
};

type Listener = (points: RoutePoint[]) => void;
let listeners: Listener[] = [];
let buffer: RoutePoint[] = [];
// The OS can kill this app's process entirely during a long background
// session and later relaunch it *headlessly* — no screen, no mount, no
// React — purely to run this task and hand it the next location batch. On
// that fresh JS load, `buffer` above starts empty again, so without this
// hydration a headless relaunch would silently overwrite everything
// recorded before the kill with just the new points.
let hydrated = false;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  if (!hydrated) {
    hydrated = true;
    const raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
    if (raw) {
      try {
        buffer = JSON.parse(raw) as RoutePoint[];
      } catch {
        // corrupt/partial write — better to keep tracking than to throw away
        // the whole session, so fall through with an empty buffer.
      }
    }
  }
  const { locations } = data as { locations: Location.LocationObject[] };
  const newPoints: RoutePoint[] = locations.map((loc) => ({
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    t: loc.timestamp,
  }));
  buffer = [...buffer, ...newPoints];
  // Persisted on every batch (not just on stop) so a session survives the OS
  // killing the app entirely while backgrounded — restoreBufferedPoints()
  // picks this back up if the tracking screen remounts mid-run.
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buffer)).catch(() => {});
  listeners.forEach((l) => l(buffer));
});

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// Foreground permission alone is enough to see this app's own live map while
// it's open; background permission is what keeps points coming in once the
// screen locks or another app comes forward — both are asked for up front so
// the user isn't surprised by a second prompt mid-run.
export async function requestTrackingPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.granted;
}

// Starts a session, or reattaches to one already running. Location tracking
// keeps running natively even across the tracking screen being unmounted or
// the whole process being killed and relaunched — calling this unconditionally
// on every screen mount used to wipe out an in-progress session's buffer and
// start time every time. Returns the session's actual start time (ms epoch)
// so the screen can show a correct elapsed time immediately, even after a
// remount.
export async function startTracking(): Promise<number> {
  const alreadyRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (alreadyRunning) {
    const existing = await AsyncStorage.getItem(STARTED_AT_KEY);
    if (existing) return Number(existing);
    // Tracking is running but we somehow never recorded a start time (should
    // not normally happen) — treat "now" as the start rather than lose the
    // session entirely.
  }

  const startedAt = Date.now();
  if (!alreadyRunning) {
    buffer = [];
    hydrated = true; // nothing to hydrate — this is a genuinely fresh session
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(PAUSED_MS_KEY);
    await AsyncStorage.removeItem(PAUSED_AT_KEY);
  }
  await AsyncStorage.setItem(STARTED_AT_KEY, String(startedAt));
  if (!alreadyRunning) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_UPDATE_OPTIONS);
  }
  return startedAt;
}

export async function stopTracking(): Promise<RoutePoint[]> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  const finalPoints = buffer;
  buffer = [];
  hydrated = false;
  await AsyncStorage.removeItem(STORAGE_KEY);
  await AsyncStorage.removeItem(STARTED_AT_KEY);
  await AsyncStorage.removeItem(PAUSED_MS_KEY);
  await AsyncStorage.removeItem(PAUSED_AT_KEY);
  return finalPoints;
}

// Pausing actually stops native location recording (not just freezing the
// on-screen timer) — otherwise distance/pace would silently keep accruing
// while someone thinks they've paused at a red light or a water stop.
export async function pauseTracking(): Promise<void> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  await AsyncStorage.setItem(PAUSED_AT_KEY, String(Date.now()));
}

export async function resumeTracking(): Promise<void> {
  const pausedAtRaw = await AsyncStorage.getItem(PAUSED_AT_KEY);
  if (pausedAtRaw) {
    const existingPausedMs = Number((await AsyncStorage.getItem(PAUSED_MS_KEY)) ?? '0');
    const newPausedMs = existingPausedMs + (Date.now() - Number(pausedAtRaw));
    await AsyncStorage.setItem(PAUSED_MS_KEY, String(newPausedMs));
    await AsyncStorage.removeItem(PAUSED_AT_KEY);
  }
  const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (!isRunning) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, LOCATION_UPDATE_OPTIONS);
  }
}

// Total paused duration so far (ms), plus the timestamp the current pause
// began if one is in progress — lets the tracking screen compute a correct
// elapsed time (wall-clock time minus time spent paused) even after a
// remount or the OS killing the app mid-pause.
export async function getPauseState(): Promise<{ totalPausedMs: number; pausedAt: number | null }> {
  const totalPausedMs = Number((await AsyncStorage.getItem(PAUSED_MS_KEY)) ?? '0');
  const pausedAtRaw = await AsyncStorage.getItem(PAUSED_AT_KEY);
  return { totalPausedMs, pausedAt: pausedAtRaw ? Number(pausedAtRaw) : null };
}

// Picks up any points (and the true start time) recorded before the tracking
// screen was last mounted — covers both a fresh app launch after the OS
// killed it mid-run, and simply navigating back to an already-in-progress
// tracking session.
export async function restoreBufferedPoints(): Promise<RoutePoint[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    buffer = JSON.parse(raw) as RoutePoint[];
    hydrated = true;
    return buffer;
  } catch {
    return [];
  }
}
