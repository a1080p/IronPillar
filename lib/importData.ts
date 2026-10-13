// Import with AI (Pro): sends pasted notes, a CSV/text file, or screenshots
// to the parseImport Cloud Function, which returns what it found for the user
// to review; saveImport then writes the items they kept. See
// functions/src/index.ts.
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase/config';

export interface ImportSet {
  reps: number | null;
  weight: number | null;
  weightUnit: 'lb' | 'kg' | null;
  durationSeconds: number | null;
}

export interface ImportWorkout {
  date: string; // YYYY-MM-DD
  name: string;
  durationMinutes: number | null;
  activityType: 'strength' | 'walk' | 'run' | 'bike' | 'other';
  distanceKm: number | null;
  exercises: { name: string; sets: ImportSet[] }[];
}

export interface ImportWeight {
  date: string;
  weight: number;
  unit: 'lb' | 'kg';
}

export interface ImportMeal {
  date: string;
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  name: string;
  calories: number;
  proteinG: number | null;
}

export interface ImportPreview {
  workouts: ImportWorkout[];
  weights: ImportWeight[];
  meals: ImportMeal[];
  summary: string;
}

export interface ImportImage {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  data: string; // base64, no data: prefix
}

export const IMPORT_MAX_IMAGES = 4;
export const IMPORT_MAX_TEXT = 200_000;

const parseImportFn = httpsCallable<
  {
    text?: string;
    images?: ImportImage[];
    referenceDate: string;
    defaultWeightUnit: 'lb' | 'kg';
  },
  ImportPreview
>(functions, 'parseImport', { timeout: 300_000 });

const saveImportFn = httpsCallable<
  {
    workouts: ImportWorkout[];
    weights: ImportWeight[];
    meals: ImportMeal[];
    defaultWeightUnit: 'lb' | 'kg';
  },
  { workouts: number; weights: number; meals: number }
>(functions, 'saveImport');

function friendlyError(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export async function parseImport(input: {
  text?: string;
  images?: ImportImage[];
  referenceDate: string;
  defaultWeightUnit: 'lb' | 'kg';
}): Promise<ImportPreview> {
  try {
    return (await parseImportFn(input)).data;
  } catch (e) {
    throw new Error(friendlyError(e, 'Could not read that. Try again.'));
  }
}

export async function saveImport(input: {
  workouts: ImportWorkout[];
  weights: ImportWeight[];
  meals: ImportMeal[];
  defaultWeightUnit: 'lb' | 'kg';
}) {
  try {
    return (await saveImportFn(input)).data;
  } catch (e) {
    throw new Error(friendlyError(e, 'Could not save the import. Try again.'));
  }
}
