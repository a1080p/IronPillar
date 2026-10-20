// The canonical exercise catalog: one entry per real exercise, shared by the
// workout templates, swaps, and history. `name` is what history is stored
// under (logs, personal records, "last time", notes), so renaming an entry
// splits its history: move the old name into `aliases` instead (and, if a
// template used the old name, into RENAMED_EXERCISES in
// functions/src/achievements.ts so its personal-record best follows). Aliases also
// let older logs and typed custom-workout names find their entry.
//
// Form photos come from free-exercise-db (github.com/yuhonas/free-exercise-db,
// public domain under the Unlicense): two photos per exercise, start and end
// position. They're served by jsDelivr pinned to one commit so they can't
// change or disappear underneath us.
//
// Segments that aren't a reusable exercise ("Cool-Down Spin", "Match Play")
// have no entry; their template exercise simply has no catalogId.
import type { ExerciseSpec } from '../types/models';

export type Muscle =
  | 'abdominals'
  | 'abductors'
  | 'adductors'
  | 'biceps'
  | 'calves'
  | 'chest'
  | 'forearms'
  | 'glutes'
  | 'hamstrings'
  | 'lats'
  | 'lower back'
  | 'middle back'
  | 'neck'
  | 'quadriceps'
  | 'shoulders'
  | 'traps'
  | 'triceps';

export type Equipment =
  | 'barbell'
  | 'bodyweight'
  | 'cable'
  | 'dumbbell'
  | 'foam roll'
  | 'kettlebell'
  | 'machine'
  | 'medicine ball'
  | 'other';

export interface CatalogExercise {
  id: string;
  name: string;
  aliases?: string[];
  logType: ExerciseSpec['logType'];
  tracksWeight?: boolean; // default true for reps_weight
  equipment: Equipment;
  primaryMuscles: Muscle[];
  formPhotos?: string; // free-exercise-db exercise folder (holds 0.jpg and 1.jpg)
}

const FORM_PHOTO_BASE =
  'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/';

export const MUSCLE_LABELS: Record<Muscle, string> = {
  abdominals: 'Abs',
  abductors: 'Outer thighs',
  adductors: 'Inner thighs',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  'lower back': 'Lower back',
  'middle back': 'Upper back',
  neck: 'Neck',
  quadriceps: 'Quads',
  shoulders: 'Shoulders',
  traps: 'Traps',
  triceps: 'Triceps',
};

