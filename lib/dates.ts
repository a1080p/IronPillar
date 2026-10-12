export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Auto-inserts dashes as digits come in, so typing "05102004" fills the
// field as "05-10-2004" without the user typing the dashes themselves.
export function formatBirthdayInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('-');
}

// Iron Pillar's minimum age (App Store age rating and Terms).
export const MIN_AGE = 13;

// Age in whole years from an MM-DD-YYYY birthday, or null if it isn't a real
// past date.
export function ageFromBirthday(birthday: string): number | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(birthday);
  if (!m) return null;
  const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day || date > new Date()) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
  return age;
}
