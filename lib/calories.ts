// Pro calorie tracking: the daily target, and calories burned by the day's
// workouts (added back to the day's budget).
import type { Meal, UserProfile, WorkoutLog } from '../types/models';

export const MEALS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snacks' },
];

export const MAX_ENTRY_CALORIES = 5000;
export const MIN_CALORIE_GOAL = 1200;
export const MAX_CALORIE_GOAL = 6000;

const LB_PER_KG = 2.20462;
const CM_PER_INCH = 2.54;
// Light activity outside of logged workouts, which are added separately.
const BASE_ACTIVITY_FACTOR = 1.375;
const LOSE_WEIGHT_DEFICIT = 500;
const BUILD_STRENGTH_SURPLUS = 250;

function ageFromBirthday(birthday: string): number | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(birthday);
  if (!m) return null;
  const born = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  ) {
    age--;
  }
  return age;
}

// Mifflin-St Jeor resting energy × a light activity factor, nudged down for a
// weight-loss goal or up for a strength goal. Rounded to the nearest 50.
export function estimatedCalorieGoal(
  profile: Pick<UserProfile, 'sex' | 'birthday' | 'heightInches' | 'goals'>,
  weightLb: number
): number {
  const kg = weightLb / LB_PER_KG;
  const cm = profile.heightInches * CM_PER_INCH;
  const age = ageFromBirthday(profile.birthday) ?? 30;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (profile.sex === 'male' ? 5 : -161);
  let goal = bmr * BASE_ACTIVITY_FACTOR;
  if (profile.goals.includes('lose_weight')) goal -= LOSE_WEIGHT_DEFICIT;
  else if (profile.goals.includes('build_strength')) goal += BUILD_STRENGTH_SURPLUS;
  const rounded = Math.round(goal / 50) * 50;
  return Math.min(MAX_CALORIE_GOAL, Math.max(MIN_CALORIE_GOAL, rounded));
}

// Rough MET values by workout kind.
const MET = {
  strength: 5,
  walk: 3.5,
  run: 9.8,
  bike: 7.5,
};

// Estimated calories a logged workout burned: MET × body weight × hours.
export function workoutCaloriesBurned(log: WorkoutLog, weightLb: number): number {
  const met = log.activityType ? MET[log.activityType] : MET.strength;
  const hours = log.durationSeconds / 3600;
  return Math.round(met * (weightLb / LB_PER_KG) * hours);
}
