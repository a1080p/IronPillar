import type { UnitSystem } from '../types/models';

// Display/input conversion only. Everything is *stored* in meters (distance)
// and pounds (weight) — logs, metrics, the server's XP math — so switching
// units never rewrites data and switching back is lossless.

const METERS_PER_MILE = 1609.344;
const LB_PER_KG = 2.20462;

export const distanceUnit = (u: UnitSystem) => (u === 'metric' ? 'km' : 'mi');
export const weightUnit = (u: UnitSystem) => (u === 'metric' ? 'kg' : 'lb');

export function metersToDistance(meters: number, u: UnitSystem): number {
  return u === 'metric' ? meters / 1000 : meters / METERS_PER_MILE;
}

export function formatDistance(meters: number, u: UnitSystem, digits = 2): string {
  return `${metersToDistance(meters, u).toFixed(digits)} ${distanceUnit(u)}`;
}

// "M:SS /mi" or "/km". Tiny/zero distance shows a dash instead of dividing
// by zero or printing a huge number.
export function formatPace(meters: number, seconds: number, u: UnitSystem): string {
  const distance = metersToDistance(meters, u);
  if (distance < 0.05 || seconds <= 0) return '--:--';
  const secPer = seconds / distance;
  const min = Math.floor(secPer / 60);
  const sec = Math.round(secPer % 60);
  return `${min}:${String(sec).padStart(2, '0')} /${distanceUnit(u)}`;
}

// Stored pounds -> number in the user's unit (kg rounded to 0.5, lb to 1
// decimal only when needed).
export function lbToDisplay(lb: number, u: UnitSystem): number {
  if (u === 'metric') return Math.round((lb / LB_PER_KG) * 2) / 2;
  return Math.round(lb * 10) / 10;
}

// A value the user typed in their unit -> pounds for storage.
export function displayToLb(value: number, u: UnitSystem): number {
  if (u === 'metric') return Math.round(value * LB_PER_KG * 10) / 10;
  return value;
}

export function formatWeight(lb: number, u: UnitSystem): string {
  return `${lbToDisplay(lb, u)} ${weightUnit(u)}`;
}

// Big totals like volume: "12.3k kg".
export function formatVolume(lb: number, u: UnitSystem): string {
  const v = u === 'metric' ? lb / LB_PER_KG : lb;
  const n = v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(Math.round(v));
  return `${n} ${weightUnit(u)}`;
}
