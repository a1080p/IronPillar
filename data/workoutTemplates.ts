import type { WorkoutTemplate } from '../types/models';
import { browseWorkoutTemplates } from './browseWorkoutTemplates';

const presetsAndQuickStarts: WorkoutTemplate[] = [
  {
    id: 'upper-body-strength-builder',
    name: 'Upper Body Strength Builder',
    durationMinutes: 45,
    caloriesRangeLabel: '320-450 Calories',
    equipmentRequired: true,
    category: 'preset',
    tags: ['build_strength'],
    exercises: [
      {
        id: 'barbell-bench-press',
        name: 'Barbell Bench Press',
        logType: 'reps_weight',
        targetSets: 4,
        targetRepsLabel: '8-10 reps',
        tips: 'Retract your shoulder blades, lower the bar to mid-chest with elbows at about 45 degrees, then press up without bouncing.',
      },
      {
        id: 'bent-over-barbell-row',
        name: 'Bent-Over Barbell Row',
        logType: 'reps_weight',
        targetSets: 4,
        targetRepsLabel: '8-10 reps',
        tips: 'Hinge at the hips with a flat back, pull the bar to your lower ribs, and squeeze your shoulder blades together.',
      },
      {
        id: 'overhead-press',
        name: 'Overhead Press (Standing)',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '8-10 reps',
        tips: 'Brace your core, press the bar straight overhead, and avoid arching your lower back.',
      },
      {
        id: 'lat-pulldown',
        name: 'Pull-Ups (or Lat Pulldown)',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '6-12 reps',
        tips: 'Pull your chin over the bar (or the bar to your chest) by driving your elbows down and back, then return with control.',
      },
      {
        id: 'dumbbell-incline-press',
        name: 'Dumbbell Incline Press',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '10-12 reps',
        tips: 'Set the bench to a slight incline and press the dumbbells up and slightly inward without locking your elbows hard.',
      },
      {
        id: 'dumbbell-rows',
        name: 'Dumbbell Rows (Single Arm)',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '10-12 reps each arm',
        tips: 'Support yourself with one hand on a bench, keep your back flat, and pull the dumbbell to your hip.',
      },
      {
        id: 'lateral-raises',
        name: 'Lateral Raises',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '12-15 reps',
        tips: 'Raise the dumbbells out to your sides to shoulder height with a slight elbow bend, leading with your elbows.',
      },
    ],
    workoutTips: [
      {
        heading: 'Weight Guidelines',
        bullets: [
          'Beginner: Start with bodyweight or light dumbbells',
          'Intermediate: 8-10 reps should feel challenging on last 2',
          'Advanced: Add 2.5-5 lbs when you complete all sets easily',
        ],
      },
      {
        heading: 'Rest Times',
        bullets: [
          'Compound exercises (bench, rows, press): 90-120 seconds',
          'Isolation exercises (laterals, dips): 60 seconds',
        ],
      },
      {
        heading: 'Safety Essentials',
        bullets: [
          'Always use a spotter for heavy bench press',
          'Stop if you feel joint pain (muscle fatigue is normal)',
          'Form over weight - always',
        ],
      },
      {
        heading: 'Quick Troubleshooting',
        bullets: [
          'Too easy? Add weight next session',
          "Can't complete reps? Reduce weight by 10%",
          "Can't feel target muscle? Slow down, focus on control",
        ],
      },
    ],
    equipment: [
      {
        heading: 'Essential Equipment',
        bullets: [
          'Barbell - Olympic or standard barbell',
          'Weight Plates - Various weights for progression',
          'Adjustable Bench - Flat and incline positions',
          'Dumbbells - Set of various weights or adjustable',
          'Pull-up Bar - Wall-mounted, doorway, or gym station',
        ],
      },
      {
        heading: 'Equipment Alternatives',
        bullets: [
          'No Pull-up Bar? Use lat pulldown machine or resistance bands',
          'No Barbell? Replace with dumbbell variations',
          'No Adjustable Bench? Use flat bench or floor exercises',
          'Limited Weights? Focus on higher reps and slower tempo',
        ],
      },
    ],
  },
  {
    id: 'hiit-fat-burner',
    name: 'HIIT Fat Burner',
    durationMinutes: 30,
    caloriesRangeLabel: '250-400 Calories',
    equipmentRequired: false,
    category: 'quick_start',
    tags: ['lose_weight', 'build_endurance'],
    exercises: [
      {
        id: 'jumping-jacks',
        name: 'Jumping Jacks',
        logType: 'duration',
        targetSets: 4,
        targetRepsLabel: '45 sec work / 15 sec rest',
        tips: 'Jump your feet out while raising your arms overhead, then back to start, staying light on your feet.',
      },
      {
        id: 'mountain-climbers',
        name: 'Mountain Climbers',
        logType: 'duration',
        targetSets: 4,
        targetRepsLabel: '45 sec work / 15 sec rest',
        tips: 'Hold a plank and drive your knees toward your chest quickly while keeping your hips level.',
      },
      {
        id: 'high-knees',
        name: 'High Knees',
        logType: 'duration',
        targetSets: 4,
        targetRepsLabel: '45 sec work / 15 sec rest',
        tips: 'Drive your knees up toward your waist at a quick pace, staying light on your feet.',
      },
      {
        id: 'burpees',
        name: 'Burpees',
        logType: 'duration',
        targetSets: 4,
        targetRepsLabel: '45 sec work / 15 sec rest',
        tips: 'Drop into a squat, kick back into a plank, do a push-up, then jump your feet forward and explode up.',
      },
    ],
    workoutTips: [
      {
        heading: 'Intensity',
        bullets: [
          'Go all-out during work intervals - this is what drives the burn',
          'Modify to low-impact versions if joints need a break',
        ],
      },
      {
        heading: 'Safety Essentials',
        bullets: ['Stop if you feel dizzy or overly short of breath', 'Land softly on jumps'],
      },
    ],
    equipment: [
      {
        heading: 'Essential Equipment',
        bullets: ['None - bodyweight only'],
      },
    ],
  },
  {
    id: 'core-crusher',
    name: 'Core Crusher',
    durationMinutes: 15,
    caloriesRangeLabel: '80-150 Calories',
    equipmentRequired: false,
    category: 'quick_start',
    tags: ['build_strength', 'build_endurance'],
    exercises: [
      {
        id: 'plank',
        name: 'Plank',
        logType: 'duration',
        targetSets: 3,
        targetRepsLabel: '30-45 sec hold',
        tips: 'Keep a straight line from head to heels, brace your core, and don\'t let your hips sag.',
      },
      {
        id: 'bicycle-crunches',
        name: 'Bicycle Crunches',
        logType: 'reps_weight',
        tracksWeight: false,
        targetSets: 3,
        targetRepsLabel: '15-20 reps each side',
        tips: 'Bring opposite elbow to opposite knee with a controlled twist, keeping your lower back pressed to the floor.',
      },
      {
        id: 'leg-raises',
        name: 'Leg Raises',
        logType: 'reps_weight',
        tracksWeight: false,
        targetSets: 3,
        targetRepsLabel: '12-15 reps',
        tips: 'Keep your lower back flat on the floor and lower your legs only as far as you can control.',
      },
      {
        id: 'russian-twists',
        name: 'Russian Twists',
        logType: 'reps_weight',
        tracksWeight: false,
        targetSets: 3,
        targetRepsLabel: '20 reps total',
        tips: 'Lean back slightly with a straight spine and rotate your torso side to side, tapping the floor beside your hips.',
      },
    ],
    workoutTips: [
      {
        heading: 'Form',
        bullets: [
          'Keep your lower back pressed toward the floor on crunches and raises',
          'Breathe out on the exertion phase of each rep',
        ],
      },
    ],
    equipment: [
      {
        heading: 'Essential Equipment',
        bullets: ['None - bodyweight only', 'Optional: mat for comfort'],
      },
    ],
  },
];

export const workoutTemplates: WorkoutTemplate[] = [
  ...presetsAndQuickStarts,
  ...browseWorkoutTemplates,
];
