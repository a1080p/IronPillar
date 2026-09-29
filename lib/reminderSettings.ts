import AsyncStorage from '@react-native-async-storage/async-storage';

// Reminder preferences live on-device (not in Firestore) on purpose: they're
// about *this* phone's notifications and *this* phone's location, and the
// background geofence task (see lib/gymReminders.ts) has to read them with
// no signed-in Firebase session or network — the OS can relaunch the app
// headlessly just to hand it a "you arrived at the gym" event.

export type DailySlot = 'morning' | 'midday' | 'evening';

export interface GymLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface ReminderSettings {
  // "Haven't worked out yet today" nudges, one per enabled slot.
  dailySlots: Record<DailySlot, boolean>;
  // "It's Friday — leg day" style reminders learned from workout history.
  patternReminders: boolean;
  // Arrive at a saved gym and don't start a workout → nudge after a delay.
  gymReminders: boolean;
  gymDelayMinutes: number;
  gyms: GymLocation[];
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  dailySlots: { morning: true, midday: true, evening: true },
  patternReminders: true,
  gymReminders: false,
  gymDelayMinutes: 10,
  gyms: [],
};

// Geofences under ~100m are unreliable (cell/Wi-Fi location can be off by
// that much indoors), and a gym's parking lot counts as "at the gym".
export const DEFAULT_GYM_RADIUS_M = 150;
export const MAX_GYMS = 10;

const SETTINGS_KEY = 'reminders.settings';
const LAST_WORKOUT_DATE_KEY = 'reminders.lastWorkoutDate';
const WORKOUT_STARTED_AT_KEY = 'reminders.workoutStartedAt';
const PERMISSION_ASKED_KEY = 'reminders.permissionAsked';

type Listener = (settings: ReminderSettings) => void;
let listeners: Listener[] = [];

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY).catch(() => null);
  if (!raw) return DEFAULT_REMINDER_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderSettings>;
    return {
      ...DEFAULT_REMINDER_SETTINGS,
      ...parsed,
      dailySlots: { ...DEFAULT_REMINDER_SETTINGS.dailySlots, ...parsed.dailySlots },
    };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  listeners.forEach((l) => l(settings));
}

export function subscribeReminderSettings(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

// Local yyyy-mm-dd of the most recent completed workout, cached so the
// headless geofence task can tell "already trained today" without Firestore.
export async function getLastWorkoutDate(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_WORKOUT_DATE_KEY).catch(() => null);
}

export async function setLastWorkoutDate(date: string): Promise<void> {
  await AsyncStorage.setItem(LAST_WORKOUT_DATE_KEY, date);
}

export async function getWorkoutStartedAt(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(WORKOUT_STARTED_AT_KEY).catch(() => null);
  return raw ? Number(raw) : null;
}

export async function setWorkoutStartedAt(ms: number): Promise<void> {
  await AsyncStorage.setItem(WORKOUT_STARTED_AT_KEY, String(ms));
}

export async function hasAskedNotificationPermission(): Promise<boolean> {
  return (await AsyncStorage.getItem(PERMISSION_ASKED_KEY).catch(() => null)) === '1';
}

export async function markNotificationPermissionAsked(): Promise<void> {
  await AsyncStorage.setItem(PERMISSION_ASKED_KEY, '1');
}
