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
export const DAILY_SLOT_TIMES: Record<DailySlot, number> = {
  morning: 8 * 60,
  midday: 12 * 60 + 30,
  evening: 18 * 60 + 30,
};

const EARLIEST_PATTERN_REMINDER = 6 * 60;
const PATTERN_LEAD_MINUTES = 60;
// A pattern reminder stands in for whichever daily nudge lands within this
// window of it, so a Friday doesn't get "leg day!" and "time to move!" back
// to back.
const PATTERN_REPLACES_SLOT_WITHIN = 3 * 60;

const DAILY_MESSAGES: Record<DailySlot, { title: string; body: string }[]> = {
  morning: [
    { title: 'Good morning! ☀️', body: 'A quick workout is a great way to start the day. Ready when you are.' },
    { title: 'Rise and grind 💪', body: "Today's workout is waiting — even 15 minutes counts." },
    { title: 'New day, new reps', body: 'Get a workout in early and own the rest of your day.' },
  ],
  midday: [
    { title: 'Midday check-in 🕛', body: "Haven't trained yet today? A lunchtime session could hit the spot." },
    { title: 'Halfway there', body: 'The day is half done — still plenty of time to get a workout in.' },
    { title: 'Quick break?', body: 'Stretch, walk, or lift — any workout keeps your streak alive.' },
  ],
  evening: [
    { title: 'Still time today 🌙', body: 'Squeeze in a workout before the day wraps up. Your streak will thank you.' },
    { title: 'Evening reminder', body: 'No workout logged yet today — a short one still counts!' },
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

export function patternReminderMinutes(pattern: WorkoutPattern) {
  const target = Math.max(EARLIEST_PATTERN_REMINDER, pattern.typicalStartMinutes - PATTERN_LEAD_MINUTES);
  return Math.floor(target / 15) * 15;
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

    const pattern = patterns.find((p) => p.weekday === day.getDay());
    let replacedSlot: DailySlot | null = null;
    if (pattern) {
      const minutes = patternReminderMinutes(pattern);
      const date = atMinutes(day, minutes);
      if (date > now) {
        planned.push({ identifier: `${PATTERN_PREFIX}${dateKey}`, date, ...patternMessage(pattern) });
        let closest = Infinity;
        for (const slot of Object.keys(DAILY_SLOT_TIMES) as DailySlot[]) {
          const gap = Math.abs(DAILY_SLOT_TIMES[slot] - minutes);
          if (gap <= PATTERN_REPLACES_SLOT_WITHIN && gap < closest) {
            closest = gap;
            replacedSlot = slot;
          }
        }
      }
    }

    for (const slot of Object.keys(DAILY_SLOT_TIMES) as DailySlot[]) {
      if (!settings.dailySlots[slot] || slot === replacedSlot) continue;
      const date = atMinutes(day, DAILY_SLOT_TIMES[slot]);
      if (date <= now) continue;
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
