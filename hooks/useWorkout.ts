import { useWorkoutTemplates } from './useWorkoutTemplates';
import { useCustomWorkouts } from './useCustomWorkouts';
import type { CustomWorkout, WorkoutTemplate } from '../types/models';

// Looks a workout up across both presets/quick-starts and the user's own
// custom workouts, so the detail/log/complete screens can stay generic.
export function useWorkout(id: string | undefined, uid: string | undefined) {
  const { templates, loading: loadingTemplates } = useWorkoutTemplates();
  const { customWorkouts, loading: loadingCustom } = useCustomWorkouts(uid);

  const all: (WorkoutTemplate | CustomWorkout)[] = [...templates, ...customWorkouts];
  const workout = all.find((w) => w.id === id);

  return { workout, loading: loadingTemplates || loadingCustom };
}
