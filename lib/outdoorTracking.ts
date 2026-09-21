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

type Listener = (points: RoutePoint[]) => void;
let listeners: Listener[] = [];
let buffer: RoutePoint[] = [];

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
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

export async function startTracking(): Promise<void> {
  buffer = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 3000,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Iron Pillar',
      notificationBody: 'Tracking your outdoor workout',
    },
  });
}

export async function stopTracking(): Promise<RoutePoint[]> {
  const isRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
  const finalPoints = buffer;
  buffer = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
  return finalPoints;
}

// Picks up any points recorded before the tracking screen was last mounted —
// covers both a fresh app launch after the OS killed it mid-run, and simply
// navigating back to an already-in-progress tracking session.
export async function restoreBufferedPoints(): Promise<RoutePoint[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    buffer = JSON.parse(raw) as RoutePoint[];
    return buffer;
  } catch {
    return [];
  }
}
