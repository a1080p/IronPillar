// "Did you forget to end your workout?" nudges. These are local notifications
// scheduled while a workout is running and cancelled when it ends, so they
// only ever fire if the workout was left running.
//
// Strength workouts get a nudge well past the workout's expected length.
// Outdoor activities get one when the GPS stops seeing movement: every time
// the location task reports real movement the idle nudge is pushed back, so it
// fires only after the user has stayed put for a while.
import * as Notifications from 'expo-notifications';
import { REMINDER_CHANNEL_ID, ensureNotificationPermission, ensureReminderChannel } from './reminders';
import { haversineMeters } from './geo';
import type { RoutePoint } from '../types/models';

const STRENGTH_IDS = ['ip-watchdog-strength-1', 'ip-watchdog-strength-2'];
const OUTDOOR_IDLE_ID = 'ip-watchdog-outdoor-idle';
const OUTDOOR_LONG_ID = 'ip-watchdog-outdoor-long';
const OUTDOOR_PAUSED_ID = 'ip-watchdog-outdoor-paused';

const MINUTE = 60;
// Strength: first nudge at twice the expected length (at least 75 min), then
// one more an hour later.
const STRENGTH_MIN_FIRST_NUDGE_MIN = 75;
const STRENGTH_SECOND_NUDGE_AFTER_MIN = 60;
// Outdoor: nudge after this long without moving, and once regardless after
// several hours.
const OUTDOOR_IDLE_MIN = 15;
const OUTDOOR_LONG_MIN = 180;
const OUTDOOR_PAUSED_MIN = 20;
// GPS drifts while standing still, so only a move this far from the last
// anchor point counts as movement.
const MOVEMENT_METERS = 40;
// Rescheduling on every location batch would be wasteful; this is plenty.
const MIN_REARM_INTERVAL_MS = 60 * 1000;

async function schedule(identifier: string, title: string, body: string, seconds: number) {
  if (!(await ensureNotificationPermission(false))) return;
  await ensureReminderChannel();
  // Scheduling with the same identifier replaces the pending one.
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, Math.round(seconds)),
      channelId: REMINDER_CHANNEL_ID,
    },
  });
}

function cancel(ids: string[]) {
  return Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}))
  );
}

export function startStrengthWatchdog(workoutName: string, expectedMinutes: number) {
  const first = Math.max(STRENGTH_MIN_FIRST_NUDGE_MIN, expectedMinutes * 2);
  const body = `${workoutName} is still running. If you're done, open Iron Pillar to finish it and keep your XP.`;
  schedule(STRENGTH_IDS[0], 'Still working out?', body, first * MINUTE).catch(() => {});
  schedule(
    STRENGTH_IDS[1],
    'Your workout is still running',
    body,
    (first + STRENGTH_SECOND_NUDGE_AFTER_MIN) * MINUTE
  ).catch(() => {});
}

export function stopStrengthWatchdog() {
  cancel(STRENGTH_IDS).catch(() => {});
}

let anchor: RoutePoint | null = null;
let lastArmedAt = 0;

function armIdle(label: string) {
  lastArmedAt = Date.now();
  schedule(
    OUTDOOR_IDLE_ID,
    `Still on your ${label.toLowerCase()}?`,
    "You haven't moved in a while and Iron Pillar is still tracking. If you're done, open the app and tap Stop.",
    OUTDOOR_IDLE_MIN * MINUTE
  ).catch(() => {});
}

export function startOutdoorWatchdog(label: string) {
  anchor = null;
  armIdle(label);
  schedule(
    OUTDOOR_LONG_ID,
    `Your ${label.toLowerCase()} is still being tracked`,
    "It's been running for 3 hours. If you forgot to stop it, open Iron Pillar and tap Stop.",
    OUTDOOR_LONG_MIN * MINUTE
  ).catch(() => {});
}

// Called from the background location task with each new batch of points.
export function noteOutdoorMovement(latest: RoutePoint | undefined, label: string) {
  if (!latest) return;
  const moved = !anchor || haversineMeters(anchor, latest) >= MOVEMENT_METERS;
  if (!moved) return;
  anchor = latest;
  if (Date.now() - lastArmedAt >= MIN_REARM_INTERVAL_MS) armIdle(label);
}

export function noteOutdoorPaused(label: string) {
  cancel([OUTDOOR_IDLE_ID]).catch(() => {});
  schedule(
    OUTDOOR_PAUSED_ID,
    `Your ${label.toLowerCase()} is still paused`,
    'Open Iron Pillar to resume it, or tap Stop to save what you did.',
    OUTDOOR_PAUSED_MIN * MINUTE
  ).catch(() => {});
}

export function noteOutdoorResumed(label: string) {
  cancel([OUTDOOR_PAUSED_ID]).catch(() => {});
  anchor = null;
  armIdle(label);
}

export function stopOutdoorWatchdog() {
  anchor = null;
  lastArmedAt = 0;
  cancel([OUTDOOR_IDLE_ID, OUTDOOR_LONG_ID, OUTDOOR_PAUSED_ID]).catch(() => {});
}
