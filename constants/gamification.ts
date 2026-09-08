export const XP_PER_LEVEL = 3000;

export function levelForXp(totalXp: number) {
  return Math.floor(totalXp / XP_PER_LEVEL) + 1;
}

export function xpIntoLevel(totalXp: number) {
  return totalXp % XP_PER_LEVEL;
}

export function todayDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function yesterdayDateString(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return todayDateString(d);
}
