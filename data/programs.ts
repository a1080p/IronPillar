// Training programs: a fixed rotation of workout days, done in order. Unlike
// the daily recommended workout, a program repeats the same lifts every
// week, which is what makes "last time" numbers and adding weight work.
//
// Each day is a regular WorkoutTemplate (category 'program'), so the detail,
// logging and summary screens work unchanged. They're bundled with the app
// rather than seeded into Firestore; useWorkout looks them up here.
//
// Which day is next isn't stored: it's the day after the most recent logged
// workout from the active program (see nextProgramDay).
import type { Barrier, ExerciseSpec, ExperienceLevel, WorkoutLog, WorkoutTemplate } from '../types/models';
import { catalogExerciseById } from './exercises';
import { workoutTemplates } from './workoutTemplates';

export interface Program {
  id: string;
  name: string;
  summary: string;
  daysPerWeek: number; // also the weekly goal suggested when starting it
  level: 'Beginner' | 'Intermediate';
  equipment: string;
  days: WorkoutTemplate[];
}

// The coaching tip an existing template already gives for this exercise, so
// program days get the same cues without repeating them here.
const tips = new Map<string, string>();
for (const template of workoutTemplates) {
  for (const e of template.exercises) {
    if (e.catalogId && e.tips && !tips.has(e.catalogId)) tips.set(e.catalogId, e.tips);
  }
}

// Cues for program exercises no existing template covers.
const EXTRA_TIPS: Record<string, string> = {
  'lat-pulldown': 'Lean back slightly, pull the bar to your upper chest by driving your elbows down, and let it rise slowly.',
  'glute-bridge': 'Feet flat and close to your hips, push through your heels and squeeze your glutes at the top for a second.',
  'dumbbell-lunges': 'Step forward, drop the back knee toward the floor with your torso upright, then push through the front heel to stand.',
  'lying-leg-curl': 'Keep your hips pressed into the pad, curl your heels toward your glutes, and lower slowly.',
  'hanging-leg-raise': 'Hang still without swinging, raise your legs by curling your pelvis up, and lower with control.',
  'bulgarian-split-squat': 'Back foot on a bench, front foot far enough out that your knee tracks over your toes, and lower straight down.',
  'barbell-hip-thrust': 'Upper back on a bench, bar over your hips, drive up until your body is flat from knees to shoulders, chin tucked.',
  'leg-extension': 'Line your knees up with the machine pivot, straighten your legs fully, and lower without letting the stack slam.',
  'seated-calf-raise': 'Pads on your lower thighs, lower your heels for a full stretch, then rise onto the balls of your feet.',
  'cable-crunch': 'Kneel facing the cable, hold the rope by your head, and curl your ribs toward your hips without pulling with your arms.',
  'face-pull': 'Rope at face height, pull toward your forehead with elbows high and squeeze your shoulder blades together.',
};

function ex(catalogId: string, targetSets: number, targetRepsLabel: string, tip?: string): ExerciseSpec {
  const entry = catalogExerciseById(catalogId);
  if (!entry) throw new Error(`Unknown catalog exercise: ${catalogId}`);
  const tipText = tip ?? tips.get(catalogId) ?? EXTRA_TIPS[catalogId];
  return {
    id: catalogId,
    name: entry.name,
    catalogId,
    logType: entry.logType,
    ...(entry.tracksWeight === false ? { tracksWeight: false } : {}),
    targetSets,
    targetRepsLabel,
    ...(tipText ? { tips: tipText } : {}),
  };
}

function day(
  programId: string,
  key: string,
  name: string,
  overview: string,
  equipment: string[],
  exercises: ExerciseSpec[]
): WorkoutTemplate {
  const sets = exercises.reduce((n, e) => n + e.targetSets, 0);
  // About 2.5 minutes a set including rest, rounded to 5.
  const durationMinutes = Math.max(20, Math.round((sets * 2.5) / 5) * 5);
  const calories = Math.round(durationMinutes * 6.5);
  return {
    id: `program-${programId}-${key}`,
    name,
    durationMinutes,
    caloriesRangeLabel: `${Math.round(calories * 0.8)}-${Math.round(calories * 1.2)} Calories`,
    equipmentRequired: equipment.length > 0,
    category: 'program',
    tags: ['build_strength'],
    overview,
    workoutTips: [
      {
        heading: 'Progressing',
        bullets: [
          'Hit the top of the rep range on every set? Add a little weight next time.',
          "Can't reach the bottom of the range? Keep the weight and build up.",
          'Rest 1-2 minutes between sets, longer for the first lift of the day.',
        ],
      },
    ],
    equipment: equipment.length > 0 ? [{ heading: 'Essential Equipment', bullets: equipment }] : [],
    exercises,
  };
}

