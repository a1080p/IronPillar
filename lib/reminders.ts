// Local (on-device) workout reminders: three friendly "haven't trained yet
// today" nudges, plus weekly-habit reminders learned from history (see
// lib/workoutPatterns.ts). Everything is scheduled as one-shot, date-based
// local notifications for the next week rather than as repeating triggers,
// because a repeating trigger can't skip "today" once today's workout is
// done — rescheduling after every completion (and on every app foreground)
// is what makes "only if they haven't worked out today" hold.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { todayDateString } from '../constants/gamification';
import type { WorkoutLog } from '../types/models';
import {
  hasAskedNotificationPermission,
  markNotificationPermissionAsked,
  setLastWorkoutDate,
  type DailySlot,
  type ReminderSettings,
} from './reminderSettings';
import { detectWorkoutPatterns, type WorkoutFocus, type WorkoutPattern } from './workoutPatterns';

export const REMINDER_CHANNEL_ID = 'workout-reminders';

const DAILY_PREFIX = 'ip-daily-';
const PATTERN_PREFIX = 'ip-pattern-';
const SCHEDULE_DAYS = 7;

// Local wall-clock time each daily slot fires, in minutes after midnight.
// These are the only two reminder times; habit reminders use them too.
export const DAILY_SLOT_TIMES: Record<DailySlot, number> = {
  midday: 12 * 60 + 30,
  evening: 19 * 60,
};

// Habit reminders aim for an hour before the user's usual start time, then
// take whichever of the two daily slots is closest to that.
const PATTERN_LEAD_MINUTES = 60;

const DAILY_MESSAGES: Record<DailySlot, { title: string; body: string }[]> = {
  midday: [
    { title: 'Midday check-in 🕛', body: "Haven't trained yet today? A lunchtime session could hit the spot." },
    { title: 'Halfway there', body: 'The day is half done — still plenty of time to get a workout in.' },
    { title: 'Quick break?', body: 'Stretch, walk, or lift. Your minutes add up toward today’s 30.' },
  ],
  evening: [
    { title: 'Still time today 🌙', body: 'Squeeze in a workout before the day wraps up. Your streak will thank you.' },
    { title: 'Evening reminder', body: 'No workout logged yet today. There’s still time to get your 30 minutes in.' },
    { title: 'Finish strong 🔥', body: 'End the day with a win. Log a quick workout in Iron Pillar.' },
  ],
};

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FOCUS_TITLES: Partial<Record<WorkoutFocus, string>> = {
  legs: 'leg day 🦵',
  'upper body': 'upper body day 💪',
  chest: 'chest day',
  back: 'back day',
  shoulders: 'shoulder day',
  arms: 'arm day 💪',
  core: 'core day',
  'full body': 'full-body day',
  run: 'run day 🏃',
  walk: 'walk day 🚶',
  bike: 'ride day 🚴',
  swim: 'swim day 🏊',
  yoga: 'yoga day 🧘',
  HIIT: 'HIIT day ⚡',
  cardio: 'cardio day',
};

export function patternMessage(pattern: WorkoutPattern): { title: string; body: string } {
  const day = WEEKDAY_NAMES[pattern.weekday];
  if (pattern.focus) {
    const label = FOCUS_TITLES[pattern.focus] ?? `${pattern.focus} day`;
    return {
      title: `It's ${day} — ${label}`,
      body: `You've been crushing ${pattern.focus} on ${day}s. Keep the streak going!`,
    };
  }
  return {
    title: `${day} workout time`,
    body: `${day}s are one of your regular training days. Ready to get after it?`,
  };
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Workout reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

// `prompt: false` only checks — used on app start so we never pop the OS
// dialog out of nowhere after the first time.
export async function ensureNotificationPermission(prompt: boolean): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!prompt || !current.canAskAgain) return false;
  await markNotificationPermissionAsked();
  const next = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return next.granted;
}

