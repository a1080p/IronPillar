// XP needed to go from `level` to `level + 1`. Starts small so one or two
// workouts (~300-400 XP each) reach level 2, ramps up gently through the
// early levels, then stays flat from level 15 onward.
const FIRST_LEVEL_XP = 400;
const XP_RAMP_PER_LEVEL = 150;
const FLAT_FROM_LEVEL = 15;

export function xpForLevel(level: number) {
  const step = Math.min(Math.max(level, 1), FLAT_FROM_LEVEL) - 1;
  return FIRST_LEVEL_XP + step * XP_RAMP_PER_LEVEL;
}

export function levelProgress(totalXp: number) {
  let level = 1;
  let remaining = Math.max(0, totalXp);
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return { level, xpInto: remaining, xpNeeded: xpForLevel(level) };
}

export function levelForXp(totalXp: number) {
  return levelProgress(totalXp).level;
}

// Dates follow the user's local calendar. The server (completeWorkout in
// functions/src/index.ts) is the source of truth for the weekly goal and the
// week streak; these mirror its rules for display.
function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function todayDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function yesterdayDateString(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return todayDateString(d);
}

// Same limits as functions/src/achievements.ts.
export const WEEKLY_GOAL_MIN = 2;
export const WEEKLY_GOAL_MAX = 6;
export const WEEKLY_GOAL_DEFAULT = 3;

export function clampWeeklyGoal(goal: number | null | undefined): number {
  const n = Math.round(Number(goal));
  if (!Number.isFinite(n)) return WEEKLY_GOAL_DEFAULT;
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, n));
}

// The Monday of the week `date` (yyyy-mm-dd) falls in.
export function weekStartOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return offsetDateString(date, -((dayOfWeek + 6) % 7));
}

type WeekProfile = {
  streakCount?: number;
  timeZone?: string;
  weeklyGoal?: number | null;
  weekStart?: string | null;
  weekCount?: number;
  weekGoal?: number;
  lastGoalWeek?: string | null;
  shieldMonth?: string | null;
};

// The week streak as of right now: alive while last week (or this week) hit
// the goal, or while the monthly shield can still cover one missed week.
// Days are counted in the zone the server stored (profile.timeZone), or UTC
// for older profiles, exactly as completeWorkout does.
export function activeStreak(profile: WeekProfile | null | undefined, now = new Date()): number {
  const count = profile?.streakCount ?? 0;
  const last = profile?.lastGoalWeek;
  if (!last || count <= 0) return 0;
  const thisWeek = weekStartOf(dateStringInZone(now, profile?.timeZone ?? 'UTC'));
  if (last >= offsetDateString(thisWeek, -7)) return count;
  const shieldCovers =
    last === offsetDateString(thisWeek, -14) && profile?.shieldMonth !== thisWeek.slice(0, 7);
  return shieldCovers ? count : 0;
}

export interface WeekProgress {
  streak: number;
  count: number; // workouts counted this week
  goal: number; // this week's goal
  weekStart: string; // Monday, yyyy-mm-dd
  daysLeft: number; // days left in the week, today included (1 on Sunday)
  goalHit: boolean;
}

export function weekProgress(profile: WeekProfile | null | undefined, now = new Date()): WeekProgress {
  const today = dateStringInZone(now, profile?.timeZone ?? 'UTC');
  const weekStart = weekStartOf(today);
  const thisWeek = !!profile?.weekStart && profile.weekStart >= weekStart;
  const count = thisWeek ? (profile?.weekCount ?? 0) : 0;
  const goal = thisWeek && profile?.weekGoal ? clampWeeklyGoal(profile.weekGoal) : clampWeeklyGoal(profile?.weeklyGoal);
  const [y, m, d] = today.split('-').map(Number);
  const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return {
    streak: activeStreak(profile, now),
    count,
    goal,
    weekStart,
    daysLeft: dayOfWeek === 0 ? 1 : 8 - dayOfWeek,
    goalHit: count >= goal,
  };
}

// yyyy-mm-dd of `date` in an IANA zone, falling back to the device's day.
export function dateStringInZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type: string) => parts.find((p) => p.type === type)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch {
    return todayDateString(date);
  }
}

// `dateStr` (yyyy-mm-dd) shifted by `days` (negative for earlier).
export function offsetDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// The hour (0-23) of `date` in an IANA zone, falling back to the device's hour.
export function hourInZone(date: Date, timeZone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date)
    );
  } catch {
    return date.getHours();
  }
}

// The device's IANA time zone (e.g. "America/New_York"), sent with each
// workout completion so the server counts streak days on local midnight.
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