const GYM = ['Barbell', 'Dumbbells', 'Cable machine', 'Bench'];
const DUMBBELLS = ['Dumbbells', 'Bench'];

export const PROGRAMS: Program[] = [
  {
    id: 'full-body-3',
    name: '3-Day Full Body',
    summary:
      'The best place to start. Three full-body sessions a week, each hitting legs, push, pull and core with machines and dumbbells.',
    daysPerWeek: 3,
    level: 'Beginner',
    equipment: 'Dumbbells, cables, leg press',
    days: [
      day('full-body-3', 'a', 'Full Body A', 'Squat, press, row and hinge: the four basics.', ['Dumbbells', 'Cable machine', 'Bench'], [
        ex('dumbbell-goblet-squat', 3, '8-10 reps'),
        ex('dumbbell-bench-press', 3, '8-10 reps'),
        ex('seated-cable-row', 3, '10-12 reps'),
        ex('dumbbell-romanian-deadlift', 3, '10 reps'),
        ex('plank', 3, '30 sec'),
      ]),
      day('full-body-3', 'b', 'Full Body B', 'Leg press, overhead press and pulldowns, plus glutes and core.', ['Leg press', 'Dumbbells', 'Cable machine'], [
        ex('leg-press', 3, '10-12 reps'),
        ex('dumbbell-shoulder-press', 3, '8-10 reps'),
        ex('lat-pulldown', 3, '10-12 reps'),
        ex('glute-bridge', 3, '12 reps'),
        ex('dead-bug', 3, '10 reps'),
      ]),
      day('full-body-3', 'c', 'Full Body C', 'Single-leg work, incline press and rows to round out the week.', ['Dumbbells', 'Bench', 'Leg curl machine'], [
        ex('dumbbell-lunges', 3, '10 reps each leg'),
        ex('incline-dumbbell-press', 3, '10 reps'),
        ex('single-arm-dumbbell-row', 3, '10 reps each arm'),
        ex('lying-leg-curl', 3, '12 reps'),
        ex('side-plank', 2, '30 sec each side'),
      ]),
    ],
  },
  {
    id: 'upper-lower-4',
    name: '4-Day Upper/Lower',
    summary:
      'Two upper-body and two lower-body days a week. More volume per muscle than full body, built around the big barbell lifts.',
    daysPerWeek: 4,
    level: 'Intermediate',
    equipment: 'Full gym',
    days: [
      day('upper-lower-4', 'upper-a', 'Upper A', 'Heavy bench and rows, then shoulders and arms.', GYM, [
        ex('barbell-bench-press', 4, '6-8 reps'),
        ex('barbell-row', 4, '6-8 reps'),
        ex('barbell-overhead-press', 3, '8 reps'),
        ex('lat-pulldown', 3, '10 reps'),
        ex('hammer-curl', 2, '12 reps'),
        ex('cable-triceps-pushdown', 2, '12 reps'),
      ]),
      day('upper-lower-4', 'lower-a', 'Lower A', 'Squat-focused: back squat, then hamstrings and calves.', ['Barbell', 'Squat rack', 'Leg press', 'Pull-up bar'], [
        ex('barbell-back-squat', 4, '6-8 reps'),
        ex('romanian-deadlift', 3, '8 reps'),
        ex('leg-press', 3, '10 reps'),
        ex('lying-leg-curl', 3, '12 reps'),
        ex('standing-calf-raises', 3, '12 reps'),
        ex('hanging-leg-raise', 3, '10 reps'),
      ]),
      day('upper-lower-4', 'upper-b', 'Upper B', 'Incline press and pull-ups, then lighter shoulder and arm work.', [...GYM, 'Pull-up bar'], [
        ex('incline-dumbbell-press', 4, '8-10 reps'),
        ex('pull-ups', 4, '6-10 reps'),
        ex('dumbbell-shoulder-press', 3, '10 reps'),
        ex('seated-cable-row', 3, '10 reps'),
        ex('lateral-raises', 3, '12 reps'),
        ex('barbell-curl', 2, '10 reps'),
        ex('skull-crushers', 2, '10 reps'),
      ]),
      day('upper-lower-4', 'lower-b', 'Lower B', 'Deadlift-focused: deadlift, split squats and glutes.', ['Barbell', 'Dumbbells', 'Bench', 'Leg extension machine'], [
        ex('barbell-deadlift', 3, '5 reps'),
        ex('bulgarian-split-squat', 3, '8 reps each leg'),
        ex('barbell-hip-thrust', 3, '10 reps'),
        ex('leg-extension', 3, '12 reps'),
        ex('seated-calf-raise', 3, '15 reps'),
        ex('cable-crunch', 3, '12 reps'),
      ]),
    ],
  },
  {
    id: 'ppl',
    name: 'Push/Pull/Legs',
    summary:
      'Chest, shoulders and triceps; back and biceps; then legs. Run it 3 days a week, or twice through for 6.',
    daysPerWeek: 3,
    level: 'Intermediate',
    equipment: 'Full gym',
    days: [
      day('ppl', 'push', 'Push Day', 'Chest, shoulders and triceps.', GYM, [
        ex('barbell-bench-press', 4, '6-8 reps'),
        ex('seated-dumbbell-overhead-press', 3, '8-10 reps'),
        ex('incline-dumbbell-press', 3, '10 reps'),
        ex('lateral-raises', 3, '12 reps'),
        ex('cable-triceps-pushdown', 3, '12 reps'),
        ex('overhead-triceps-extension', 2, '12 reps'),
      ]),
      day('ppl', 'pull', 'Pull Day', 'Back and biceps.', [...GYM, 'Pull-up bar'], [
        ex('barbell-deadlift', 3, '5 reps'),
        ex('pull-ups', 3, '6-10 reps'),
        ex('barbell-row', 3, '8 reps'),
        ex('face-pull', 3, '15 reps'),
        ex('barbell-curl', 3, '10 reps'),
        ex('hammer-curl', 2, '12 reps'),
      ]),
      day('ppl', 'legs', 'Leg Day', 'Quads, hamstrings, calves and core.', ['Barbell', 'Squat rack', 'Leg press', 'Leg curl machine'], [
        ex('barbell-back-squat', 4, '6-8 reps'),
        ex('romanian-deadlift', 3, '8-10 reps'),
        ex('leg-press', 3, '10-12 reps'),
        ex('lying-leg-curl', 3, '12 reps'),
        ex('standing-calf-raises', 4, '12 reps'),
        ex('plank', 3, '45 sec'),
      ]),
    ],
  },
  {
    id: 'minimal-2',
    name: '2-Day Minimal',
    summary:
      'Short on time? Two 30-minute full-body sessions a week with just dumbbells and a bench. Enough to get and stay strong.',
    daysPerWeek: 2,
    level: 'Beginner',
    equipment: 'Dumbbells and a bench',
    days: [
      day('minimal-2', 'a', 'Minimal Day 1', 'Squat, push, row and hinge in about 30 minutes.', DUMBBELLS, [
        ex('dumbbell-goblet-squat', 3, '10 reps'),
        ex('push-ups', 3, '8-15 reps'),
        ex('single-arm-dumbbell-row', 3, '10 reps each arm'),
        ex('dumbbell-romanian-deadlift', 3, '10 reps'),
        ex('plank', 2, '45 sec'),
      ]),
      day('minimal-2', 'b', 'Minimal Day 2', 'Lunges, presses and rows to cover the rest.', DUMBBELLS, [
        ex('walking-lunges', 3, '10 reps each leg'),
        ex('dumbbell-bench-press', 3, '10 reps'),
        ex('dumbbell-row-two-arm', 3, '10 reps'),
        ex('dumbbell-shoulder-press', 2, '10 reps'),
        ex('dead-bug', 2, '10 reps'),
      ]),
    ],
  },
];

export const PROGRAM_DAYS: WorkoutTemplate[] = PROGRAMS.flatMap((p) => p.days);

export function programById(id: string | null | undefined): Program | undefined {
  return id ? PROGRAMS.find((p) => p.id === id) : undefined;
}

// The next day of `program` to do: the one after the most recently logged
// day of it (logs are newest first), or the first day if none is logged.
export function nextProgramDay(program: Program, logs: WorkoutLog[]): { day: WorkoutTemplate; index: number } {
  const ids = program.days.map((d) => d.id);
  const lastLog = logs.find((l) => ids.includes(l.workoutId));
  const index = lastLog ? (ids.indexOf(lastLog.workoutId) + 1) % ids.length : 0;
  return { day: program.days[index], index };
}

// The program suggested to someone who hasn't picked one: short on time gets
// the 2-day plan, experienced lifters upper/lower, everyone else full body.
export function suggestedProgram(
  experienceLevel: ExperienceLevel | undefined,
  barrier: Barrier | undefined
): Program {
  const id =
    barrier === 'time' ? 'minimal-2' : experienceLevel === 'experienced' ? 'upper-lower-4' : 'full-body-3';
  return programById(id)!;
}