// Asks once, the first time a signed-in user lands in the app, since daily
// and pattern reminders are on by default. Later changes go through the
// Reminders screen.
export async function maybeAskNotificationPermissionOnce(): Promise<boolean> {
  if (await hasAskedNotificationPermission()) return ensureNotificationPermission(false);
  return ensureNotificationPermission(true);
}

function atMinutes(day: Date, minutes: number) {
  const d = new Date(day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

export function workedOutToday(logs: WorkoutLog[], now = new Date()) {
  const today = todayDateString(now);
  return logs.some((l) => todayDateString(new Date(l.completedAt)) === today);
}

// The daily slot a habit reminder goes in for this pattern's weekday.
export function patternReminderSlot(pattern: WorkoutPattern): DailySlot {
  const target = pattern.typicalStartMinutes - PATTERN_LEAD_MINUTES;
  const slots = Object.keys(DAILY_SLOT_TIMES) as DailySlot[];
  return slots.reduce((best, slot) =>
    Math.abs(DAILY_SLOT_TIMES[slot] - target) < Math.abs(DAILY_SLOT_TIMES[best] - target) ? slot : best
  );
}

export function patternReminderMinutes(pattern: WorkoutPattern) {
  return DAILY_SLOT_TIMES[patternReminderSlot(pattern)];
}

interface PlannedReminder {
  identifier: string;
  date: Date;
  title: string;
  body: string;
}

// Pure planning step, split out from the scheduling side effects so the
// "what fires when" rules are easy to reason about on their own.
export function planReminders(
  logs: WorkoutLog[],
  settings: ReminderSettings,
  now = new Date()
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const doneToday = workedOutToday(logs, now);
  const patterns = settings.patternReminders ? detectWorkoutPatterns(logs, now) : [];

  for (let offset = 0; offset < SCHEDULE_DAYS; offset++) {
    if (offset === 0 && doneToday) continue;
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    day.setHours(0, 0, 0, 0);
    const dateKey = todayDateString(day);
    // Rotate copy by day so the same line doesn't show up every morning.
    const rotation = Math.floor(day.getTime() / (24 * 60 * 60 * 1000));

    // On a habit day, the habit message takes over one of the two slots
    // rather than adding a third notification.
    const pattern = patterns.find((p) => p.weekday === day.getDay());
    const patternSlot = pattern ? patternReminderSlot(pattern) : null;

    for (const slot of Object.keys(DAILY_SLOT_TIMES) as DailySlot[]) {
      const isPatternSlot = slot === patternSlot && !!pattern;
      if (!settings.dailySlots[slot] && !isPatternSlot) continue;
      const date = atMinutes(day, DAILY_SLOT_TIMES[slot]);
      if (date <= now) continue;
      if (isPatternSlot) {
        planned.push({ identifier: `${PATTERN_PREFIX}${dateKey}`, date, ...patternMessage(pattern) });
        continue;
      }
      const messages = DAILY_MESSAGES[slot];
      planned.push({
        identifier: `${DAILY_PREFIX}${dateKey}-${slot}`,
        date,
        ...messages[rotation % messages.length],
      });
    }
  }
  return planned;
}

// Serialized so overlapping triggers (logs snapshot + app foreground +
// settings change arriving together) can't interleave cancel/schedule and
// leave duplicates behind.
let queue: Promise<void> = Promise.resolve();

export function rescheduleWorkoutReminders(logs: WorkoutLog[], settings: ReminderSettings) {
  queue = queue
    .then(async () => {
      if (workedOutToday(logs)) await setLastWorkoutDate(todayDateString());
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter((n) => n.identifier.startsWith(DAILY_PREFIX) || n.identifier.startsWith(PATTERN_PREFIX))
          .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
      );
      if (!(await ensureNotificationPermission(false))) return;
      await ensureReminderChannel();
      for (const r of planReminders(logs, settings)) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.identifier,
          content: { title: r.title, body: r.body, data: { url: '/' } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: r.date,
            channelId: REMINDER_CHANNEL_ID,
          },
        });
      }
    })
    .catch(() => {});
  return queue;
}
