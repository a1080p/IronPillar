import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { WorkoutLog } from '../types/models';

// Pro data export: one CSV row per logged set (or one row per workout for
// outdoor activities, which have no sets), then the system share sheet so the
// user can save it to Files, AirDrop it, or open it in Numbers/Sheets.

const HEADER = [
  'date',
  'workout',
  'type',
  'exercise',
  'set',
  'reps',
  'weight_lb',
  'duration_sec',
  'distance_mi',
  'total_minutes',
  'xp',
];

function cell(value: string | number | undefined | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function workoutsToCsv(logs: WorkoutLog[]): string {
  const rows: string[] = [HEADER.join(',')];
  const oldestFirst = [...logs].sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  for (const log of oldestFirst) {
    const type =
      log.workoutSource === 'outdoor' ? (log.activityType ?? 'outdoor') : log.workoutSource;
    const minutes = Math.round(log.durationSeconds / 60);
    const miles = log.distanceMeters ? (log.distanceMeters / 1609.344).toFixed(2) : '';

    const setRows = log.exercises.flatMap((exercise) =>
      exercise.sets
        .map((set, i) => ({ exercise, set, i }))
        .filter(({ set }) => set.reps != null || set.weight != null || set.durationSeconds != null)
    );

    if (setRows.length === 0) {
      rows.push(
        [log.completedAt, log.workoutName, type, '', '', '', '', '', miles, minutes, log.xpEarned]
          .map(cell)
          .join(',')
      );
      continue;
    }

    for (const { exercise, set, i } of setRows) {
      rows.push(
        [
          log.completedAt,
          log.workoutName,
          type,
          exercise.exerciseName,
          i + 1,
          set.reps,
          set.weight,
          set.durationSeconds,
          miles,
          minutes,
          log.xpEarned,
        ]
          .map(cell)
          .join(',')
      );
    }
  }

  return rows.join('\n');
}

export async function exportWorkoutsCsv(logs: WorkoutLog[]): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `iron-pillar-workouts-${stamp}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(workoutsToCsv(logs));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export workouts',
  });
}
