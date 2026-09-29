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

// Streak days follow the user's local calendar day. The server
// (completeWorkout in functions/src/index.ts) is the source of truth for
// streaks — these just mirror its day boundary for client-side display.
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

// The device's IANA time zone (e.g. "America/New_York"), sent with each
// workout completion so the server counts streak days on local midnight.
export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
