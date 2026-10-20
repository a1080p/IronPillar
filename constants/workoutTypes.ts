import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { CustomWorkout, WorkoutLog, WorkoutTemplate } from '../types/models';

// Every workout is one of six types, shown as an accent color and icon (a
// stripe, chip or dot; fills stay neutral) so yoga and leg day look different
// at a glance. Colors are chosen to read as text on both themes.

export type WorkoutType = 'strength' | 'cardio' | 'hiit' | 'mobility' | 'outdoor' | 'sports';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const WORKOUT_TYPES: Record<
  WorkoutType,
  { label: string; icon: IconName; light: string; dark: string }
> = {
  strength: { label: 'Strength', icon: 'barbell', light: '#3D4FEA', dark: '#7D8AF5' },
  cardio: { label: 'Cardio', icon: 'heart', light: '#C25A00', dark: '#FF9C33' },
  hiit: { label: 'HIIT', icon: 'flash', light: '#C4363B', dark: '#FF6B6F' },
  mobility: { label: 'Mobility', icon: 'leaf', light: '#0F7F78', dark: '#4FD1C5' },
  outdoor: { label: 'Outdoor', icon: 'trail-sign', light: '#2E7D32', dark: '#6CCF73' },
  sports: { label: 'Sports', icon: 'football', light: '#7B3FD1', dark: '#B48CFF' },
};

export function workoutTypeColor(type: WorkoutType, isDark: boolean): string {
  return isDark ? WORKOUT_TYPES[type].dark : WORKOUT_TYPES[type].light;
}

const BY_BROWSE_CATEGORY: Record<string, WorkoutType> = {
  Cardio: 'cardio',
  'Strength Training': 'strength',
  HIIT: 'hiit',
  Yoga: 'mobility',
  'Pilates & Core': 'mobility',
  'Group Fitness Classes': 'sports',
  Swimming: 'cardio',
  Cycling: 'cardio',
  'Sports & Outdoor': 'sports',
  'Stretching & Recovery': 'mobility',
};

export function workoutTypeOf(workout: WorkoutTemplate | CustomWorkout): WorkoutType {
  if (workout.browseCategory && BY_BROWSE_CATEGORY[workout.browseCategory]) {
    return BY_BROWSE_CATEGORY[workout.browseCategory];
  }
  // Presets, quick starts, program days and custom workouts: timed-only
  // workouts read as cardio, anything with reps as strength.
  const allTimed = workout.exercises.length > 0 && workout.exercises.every((e) => e.logType === 'duration');
  return allTimed ? 'cardio' : 'strength';
}

// A logged workout's type, from its template when it can still be found.
export function workoutTypeOfLog(
  log: WorkoutLog,
  workoutsById: Map<string, WorkoutTemplate | CustomWorkout>
): WorkoutType {
  if (log.workoutSource === 'outdoor') return 'outdoor';
  const workout = workoutsById.get(log.workoutId);
  if (workout) return workoutTypeOf(workout);
  const allTimed = log.exercises.length > 0 && log.exercises.every((e) => e.logType === 'duration');
  return allTimed ? 'cardio' : 'strength';
}
