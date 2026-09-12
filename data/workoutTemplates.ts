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
        tips: 'Aim for 8-10 reps!',
      },
      {
        id: 'bent-over-barbell-row',
        name: 'Bent-Over Barbell Row',
        logType: 'reps_weight',
        targetSets: 4,
        targetRepsLabel: '8-10 reps',
        tips: 'Aim for 8-10 reps!',
      },
      {
        id: 'overhead-press',
        name: 'Overhead Press (Standing)',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '8-10 reps',
        tips: 'Aim for 8-10 reps!',
      },
      {
        id: 'lat-pulldown',
        name: 'Pull-Ups (or Lat Pulldown)',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '6-12 reps',
        tips: 'Aim for 8-10 reps!',
      },
      {
        id: 'dumbbell-incline-press',
        name: 'Dumbbell Incline Press',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '10-12 reps',
        tips: 'Aim for 8-10 reps!',
      },
      {
        id: 'dumbbell-rows',
        name: 'Dumbbell Rows (Single Arm)',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '10-12 reps each arm',
        tips: 'Aim for 8-10 reps!',
      },
      {
        id: 'lateral-raises',
        name: 'Lateral Raises',
        logType: 'reps_weight',
        targetSets: 3,
        targetRepsLabel: '12-15 reps',
        tips: 'Aim for 8-10 reps!',
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
    id: 'outdoor-walk',
    name: 'Outdoor Walk',
    durationMinutes: 25,
    caloriesRangeLabel: '150-220 Calories',
    equipmentRequired: false,
    category: 'quick_start',
    tags: ['lose_weight', 'build_endurance'],
    exercises: [
      {
        id: 'outdoor-walk',
        name: 'Outdoor Walk',
        logType: 'duration',
        targetSets: 1,
        targetRepsLabel: '25 minutes',
        tips: 'Keep a brisk, steady pace!',
      },
    ],
    workoutTips: [
      {
        heading: 'Pacing',
        bullets: [
          "Brisk means you can talk but couldn't sing",
          'Swing your arms to engage your upper body too',
        ],
      },
      {
        heading: 'Safety Essentials',
        bullets: ['Wear reflective gear if it is dark out', 'Stay hydrated, especially in heat'],
      },
    ],
    equipment: [
      {
        heading: 'Essential Equipment',
        bullets: ['Comfortable walking shoes'],
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
      },
      {
        id: 'mountain-climbers',
        name: 'Mountain Climbers',
        logType: 'duration',
        targetSets: 4,
        targetRepsLabel: '45 sec work / 15 sec rest',
      },
      {
        id: 'high-knees',
        name: 'High Knees',
        logType: 'duration',
        targetSets: 4,
        targetRepsLabel: '45 sec work / 15 sec rest',
      },
      {
        id: 'burpees',
        name: 'Burpees',
        logType: 'duration',
        targetSets: 4,
        targetRepsLabel: '45 sec work / 15 sec rest',
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
      },
      {
        id: 'bicycle-crunches',
        name: 'Bicycle Crunches',
        logType: 'reps_weight',
        tracksWeight: false,
        targetSets: 3,
        targetRepsLabel: '15-20 reps each side',
      },
      {
        id: 'leg-raises',
        name: 'Leg Raises',
        logType: 'reps_weight',
        tracksWeight: false,
        targetSets: 3,
        targetRepsLabel: '12-15 reps',
      },
      {
        id: 'russian-twists',
        name: 'Russian Twists',
        logType: 'reps_weight',
        tracksWeight: false,
        targetSets: 3,
        targetRepsLabel: '20 reps total',
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
