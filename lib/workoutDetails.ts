import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';
import type { ExerciseSpec, GeneratedWorkoutDetails } from '../types/models';

type GenerateExercisePayload = Pick<
  ExerciseSpec,
  'name' | 'logType' | 'targetSets' | 'targetRepsLabel'
>;

const generateWorkoutDetailsFn = httpsCallable<
  { name: string; exercises: GenerateExercisePayload[] },
  GeneratedWorkoutDetails
>(functions, 'generateWorkoutDetails');

// Asks the generateWorkoutDetails Cloud Function to fill in the descriptive
// fields (overview, time, calories, equipment, tips) for a freshly built
// custom workout. Callers treat a rejection as non-fatal — the workout is
// still worth saving without the extra detail.
export async function generateWorkoutDetails(
  name: string,
  exercises: ExerciseSpec[]
): Promise<GeneratedWorkoutDetails> {
  const { data } = await generateWorkoutDetailsFn({
    name,
    exercises: exercises.map((e) => ({
      name: e.name,
      logType: e.logType,
      targetSets: e.targetSets,
      targetRepsLabel: e.targetRepsLabel,
    })),
  });
  return data;
}
