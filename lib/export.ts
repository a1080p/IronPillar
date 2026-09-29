import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { UnitSystem, WorkoutLog } from '../types/models';
import { distanceUnit, lbToDisplay, metersToDistance, weightUnit } from './units';

// Pro data export: one CSV row per logged set (or one row per workout for
// outdoor activities, which have no sets), then the system share sheet so the
// user can save it to Files, AirDrop it, or open it in Numbers/Sheets.

const header = (units: UnitSystem) => [
  'date',
  'workout',
  'type',
  'exercise',
  'set',
  'reps',
  `weight_${weightUnit(units)}`,
  'duration_sec',
  `distance_${distanceUnit(units)}`,
  'total_minutes',
  'xp',
];

function cell(value: string | number | undefined | null): string {
  if (value == null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function workoutsToCsv(logs: WorkoutLog[], units: UnitSystem = 'imperial'): string {
  const rows: string[] = [header(units).join(',')];
  const oldestFirst = [...logs].sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  for (const log of oldestFirst) {
    const type =
      log.workoutSource === 'outdoor' ? (log.activityType ?? 'outdoor') : log.workoutSource;
    const minutes = Math.round(log.durationSeconds / 60);
    const distance = log.distanceMeters
      ? metersToDistance(log.distanceMeters, units).toFixed(2)
      : '';

    const setRows = log.exercises.flatMap((exercise) =>
      exercise.sets
        .map((set, i) => ({ exercise, set, i }))
        .filter(({ set }) => set.reps != null || set.weight != null || set.durationSeconds != null)
    );

    if (setRows.length === 0) {
      rows.push(
        [log.completedAt, log.workoutName, type, '', '', '', '', '', distance, minutes, log.xpEarned]
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
          set.weight != null ? lbToDisplay(set.weight, units) : undefined,
          set.durationSeconds,
          distance,
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

export async function exportWorkoutsCsv(
  logs: WorkoutLog[],
  units: UnitSystem = 'imperial'
): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing isn’t available on this device.');
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `iron-pillar-workouts-${stamp}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(workoutsToCsv(logs, units));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Export workouts',
  });
}
