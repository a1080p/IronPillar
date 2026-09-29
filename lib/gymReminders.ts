// "You're at the gym but haven't started a workout" reminders. Each saved gym
// is an OS geofence; arriving schedules a local notification a few minutes
// out, and leaving, starting a workout, or finishing one cancels it. The
// delay is the whole point: walking in and changing takes a few minutes, so
// only nudge someone who's been there a while without opening a workout.
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { todayDateString } from '../constants/gamification';
import { REMINDER_CHANNEL_ID, ensureNotificationPermission, ensureReminderChannel } from './reminders';
import {
  getLastWorkoutDate,
  getWorkoutStartedAt,
  loadReminderSettings,
  setWorkoutStartedAt,
  type ReminderSettings,
} from './reminderSettings';

export const GYM_GEOFENCE_TASK = 'iron-pillar-gym-geofence';
const GYM_PREFIX = 'ip-gym-';
// A workout started this recently counts as "already training" — covers
// arriving mid-session after stepping out to the car.
const RECENT_START_WINDOW_MS = 3 * 60 * 60 * 1000;

// Must be defined at true module top level, like the outdoor tracking task in
// lib/outdoorTracking.ts — this file is imported at the top of
// app/_layout.tsx so the task exists when the OS relaunches the app in the
// background just to deliver a geofence event.
TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
  GYM_GEOFENCE_TASK,
  async ({ data, error }) => {
    if (error || !data?.region?.identifier) return;
    const identifier = `${GYM_PREFIX}${data.region.identifier}`;

    if (data.eventType === Location.GeofencingEventType.Exit) {
      await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
      return;
    }
    if (data.eventType !== Location.GeofencingEventType.Enter) return;

    const settings = await loadReminderSettings();
    if (!settings.gymReminders) return;
    const gym = settings.gyms.find((g) => g.id === data.region.identifier);
    if (!gym) return;
    if ((await getLastWorkoutDate()) === todayDateString()) return;
    const startedAt = await getWorkoutStartedAt();
    if (startedAt && Date.now() - startedAt < RECENT_START_WINDOW_MS) return;

    await ensureReminderChannel();
    // Same identifier per gym, so a jittery enter/exit/enter at the door
    // replaces the pending reminder instead of stacking duplicates.
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: `At ${gym.name}? 🏋️`,
        body: "Looks like you're at the gym — start your workout in Iron Pillar so it counts!",
        data: { url: '/' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(60, settings.gymDelayMinutes * 60),
        channelId: REMINDER_CHANNEL_ID,
      },
    }).catch(() => {});
  }
);

export async function cancelPendingGymReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(GYM_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
  );
}

// Called when any workout (logged or outdoor) begins.
export async function noteWorkoutStarted() {
  await setWorkoutStartedAt(Date.now()).catch(() => {});
  await cancelPendingGymReminders();
}

// Geofencing needs "Always" location access — the whole feature is about
// noticing arrival while the app isn't open.
export async function requestGymReminderPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return false;
  return ensureNotificationPermission(true);
}

// Makes the OS's registered geofences match the saved settings. Calling
// startGeofencingAsync again replaces the previous region list, so this is
// safe to run on every settings change and app start.
export async function syncGymGeofences(settings: ReminderSettings) {
  try {
    const started = await Location.hasStartedGeofencingAsync(GYM_GEOFENCE_TASK);
    const bg = await Location.getBackgroundPermissionsAsync();
    const shouldRun = settings.gymReminders && settings.gyms.length > 0 && bg.granted;
    if (!shouldRun) {
      if (started) await Location.stopGeofencingAsync(GYM_GEOFENCE_TASK);
      await cancelPendingGymReminders();
      return;
    }
    await Location.startGeofencingAsync(
      GYM_GEOFENCE_TASK,
      settings.gyms.map((g) => ({
        identifier: g.id,
        latitude: g.latitude,
        longitude: g.longitude,
        radius: g.radiusMeters,
        notifyOnEnter: true,
        notifyOnExit: true,
      }))
    );
  } catch {
    // Geofencing unavailable (simulator without location, web) — reminders
    // just won't fire; nothing else depends on it.
  }
}