export const EXERCISE_CATALOG: CatalogExercise[] = [
  { id: 'barbell-back-squat', name: 'Barbell Back Squat', aliases: ['Back Squat', 'Squat', 'Barbell Squat'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['quadriceps'], formPhotos: 'Barbell_Squat' },
  { id: 'front-squat', name: 'Barbell Front Squat', aliases: ['Front Squat'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['quadriceps'], formPhotos: 'Front_Barbell_Squat' },
  { id: 'barbell-bench-press', name: 'Barbell Bench Press', aliases: ['Bench Press', 'Bench'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['chest'], formPhotos: 'Barbell_Bench_Press_-_Medium_Grip' },
  { id: 'incline-barbell-bench-press', name: 'Incline Barbell Bench Press', aliases: ['Incline Bench Press'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['chest'], formPhotos: 'Barbell_Incline_Bench_Press_-_Medium_Grip' },
  { id: 'close-grip-bench-press', name: 'Close-Grip Bench Press', logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['triceps'], formPhotos: 'Close-Grip_Barbell_Bench_Press' },
  { id: 'barbell-row', name: 'Barbell Bent-Over Row', aliases: ['Bent-Over Barbell Row', 'Barbell Row', 'Bent Over Row'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['middle back'], formPhotos: 'Bent_Over_Barbell_Row' },
  { id: 'barbell-curl', name: 'Barbell Curl', logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['biceps'], formPhotos: 'Barbell_Curl' },
  { id: 'ez-bar-curl', name: 'EZ-Bar Curl', logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['biceps'], formPhotos: 'EZ-Bar_Curl' },
  { id: 'barbell-deadlift', name: 'Barbell Deadlift', aliases: ['Conventional Deadlift', 'Deadlift'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['lower back'], formPhotos: 'Barbell_Deadlift' },
  { id: 'trap-bar-deadlift', name: 'Trap Bar Deadlift', aliases: ['Hex Bar Deadlift'], logType: 'reps_weight', equipment: 'other', primaryMuscles: ['quadriceps'], formPhotos: 'Trap_Bar_Deadlift' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', aliases: ['RDL', 'Barbell Romanian Deadlift'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['hamstrings'], formPhotos: 'Romanian_Deadlift' },
  { id: 'barbell-overhead-press', name: 'Barbell Overhead Press', aliases: ['Overhead Press (Standing)', 'Overhead Press', 'Military Press', 'OHP'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['shoulders'], formPhotos: 'Standing_Military_Press' },
  { id: 'barbell-shrug', name: 'Barbell Shrug', aliases: ['Shrugs'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['traps'], formPhotos: 'Barbell_Shrug' },
  { id: 'barbell-hip-thrust', name: 'Barbell Hip Thrust', aliases: ['Hip Thrust'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['glutes'], formPhotos: 'Barbell_Hip_Thrust' },
  { id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['chest'], formPhotos: 'Dumbbell_Bench_Press' },
  { id: 'incline-dumbbell-press', name: 'Incline Dumbbell Press', aliases: ['Dumbbell Incline Press'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['chest'], formPhotos: 'Incline_Dumbbell_Press' },
  { id: 'dumbbell-fly', name: 'Dumbbell Fly', aliases: ['Dumbbell Flyes', 'Chest Fly'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['chest'], formPhotos: 'Dumbbell_Flyes' },
  { id: 'cable-fly', name: 'Cable Fly', aliases: ['Cable Flyes', 'Cable Crossover'], logType: 'reps_weight', equipment: 'cable', primaryMuscles: ['chest'], formPhotos: 'Flat_Bench_Cable_Flyes' },
  { id: 'machine-chest-press', name: 'Machine Chest Press', aliases: ['Chest Press'], logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['chest'], formPhotos: 'Machine_Bench_Press' },
  { id: 'dumbbell-row-two-arm', name: 'Bent-Over Dumbbell Row', logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['middle back'], formPhotos: 'Bent_Over_Two-Dumbbell_Row' },
  { id: 'single-arm-dumbbell-row', name: 'Single-Arm Dumbbell Row', aliases: ['Dumbbell Rows (Single Arm)', 'Dumbbell Row', 'One-Arm Dumbbell Row'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['middle back'], formPhotos: 'One-Arm_Dumbbell_Row' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', aliases: ['Cable Row'], logType: 'reps_weight', equipment: 'cable', primaryMuscles: ['middle back'], formPhotos: 'Seated_Cable_Rows' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', aliases: ['Lat Pull-Down', 'Pulldown'], logType: 'reps_weight', equipment: 'cable', primaryMuscles: ['lats'], formPhotos: 'Wide-Grip_Lat_Pulldown' },
  { id: 'pull-ups', name: 'Pull-Ups', aliases: ['Pull-Ups (or Lat Pulldown)', 'Pull Up', 'Pull-Up', 'Pullups'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['lats'], formPhotos: 'Pullups' },
  { id: 'chin-ups', name: 'Chin-Ups', aliases: ['Chin-Up', 'Chin Up'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['lats'], formPhotos: 'Chin-Up' },
  { id: 'assisted-pull-ups', name: 'Band-Assisted Pull-Ups', aliases: ['Assisted Pull-Up'], logType: 'reps_weight', tracksWeight: false, equipment: 'other', primaryMuscles: ['lats'], formPhotos: 'Band_Assisted_Pull-Up' },
  { id: 'inverted-row', name: 'Inverted Row', aliases: ['Bodyweight Row'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['middle back'], formPhotos: 'Inverted_Row' },
  { id: 'reverse-fly', name: 'Reverse Dumbbell Fly', aliases: ['Reverse Fly', 'Rear Delt Fly'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['shoulders'], formPhotos: 'Reverse_Flyes' },
  { id: 'face-pull', name: 'Face Pull', logType: 'reps_weight', equipment: 'cable', primaryMuscles: ['shoulders'], formPhotos: 'Face_Pull' },
  { id: 'cable-curl', name: 'Cable Curl', logType: 'reps_weight', equipment: 'cable', primaryMuscles: ['biceps'], formPhotos: 'Standing_Biceps_Cable_Curl' },
  { id: 'hammer-curl', name: 'Hammer Curl', aliases: ['Hammer Curls'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['biceps'], formPhotos: 'Hammer_Curls' },
  { id: 'dumbbell-curl', name: 'Dumbbell Biceps Curl', aliases: ['Dumbbell Curl', 'Bicep Curl', 'Biceps Curl'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['biceps'], formPhotos: 'Dumbbell_Bicep_Curl' },
  { id: 'preacher-curl', name: 'Preacher Curl', logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['biceps'], formPhotos: 'Preacher_Curl' },
  { id: 'cable-triceps-pushdown', name: 'Cable Triceps Pushdown', aliases: ['Triceps Pushdown', 'Tricep Pushdown'], logType: 'reps_weight', equipment: 'cable', primaryMuscles: ['triceps'], formPhotos: 'Triceps_Pushdown' },
  { id: 'overhead-triceps-extension', name: 'Overhead Triceps Extension', aliases: ['Overhead Tricep Extension'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['triceps'], formPhotos: 'Standing_Dumbbell_Triceps_Extension' },
  { id: 'skull-crushers', name: 'Skull Crushers', aliases: ['Skullcrusher', 'Skull Crusher'], logType: 'reps_weight', equipment: 'barbell', primaryMuscles: ['triceps'], formPhotos: 'EZ-Bar_Skullcrusher' },
  { id: 'triceps-kickback', name: 'Triceps Kickback', aliases: ['Tricep Kickback'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['triceps'], formPhotos: 'Tricep_Dumbbell_Kickback' },
  { id: 'dips', name: 'Dips', aliases: ['Triceps Dips', 'Bench Dips'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['triceps'], formPhotos: 'Dips_-_Triceps_Version' },
  { id: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['shoulders'], formPhotos: 'Dumbbell_Shoulder_Press' },
  { id: 'seated-dumbbell-overhead-press', name: 'Seated Dumbbell Overhead Press', aliases: ['Seated Dumbbell Press'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['shoulders'], formPhotos: 'Seated_Dumbbell_Press' },
  { id: 'arnold-press', name: 'Arnold Press', aliases: ['Arnold Dumbbell Press'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['shoulders'], formPhotos: 'Arnold_Dumbbell_Press' },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['shoulders'], formPhotos: 'Machine_Shoulder_Military_Press' },
  { id: 'lateral-raises', name: 'Lateral Raises', aliases: ['Lateral Raise', 'Dumbbell Lateral Raise', 'Side Lateral Raise'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['shoulders'], formPhotos: 'Side_Lateral_Raise' },
  { id: 'dumbbell-shrug', name: 'Dumbbell Shrug', logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['traps'], formPhotos: 'Dumbbell_Shrug' },
  { id: 'dumbbell-goblet-squat', name: 'Dumbbell Goblet Squat', aliases: ['Goblet Squat'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['quadriceps'], formPhotos: 'Goblet_Squat' },
  { id: 'kettlebell-goblet-squat', name: 'Kettlebell Goblet Squat', logType: 'reps_weight', equipment: 'kettlebell', primaryMuscles: ['quadriceps'], formPhotos: 'Goblet_Squat' },
  { id: 'dumbbell-romanian-deadlift', name: 'Dumbbell Romanian Deadlift', aliases: ['Dumbbell RDL'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['hamstrings'], formPhotos: 'Stiff-Legged_Dumbbell_Deadlift' },
  { id: 'dumbbell-lunges', name: 'Dumbbell Lunges', aliases: ['Lunges', 'Lunge'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['quadriceps'], formPhotos: 'Dumbbell_Lunges' },
  { id: 'walking-lunges', name: 'Walking Lunges', aliases: ['Walking Lunge'], logType: 'reps_weight', equipment: 'bodyweight', primaryMuscles: ['quadriceps'], formPhotos: 'Bodyweight_Walking_Lunge' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', aliases: ['Split Squat'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['quadriceps'], formPhotos: 'Split_Squat_with_Dumbbells' },
  { id: 'leg-press', name: 'Leg Press', logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Leg_Press' },
  { id: 'hack-squat', name: 'Hack Squat', logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Hack_Squat' },
  { id: 'leg-extension', name: 'Leg Extension', aliases: ['Leg Extensions'], logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Leg_Extensions' },
  { id: 'lying-leg-curl', name: 'Lying Leg Curl', aliases: ['Leg Curl', 'Hamstring Curl'], logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['hamstrings'], formPhotos: 'Lying_Leg_Curls' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['hamstrings'], formPhotos: 'Seated_Leg_Curl' },
  { id: 'standing-calf-raises', name: 'Standing Calf Raises', aliases: ['Calf Raises', 'Calf Raise'], logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['calves'], formPhotos: 'Standing_Calf_Raises' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', logType: 'reps_weight', equipment: 'machine', primaryMuscles: ['calves'], formPhotos: 'Seated_Calf_Raise' },
  { id: 'glute-bridge', name: 'Glute Bridge', aliases: ['Bridge'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['glutes'], formPhotos: 'Butt_Lift_Bridge' },
  { id: 'back-extension', name: 'Back Extension', aliases: ['Hyperextension'], logType: 'reps_weight', equipment: 'other', primaryMuscles: ['lower back'], formPhotos: 'Hyperextensions_Back_Extensions' },
  { id: 'box-step-ups', name: 'Box Step-Ups', aliases: ['Step-Ups', 'Step Ups'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['quadriceps'], formPhotos: 'Dumbbell_Step_Ups' },
  { id: 'farmers-carry', name: "Farmer's Carry", aliases: ["Farmer's Walk", 'Farmers Carry'], logType: 'duration', equipment: 'other', primaryMuscles: ['forearms'], formPhotos: 'Farmers_Walk' },
  { id: 'dumbbell-thrusters', name: 'Dumbbell Thrusters', aliases: ['Thrusters'], logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['quadriceps', 'shoulders'] },
  { id: 'kettlebell-swing', name: 'Kettlebell Swing', aliases: ['Kettlebell Swings'], logType: 'reps_weight', equipment: 'kettlebell', primaryMuscles: ['glutes', 'hamstrings'] },
  { id: 'kettlebell-clean-press', name: 'Kettlebell Clean & Press', logType: 'reps_weight', equipment: 'kettlebell', primaryMuscles: ['shoulders', 'glutes'] },
  { id: 'single-arm-kettlebell-row', name: 'Single-Arm Kettlebell Row', aliases: ['Kettlebell Row'], logType: 'reps_weight', equipment: 'kettlebell', primaryMuscles: ['middle back'], formPhotos: 'One-Arm_Kettlebell_Row' },
  { id: 'medicine-ball-slam', name: 'Medicine Ball Slam', aliases: ['Ball Slams'], logType: 'reps_weight', equipment: 'medicine ball', primaryMuscles: ['abdominals', 'shoulders'], formPhotos: 'Overhead_Slam' },
  { id: 'sled-push', name: 'Sled Push', logType: 'duration', equipment: 'other', primaryMuscles: ['quadriceps'], formPhotos: 'Sled_Push' },
  { id: 'tire-flips', name: 'Tire Flips', aliases: ['Tire Flip'], logType: 'reps_weight', tracksWeight: false, equipment: 'other', primaryMuscles: ['quadriceps'], formPhotos: 'Tire_Flip' },
  { id: 'tire-sledgehammer-slams', name: 'Tire Sledgehammer Slams', aliases: ['Sledgehammer Slams'], logType: 'duration', equipment: 'other', primaryMuscles: ['abdominals'], formPhotos: 'Sledgehammer_Swings' },
  { id: 'battle-rope-waves', name: 'Alternating Waves', aliases: ['Battle Rope Waves'], logType: 'duration', equipment: 'other', primaryMuscles: ['shoulders'], formPhotos: 'Battling_Ropes' },
  { id: 'battle-rope-slams', name: 'Rope Slams', aliases: ['Battle Rope Slams'], logType: 'duration', equipment: 'other', primaryMuscles: ['shoulders'], formPhotos: 'Battling_Ropes' },
  { id: 'box-jumps', name: 'Box Jumps', aliases: ['Box Jump'], logType: 'reps_weight', tracksWeight: false, equipment: 'other', primaryMuscles: ['hamstrings'], formPhotos: 'Front_Box_Jump' },
  { id: 'push-ups', name: 'Push-Ups', aliases: ['Push Up', 'Push-Up', 'Pushups'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['chest'], formPhotos: 'Pushups' },
  { id: 'incline-push-ups', name: 'Incline Push-Ups', aliases: ['Incline Push-Up'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['chest'], formPhotos: 'Incline_Push-Up' },
  { id: 'bodyweight-squat', name: 'Bodyweight Squat', aliases: ['Air Squat', 'Air Squats'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['quadriceps'], formPhotos: 'Bodyweight_Squat' },
  { id: 'burpees', name: 'Burpees', aliases: ['Burpee'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps', 'chest'] },
  { id: 'jumping-jacks', name: 'Jumping Jacks', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps', 'calves'] },
  { id: 'high-knees', name: 'High Knees', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps', 'hamstrings'] },
  { id: 'mountain-climbers', name: 'Mountain Climbers', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps'], formPhotos: 'Mountain_Climbers' },
  { id: 'squat-jumps', name: 'Squat Jumps', aliases: ['Jump Squats', 'Jump Squat'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps'], formPhotos: 'Freehand_Jump_Squat' },
  { id: 'jump-lunges', name: 'Jump Lunges', aliases: ['Jumping Lunges'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps'], formPhotos: 'Split_Jump' },
  { id: 'plank-jacks', name: 'Plank Jacks', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['abdominals', 'shoulders'] },
  { id: 'plank', name: 'Plank', aliases: ['Front Plank', 'Forearm Plank'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Plank' },
  { id: 'side-plank', name: 'Side Plank', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Side_Bridge' },
  { id: 'side-plank-rotation', name: 'Side Plank with Rotation', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'] },
  { id: 'plank-dumbbell-drag', name: 'Plank Dumbbell Drag', logType: 'reps_weight', equipment: 'dumbbell', primaryMuscles: ['abdominals', 'shoulders'] },
  { id: 'crunches', name: 'Crunches', aliases: ['Crunch'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Crunches' },
  { id: 'bicycle-crunches', name: 'Bicycle Crunches', aliases: ['Bicycle Crunch'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Air_Bike' },
  { id: 'cable-crunch', name: 'Cable Crunch', logType: 'reps_weight', equipment: 'cable', primaryMuscles: ['abdominals'], formPhotos: 'Cable_Crunch' },
  { id: 'russian-twists', name: 'Russian Twists', aliases: ['Russian Twist'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Russian_Twist' },
  { id: 'weighted-russian-twist', name: 'Weighted Russian Twist', logType: 'reps_weight', equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Russian_Twist' },
  { id: 'weighted-sit-up', name: 'Weighted Sit-Up', logType: 'reps_weight', equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Sit-Up' },
  { id: 'sit-ups', name: 'Sit-Ups', aliases: ['Sit-Up', 'Sit Up'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Sit-Up' },
  { id: 'leg-raises', name: 'Leg Raises', aliases: ['Leg Raise', 'Lying Leg Raise'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Flat_Bench_Lying_Leg_Raise' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Hanging_Leg_Raise' },
  { id: 'v-ups', name: 'V-Ups', aliases: ['V-Up'], logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Jackknife_Sit-Up' },
  { id: 'dead-bug', name: 'Dead Bug', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Dead_Bug' },
  { id: 'bird-dog', name: 'Bird Dog', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['lower back', 'abdominals'] },
  { id: 'superman', name: 'Superman', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['lower back'], formPhotos: 'Superman' },
  { id: 'flutter-kicks', name: 'Flutter Kicks', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['glutes'], formPhotos: 'Flutter_Kicks' },
  { id: 'scissor-kicks', name: 'Scissor Kicks', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['abdominals'], formPhotos: 'Scissor_Kick' },
  { id: 'windshield-wipers', name: 'Windshield Wipers', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'] },
  { id: 'the-hundred', name: 'The Hundred', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['abdominals'] },
  { id: 'roll-up', name: 'Roll-Up', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'] },
  { id: 'teaser', name: 'Teaser', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'] },
  { id: 'single-leg-stretch', name: 'Single-Leg Stretch', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'] },
  { id: 'leg-circles', name: 'Leg Circles', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals', 'adductors'] },
  { id: 'side-kick-series', name: 'Side Kick Series', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['glutes', 'abductors'] },
  { id: 'standing-leg-lifts', name: 'Standing Leg Lifts', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['glutes'] },
  { id: 'standing-side-bend', name: 'Standing Side Bend', logType: 'reps_weight', tracksWeight: false, equipment: 'bodyweight', primaryMuscles: ['abdominals'] },
  { id: 'jump-rope', name: 'Basic Jump Rope', aliases: ['Jump Rope'], logType: 'duration', equipment: 'other', primaryMuscles: ['quadriceps'], formPhotos: 'Rope_Jumping' },
  { id: 'high-knee-jump-rope', name: 'High-Knee Jump Rope', logType: 'duration', equipment: 'other', primaryMuscles: ['quadriceps'], formPhotos: 'Rope_Jumping' },
  { id: 'steady-elliptical', name: 'Steady Elliptical', aliases: ['Elliptical'], logType: 'duration', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Elliptical_Trainer' },
  { id: 'stair-climber', name: 'Stair Climber Steady Climb', aliases: ['Stair Climber', 'Stairmaster'], logType: 'duration', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Stairmaster' },
  { id: 'rowing-machine', name: 'Rowing Machine', aliases: ['Row Machine', 'Rower'], logType: 'duration', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Rowing_Stationary' },
  { id: 'stationary-bike', name: 'Stationary Bike', aliases: ['Exercise Bike'], logType: 'duration', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Bicycling_Stationary' },
  { id: 'treadmill-run', name: 'Treadmill Run', aliases: ['Treadmill'], logType: 'duration', equipment: 'machine', primaryMuscles: ['quadriceps'], formPhotos: 'Running_Treadmill' },
  { id: 'cat-cow', name: 'Cat-Cow', aliases: ['Cat Cow'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['lower back'], formPhotos: 'Cat_Stretch' },
  { id: 'childs-pose', name: "Child's Pose", aliases: ['Supported Child’s Pose', "Supported Child's Pose", 'Child’s Pose'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['lower back'], formPhotos: 'Childs_Pose' },
  { id: 'kneeling-hip-flexor-stretch', name: 'Kneeling Hip Flexor Stretch', aliases: ['Kneeling Hip Flexor Release', 'Hip Flexor Stretch'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps'], formPhotos: 'Kneeling_Hip_Flexor' },
  { id: 'worlds-greatest-stretch', name: "World's Greatest Stretch", logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['hamstrings'], formPhotos: 'Worlds_Greatest_Stretch' },
  { id: 'neck-side-stretch', name: 'Neck Side Stretch', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['neck'], formPhotos: 'Side_Neck_Stretch' },
  { id: 'cross-body-shoulder-stretch', name: 'Cross-Body Shoulder Stretch', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['shoulders'], formPhotos: 'Shoulder_Stretch' },
  { id: 'seated-figure-four', name: 'Seated Figure-Four Stretch', aliases: ['Figure Four Stretch'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['glutes'], formPhotos: 'Seated_Glute' },
  { id: 'standing-forward-fold', name: 'Standing Forward Fold', aliases: ['Forward Fold'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['hamstrings'], formPhotos: 'Standing_Toe_Touches' },
  { id: 'foam-roll-quads', name: 'Foam Roll Quads', logType: 'duration', equipment: 'foam roll', primaryMuscles: ['quadriceps'], formPhotos: 'Quadriceps-SMR' },
  { id: 'foam-roll-calves', name: 'Foam Roll Calves', logType: 'duration', equipment: 'foam roll', primaryMuscles: ['calves'], formPhotos: 'Calves-SMR' },
  { id: 'foam-roll-upper-back', name: 'Foam Roll Upper Back', logType: 'duration', equipment: 'foam roll', primaryMuscles: ['middle back'], formPhotos: 'Rhomboids-SMR' },
  { id: 'foam-roll-glutes', name: 'Foam Roll Glutes', logType: 'duration', equipment: 'foam roll', primaryMuscles: ['glutes'], formPhotos: 'Piriformis-SMR' },
  { id: 'standing-quad-stretch', name: 'Standing Quad Stretch', aliases: ['Quad Stretch'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['quadriceps'] },
  { id: 'standing-hamstring-stretch', name: 'Standing Hamstring Stretch', aliases: ['Hamstring Stretch'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['hamstrings'] },
  { id: 'seated-spinal-twist', name: 'Seated Spinal Twist', aliases: ['Deep Seated Spinal Twist'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['lower back'] },
  { id: 'downward-dog', name: 'Downward-Facing Dog', aliases: ['Downward Dog'], logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['hamstrings', 'shoulders'] },
  { id: 'pigeon-pose', name: 'Pigeon Pose', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['glutes'] },
  { id: 'tree-pose', name: 'Tree Pose', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['calves'] },
  { id: 'triangle-pose', name: 'Triangle Pose', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['hamstrings'] },
  { id: 'butterfly-pose', name: 'Butterfly Pose', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['adductors'] },
  { id: 'legs-up-the-wall', name: 'Legs Up the Wall', logType: 'duration', equipment: 'bodyweight', primaryMuscles: ['hamstrings'] },
];

// Lowercased, trimmed, curly apostrophes straightened — how names are compared.
export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/[’‘]/g, "'");
}

const byId = new Map(EXERCISE_CATALOG.map((e) => [e.id, e]));
const byName = new Map<string, CatalogExercise>();
for (const e of EXERCISE_CATALOG) {
  for (const n of [e.name, ...(e.aliases ?? [])]) byName.set(normalizeExerciseName(n), e);
}

export function catalogExerciseById(id: string | undefined): CatalogExercise | undefined {
  return id ? byId.get(id) : undefined;
}

// The catalog entry behind a template or custom exercise: by its catalogId
// when it has one, otherwise by its name or one of the entry's aliases.
export function findCatalogExercise(
  exercise: Pick<ExerciseSpec, 'name'> & { catalogId?: string }
): CatalogExercise | undefined {
  return catalogExerciseById(exercise.catalogId) ?? byName.get(normalizeExerciseName(exercise.name));
}

// The name history is keyed by: the catalog name for a known exercise or
// alias, else the name itself. Lets "Bent-Over Barbell Row" logged last month
// count as "Barbell Bent-Over Row" today.
export function canonicalExerciseName(name: string): string {
  return byName.get(normalizeExerciseName(name))?.name ?? name.trim();
}

// Start and end position photos, or none.
export function formPhotoUrls(exercise: CatalogExercise | undefined): string[] {
  if (!exercise?.formPhotos) return [];
  return [0, 1].map((i) => `${FORM_PHOTO_BASE}${exercise.formPhotos}/${i}.jpg`);
}

// Other catalog exercises that work the same main muscle, best match first:
// same equipment, then anything. Used to suggest swaps.
export function swapSuggestions(exercise: CatalogExercise | undefined, limit = 8): CatalogExercise[] {
  if (!exercise) return [];
  const muscle = exercise.primaryMuscles[0];
  const candidates = EXERCISE_CATALOG.filter(
    (e) => e.id !== exercise.id && e.logType === exercise.logType && e.primaryMuscles[0] === muscle
  );
  const score = (e: CatalogExercise) => (e.equipment === exercise.equipment ? 0 : 1);
  return candidates.sort((a, b) => score(a) - score(b)).slice(0, limit);
}

// Free-text search over names and aliases, for swapping to anything.
export function searchCatalog(query: string, limit = 20): CatalogExercise[] {
  const q = normalizeExerciseName(query);
  if (!q) return [];
  return EXERCISE_CATALOG.filter((e) =>
    [e.name, ...(e.aliases ?? [])].some((n) => normalizeExerciseName(n).includes(q))
  ).slice(0, limit);
}
