export const XP_PER_LEVEL = 3000;

export function levelForXp(totalXp: number) {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

export function xpIntoLevel(totalXp: number) {
  return totalXp % XP_PER_LEVEL;
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
