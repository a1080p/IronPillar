import type { ExperienceLevel, FitnessGoal, Sex } from '../types/models';

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const GOAL_OPTIONS: { value: FitnessGoal; label: string }[] = [
  { value: 'lose_weight', label: 'Lose Weight' },
  { value: 'build_strength', label: 'Build Strength' },
  { value: 'build_endurance', label: 'Build Endurance' },
];

export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'new', label: "I'm New to This" },
  { value: 'some', label: 'I Know a Little' },
  { value: 'experienced', label: "I'm Experienced" },
];
