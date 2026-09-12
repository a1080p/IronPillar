// Static library of workouts for the Browse tab, sectioned by activity type.
// Seeded into Firestore's `workoutTemplates` collection alongside the presets
// and quick-starts in `workoutTemplates.ts` (see scripts/seed-workouts.ts).
import type { ExerciseSpec, FitnessGoal, InfoSection, WorkoutTemplate } from '../types/models';

// Ordered list of section labels shown on the Browse tab.
export const BROWSE_CATEGORIES = [
  'Cardio',
  'Strength Training',
  'HIIT',
  'Yoga',
  'Pilates & Core',
  'Group Fitness Classes',
  'Swimming',
  'Cycling',
  'Sports & Outdoor',
  'Stretching & Recovery',
] as const;

function ex(
  id: string,
  name: string,
  logType: ExerciseSpec['logType'],
  targetSets: number,
  targetRepsLabel: string,
  opts: Partial<ExerciseSpec> = {}
): ExerciseSpec {
  return { id, name, logType, targetSets, targetRepsLabel, ...opts };
}

function info(heading: string, bullets: string[]): InfoSection {
  return { heading, bullets };
}

function browse(
  id: string,
  name: string,
  browseCategory: (typeof BROWSE_CATEGORIES)[number],
  durationMinutes: number,
  caloriesRangeLabel: string,
  equipmentRequired: boolean,
  tags: FitnessGoal[],
  exercises: ExerciseSpec[],
  workoutTips: InfoSection[],
  equipment: InfoSection[]
): WorkoutTemplate {
  return {
    id,
    name,
    durationMinutes,
    caloriesRangeLabel,
    equipmentRequired,
    category: 'browse',
    browseCategory,
    tags,
    workoutTips,
    equipment,
    exercises,
  };
}

export const browseWorkoutTemplates: WorkoutTemplate[] = [
  // ---------------------------------------------------------------- Cardio
  browse(
    'treadmill-interval-sprints',
    'Treadmill Interval Sprints',
    'Cardio',
    30,
    '300-420 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('warmup-jog', 'Warm-Up Jog', 'duration', 1, '5 minutes easy pace'),
      ex('sprint-intervals', 'Sprint Intervals', 'duration', 6, '30 sec sprint / 90 sec walk'),
      ex('incline-power-walk', 'Incline Power Walk', 'duration', 1, '10 minutes at 8-12% incline'),
      ex('cooldown-walk', 'Cool-Down Walk', 'duration', 1, '5 minutes easy pace'),
    ],
    [info('Pacing', ['Sprints should feel like 90% effort', 'Use incline walk to recover active-ly'])],
    [info('Essential Equipment', ['Treadmill', 'Supportive running shoes'])]
  ),
  browse(
    'steady-state-outdoor-run',
    'Steady-State Outdoor Run',
    'Cardio',
    40,
    '350-500 Calories',
    false,
    ['lose_weight', 'build_endurance'],
    [ex('outdoor-run', 'Outdoor Run', 'duration', 1, '40 minutes at conversational pace')],
    [info('Pacing', ['You should be able to talk in short sentences the whole run', 'Negative-split the last 10 minutes if you feel strong'])],
    [info('Essential Equipment', ['Running shoes'])]
  ),
  browse(
    'stair-climber-burn',
    'Stair Climber Burn',
    'Cardio',
    25,
    '250-350 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('stair-climber-steady', 'Stair Climber Steady Climb', 'duration', 1, '15 minutes moderate pace'),
      ex('stair-climber-surges', 'Stair Climber Surges', 'duration', 5, '1 min fast / 1 min moderate'),
    ],
    [info('Form', ['Stand tall, avoid leaning on the rails', 'Take full steps rather than tiny shuffles'])],
    [info('Essential Equipment', ['Stair climber machine'])]
  ),
  browse(
    'jump-rope-cardio-blast',
    'Jump Rope Cardio Blast',
    'Cardio',
    20,
    '220-300 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('jump-rope-basic', 'Basic Jump Rope', 'duration', 5, '1 min work / 30 sec rest'),
      ex('jump-rope-high-knees', 'High-Knee Jump Rope', 'duration', 3, '45 sec work / 30 sec rest'),
    ],
    [info('Form', ['Small jumps, land softly on the balls of your feet', 'Keep elbows close to your body'])],
    [info('Essential Equipment', ['Jump rope', 'Cushioned shoes'])]
  ),
  browse(
    'rowing-machine-sprints',
    'Rowing Machine Sprints',
    'Cardio',
    25,
    '260-380 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('row-warmup', 'Easy Row Warm-Up', 'duration', 1, '5 minutes light pace'),
      ex('row-sprints', '500m Sprint Intervals', 'duration', 5, '500m hard / 2 min rest'),
    ],
    [info('Form', ['Drive with your legs first, then lean back, then pull', "Don't round your lower back"])],
    [info('Essential Equipment', ['Rowing machine'])]
  ),
  browse(
    'elliptical-fat-burn',
    'Elliptical Fat Burn',
    'Cardio',
    35,
    '280-400 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('elliptical-steady', 'Steady Elliptical', 'duration', 1, '25 minutes moderate resistance'),
      ex('elliptical-reverse', 'Reverse Pedal Intervals', 'duration', 4, '1 min reverse / 1 min forward'),
    ],
    [info('Pacing', ['Keep resistance high enough that the last 5 minutes feel challenging'])],
    [info('Essential Equipment', ['Elliptical machine'])]
  ),
  browse(
    'assault-bike-intervals',
    'Assault Bike Intervals',
    'Cardio',
    25,
    '280-380 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('assault-bike-warmup', 'Easy Pedal Warm-Up', 'duration', 1, '3 minutes'),
      ex('assault-bike-intervals', '20-Cal Sprint Intervals', 'duration', 8, '20 calories fast / 45 sec rest'),
    ],
    [info('Intensity', ['Use both arms and legs together for max calorie burn', 'Each sprint should leave you breathless by the end'])],
    [info('Essential Equipment', ['Assault/air bike'])]
  ),
  browse(
    'cardio-ladder-agility',
    'Cardio Ladder & Agility',
    'Cardio',
    20,
    '200-300 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('agility-ladder-drills', 'Agility Ladder Footwork', 'duration', 6, '30 seconds per drill'),
      ex('cone-shuttle-cardio', 'Cone Shuttle Runs', 'duration', 5, '20 sec sprint / 40 sec rest'),
    ],
    [info('Form', ['Stay light on your feet and look up, not down at the ladder', 'Quick, small steps beat big, slow ones'])],
    [info('Essential Equipment', ['Agility ladder', 'Cones (optional)'])]
  ),

  // -------------------------------------------------------- Strength Training
  browse(
    'leg-day-squats-lunges',
    'Leg Day: Squats & Lunges',
    'Strength Training',
    50,
    '350-480 Calories',
    true,
    ['build_strength'],
    [
      ex('barbell-back-squat', 'Barbell Back Squat', 'reps_weight', 4, '6-8 reps'),
      ex('walking-lunges', 'Walking Lunges', 'reps_weight', 3, '10-12 reps each leg'),
      ex('romanian-deadlift', 'Romanian Deadlift', 'reps_weight', 3, '8-10 reps'),
      ex('leg-press', 'Leg Press', 'reps_weight', 3, '10-12 reps'),
      ex('calf-raises', 'Standing Calf Raises', 'reps_weight', 4, '15-20 reps'),
    ],
    [info('Rest Times', ['Compound lifts (squat, deadlift): 2-3 minutes', 'Accessory work (lunges, calves): 60-90 seconds'])],
    [info('Essential Equipment', ['Barbell and plates', 'Squat rack', 'Leg press machine (optional)'])]
  ),
  browse(
    'push-day-chest-shoulders-triceps',
    'Push Day: Chest, Shoulders & Triceps',
    'Strength Training',
    45,
    '320-450 Calories',
    true,
    ['build_strength'],
    [
      ex('barbell-bench-press-push', 'Barbell Bench Press', 'reps_weight', 4, '6-8 reps'),
      ex('seated-overhead-press', 'Seated Dumbbell Overhead Press', 'reps_weight', 3, '8-10 reps'),
      ex('incline-dumbbell-press', 'Incline Dumbbell Press', 'reps_weight', 3, '10-12 reps'),
      ex('cable-triceps-pushdown', 'Cable Triceps Pushdown', 'reps_weight', 3, '12-15 reps'),
    ],
    [info('Safety Essentials', ['Use a spotter or safety pins for heavy bench work', 'Warm up shoulders before pressing'])],
    [info('Essential Equipment', ['Barbell', 'Dumbbells', 'Cable machine', 'Adjustable bench'])]
  ),
  browse(
    'pull-day-back-biceps',
    'Pull Day: Back & Biceps',
    'Strength Training',
    45,
    '320-450 Calories',
    true,
    ['build_strength'],
    [
      ex('deadlift-pull-day', 'Conventional Deadlift', 'reps_weight', 3, '5-6 reps'),
      ex('pull-ups-pull-day', 'Pull-Ups', 'reps_weight', 3, '6-10 reps'),
      ex('seated-cable-row', 'Seated Cable Row', 'reps_weight', 3, '10-12 reps'),
      ex('barbell-curl', 'Barbell Curl', 'reps_weight', 3, '10-12 reps'),
    ],
    [info('Form', ['Keep the bar close to your shins on deadlifts', 'Squeeze shoulder blades together on every row'])],
    [info('Essential Equipment', ['Barbell', 'Pull-up bar', 'Cable row machine'])]
  ),
  browse(
    'deadlift-focus-strength',
    'Deadlift Focus Strength',
    'Strength Training',
    40,
    '300-420 Calories',
    true,
    ['build_strength'],
    [
      ex('deadlift-heavy', 'Barbell Deadlift', 'reps_weight', 5, '3-5 reps'),
      ex('romanian-deadlift-accessory', 'Romanian Deadlift', 'reps_weight', 3, '8 reps'),
      ex('back-extension', 'Back Extension', 'reps_weight', 3, '12-15 reps'),
      ex('farmers-carry', "Farmer's Carry", 'duration', 3, '30-40 second walk'),
    ],
    [info('Safety Essentials', ['Brace your core before every pull', 'Reset your setup between reps on heavy sets'])],
    [info('Essential Equipment', ['Barbell and plates', 'Chalk (optional)'])]
  ),
  browse(
    'kettlebell-full-body-strength',
    'Kettlebell Full Body Strength',
    'Strength Training',
    35,
    '280-400 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('kettlebell-swing', 'Kettlebell Swing', 'reps_weight', 4, '15-20 reps'),
      ex('kettlebell-goblet-squat', 'Kettlebell Goblet Squat', 'reps_weight', 3, '10-12 reps'),
      ex('kettlebell-clean-press', 'Kettlebell Clean & Press', 'reps_weight', 3, '6-8 reps each arm'),
      ex('kettlebell-row', 'Single-Arm Kettlebell Row', 'reps_weight', 3, '10-12 reps each arm'),
    ],
    [info('Form', ['Hinge from the hips on swings, not a squat', 'Keep the kettlebell close to your body on cleans'])],
    [info('Essential Equipment', ['One or two kettlebells'])]
  ),
  browse(
    'dumbbell-only-full-body',
    'Dumbbell-Only Full Body',
    'Strength Training',
    40,
    '300-420 Calories',
    true,
    ['build_strength'],
    [
      ex('dumbbell-goblet-squat', 'Dumbbell Goblet Squat', 'reps_weight', 3, '10-12 reps'),
      ex('dumbbell-bench-press', 'Dumbbell Bench Press', 'reps_weight', 3, '8-10 reps'),
      ex('dumbbell-row-fb', 'Bent-Over Dumbbell Row', 'reps_weight', 3, '10-12 reps'),
      ex('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'reps_weight', 3, '10-12 reps'),
      ex('dumbbell-romanian-deadlift', 'Dumbbell Romanian Deadlift', 'reps_weight', 3, '10-12 reps'),
    ],
    [info('Equipment Alternatives', ['Only have one dumbbell? Do single-arm variations and match reps on both sides'])],
    [info('Essential Equipment', ['A pair of adjustable or fixed dumbbells', 'Bench (optional)'])]
  ),
  browse(
    'arm-day-biceps-triceps',
    'Arm Day: Biceps & Triceps',
    'Strength Training',
    40,
    '280-380 Calories',
    true,
    ['build_strength'],
    [
      ex('barbell-curl-arm-day', 'Barbell Curl', 'reps_weight', 4, '10-12 reps'),
      ex('skull-crushers', 'Skull Crushers', 'reps_weight', 4, '10-12 reps'),
      ex('hammer-curl', 'Hammer Curl', 'reps_weight', 3, '10-12 reps'),
      ex('overhead-triceps-extension', 'Overhead Triceps Extension', 'reps_weight', 3, '12-15 reps'),
      ex('cable-curl', 'Cable Curl', 'reps_weight', 3, '12-15 reps'),
    ],
    [info('Rest Times', ['60-90 seconds between sets is plenty for isolation work'])],
    [info('Essential Equipment', ['Barbell', 'Dumbbells', 'Cable machine (optional)'])]
  ),
  browse(
    'full-body-barbell-strength',
    'Full Body Barbell Strength',
    'Strength Training',
    50,
    '350-480 Calories',
    true,
    ['build_strength'],
    [
      ex('barbell-squat-fb', 'Barbell Back Squat', 'reps_weight', 4, '5-6 reps'),
      ex('barbell-bench-fb', 'Barbell Bench Press', 'reps_weight', 4, '5-6 reps'),
      ex('barbell-row-fb', 'Barbell Bent-Over Row', 'reps_weight', 3, '8-10 reps'),
      ex('barbell-overhead-press-fb', 'Barbell Overhead Press', 'reps_weight', 3, '6-8 reps'),
      ex('barbell-deadlift-fb', 'Barbell Deadlift', 'reps_weight', 3, '5 reps'),
    ],
    [info('Format', ['A classic 5x5-style full-body split hitting every major lift', 'Add weight only when all sets and reps are completed with good form'])],
    [info('Essential Equipment', ['Barbell and plates', 'Squat rack', 'Adjustable bench'])]
  ),

  // ------------------------------------------------------------------- HIIT
  browse(
    'tabata-total-body',
    'Tabata Total Body',
    'HIIT',
    20,
    '220-320 Calories',
    false,
    ['lose_weight', 'build_endurance'],
    [
      ex('tabata-squat-jumps', 'Squat Jumps', 'duration', 4, '20 sec work / 10 sec rest'),
      ex('tabata-pushups', 'Push-Ups', 'duration', 4, '20 sec work / 10 sec rest'),
      ex('tabata-mountain-climbers', 'Mountain Climbers', 'duration', 4, '20 sec work / 10 sec rest'),
      ex('tabata-plank-jacks', 'Plank Jacks', 'duration', 4, '20 sec work / 10 sec rest'),
    ],
    [info('Intensity', ['True Tabata is all-out for the full 20 seconds', 'Repeat the 4-exercise circuit twice through'])],
    [info('Essential Equipment', ['None - bodyweight only'])]
  ),
  browse(
    'hiit-sled-sprint',
    'HIIT Sled & Sprint',
    'HIIT',
    30,
    '300-420 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('sled-push', 'Sled Push', 'duration', 6, '20m push, walk back to recover'),
      ex('sprint-hiit', 'Sprint', 'duration', 6, '15 sec sprint / 60 sec walk'),
    ],
    [info('Safety Essentials', ['Keep a flat back on sled pushes, drive through your legs'])],
    [info('Essential Equipment', ['Weighted sled', 'Open turf or track'])]
  ),
  browse(
    'bodyweight-hiit-blast',
    'Bodyweight HIIT Blast',
    'HIIT',
    25,
    '250-360 Calories',
    false,
    ['lose_weight', 'build_endurance'],
    [
      ex('burpees-hiit', 'Burpees', 'duration', 5, '40 sec work / 20 sec rest'),
      ex('jump-lunges', 'Jump Lunges', 'duration', 5, '40 sec work / 20 sec rest'),
      ex('high-knees-hiit', 'High Knees', 'duration', 5, '40 sec work / 20 sec rest'),
    ],
    [info('Intensity', ['Modify burpees to a step-back version if needed', 'Land softly on all jumping movements'])],
    [info('Essential Equipment', ['None - bodyweight only'])]
  ),
  browse(
    'emom-strength-cardio',
    'EMOM Strength & Cardio',
    'HIIT',
    30,
    '280-400 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('emom-dumbbell-thrusters', 'Dumbbell Thrusters', 'reps_weight', 10, '8 reps every minute on the minute'),
      ex('emom-box-step-ups', 'Box Step-Ups', 'reps_weight', 10, '10 reps every minute on the minute'),
    ],
    [info('Pacing', ['Rest with whatever time is left in each minute', 'Reduce reps if you lose good form'])],
    [info('Essential Equipment', ['Dumbbells', 'Sturdy box or bench'])]
  ),
  browse(
    'battle-ropes-hiit',
    'Battle Ropes HIIT',
    'HIIT',
    20,
    '240-340 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('battle-rope-waves', 'Alternating Waves', 'duration', 6, '30 sec work / 30 sec rest'),
      ex('battle-rope-slams', 'Rope Slams', 'duration', 4, '20 sec work / 40 sec rest'),
    ],
    [info('Form', ['Keep knees soft and core braced throughout', 'Drive power from your legs and hips, not just your arms'])],
    [info('Essential Equipment', ['Battle ropes'])]
  ),
  browse(
    'sledgehammer-tire-hiit',
    'Sledgehammer Tire HIIT',
    'HIIT',
    25,
    '280-380 Calories',
    true,
    ['lose_weight', 'build_strength'],
    [
      ex('tire-sledgehammer-slams', 'Tire Sledgehammer Slams', 'duration', 6, '30 sec work / 30 sec rest'),
      ex('tire-flips', 'Tire Flips', 'reps_weight', 4, '8-10 reps', { tracksWeight: false }),
    ],
    [info('Form', ['Hinge at the hips and use your legs to drive the slam, not just your arms', 'Keep a flat back when flipping the tire'])],
    [info('Essential Equipment', ['Sledgehammer', 'Large tire'])]
  ),
  browse(
    'stair-sprint-hiit',
    'Stair Sprint HIIT',
    'HIIT',
    20,
    '240-340 Calories',
    false,
    ['lose_weight', 'build_endurance'],
    [
      ex('stair-sprints', 'Stair Sprints', 'duration', 8, '30 sec sprint up / walk down to recover'),
      ex('stair-lateral-hops', 'Lateral Bound Hops', 'duration', 3, '30 seconds'),
    ],
    [info('Safety Essentials', ['Watch your footing on the way down - walk, never sprint downhill or downstairs'])],
    [info('Essential Equipment', ['A staircase or stadium steps'])]
  ),

  // ------------------------------------------------------------------- Yoga
  browse(
    'morning-sun-salutation-flow',
    'Morning Sun Salutation Flow',
    'Yoga',
    20,
    '90-150 Calories',
    false,
    ['build_endurance'],
    [
      ex('sun-salutation-a', 'Sun Salutation A', 'duration', 5, '1 round through the sequence'),
      ex('standing-forward-fold', 'Standing Forward Fold', 'duration', 1, '1 minute hold'),
      ex('seated-twist', 'Seated Spinal Twist', 'duration', 2, '30 seconds each side'),
    ],
    [info('Breathing', ['Inhale as you reach up, exhale as you fold', 'Keep breath slow and even throughout'])],
    [info('Essential Equipment', ['Yoga mat'])]
  ),
  browse(
    'power-vinyasa-yoga',
    'Power Vinyasa Yoga',
    'Yoga',
    45,
    '200-320 Calories',
    false,
    ['build_strength', 'build_endurance'],
    [
      ex('vinyasa-flow-sequence', 'Vinyasa Flow Sequence', 'duration', 1, '25 minutes continuous flow'),
      ex('warrior-series', 'Warrior I-II-III Series', 'duration', 2, '1 minute each side'),
      ex('crow-pose', 'Crow Pose Practice', 'duration', 3, '15-20 second holds'),
    ],
    [info('Intensity', ['Move with your breath - one movement per inhale or exhale', 'Modify to Warrior II if balance poses feel unstable'])],
    [info('Essential Equipment', ['Yoga mat', 'Blocks (optional)'])]
  ),
  browse(
    'restorative-yoga-breathwork',
    'Restorative Yoga & Breathwork',
    'Yoga',
    30,
    '80-140 Calories',
    false,
    [],
    [
      ex('supported-child-pose', 'Supported Child’s Pose', 'duration', 1, '3 minute hold'),
      ex('legs-up-wall', 'Legs Up the Wall', 'duration', 1, '5 minute hold'),
      ex('box-breathing', 'Box Breathing', 'duration', 1, '5 minutes (4-4-4-4 count)'),
    ],
    [info('Purpose', ['This session is about recovery, not intensity', 'Use blankets or bolsters for support wherever needed'])],
    [info('Essential Equipment', ['Yoga mat', 'Bolster or pillow (optional)', 'Blanket (optional)'])]
  ),
  browse(
    'yin-yoga-flexibility',
    'Yin Yoga for Flexibility',
    'Yoga',
    40,
    '90-160 Calories',
    false,
    [],
    [
      ex('butterfly-pose', 'Butterfly Pose', 'duration', 1, '3 minute hold'),
      ex('dragon-pose', 'Dragon Pose', 'duration', 2, '2 minutes each side'),
      ex('sleeping-swan', 'Sleeping Swan', 'duration', 2, '2 minutes each side'),
    ],
    [info('Approach', ['Hold each pose passively, letting gravity deepen the stretch', 'Mild discomfort is normal - sharp pain is not, back off if you feel it'])],
    [info('Essential Equipment', ['Yoga mat', 'Blocks or cushions (optional)'])]
  ),
  browse(
    'yoga-for-runners',
    'Yoga for Runners',
    'Yoga',
    25,
    '100-170 Calories',
    false,
    ['build_endurance'],
    [
      ex('low-lunge-runners', 'Low Lunge with Quad Stretch', 'duration', 2, '45 seconds each side'),
      ex('pigeon-pose', 'Pigeon Pose', 'duration', 2, '1 minute each side'),
      ex('downward-dog-runners', 'Downward-Facing Dog', 'duration', 3, '30 second holds'),
    ],
    [info('Purpose', ['Targets hips, hamstrings and calves that tighten from running', 'Great as a cool-down after a run'])],
    [info('Essential Equipment', ['Yoga mat'])]
  ),
  browse(
    'hatha-yoga-basics',
    'Hatha Yoga Basics',
    'Yoga',
    30,
    '100-180 Calories',
    false,
    [],
    [
      ex('mountain-pose-hatha', 'Mountain Pose', 'duration', 1, '1 minute'),
      ex('tree-pose-hatha', 'Tree Pose', 'duration', 2, '30 seconds each side'),
      ex('triangle-pose-hatha', 'Triangle Pose', 'duration', 2, '30 seconds each side'),
      ex('seated-forward-bend-hatha', 'Seated Forward Bend', 'duration', 1, '1 minute'),
    ],
    [info('Pacing', ['Hatha moves slower than Vinyasa - hold each pose several breaths', 'Great starting point if you are new to yoga'])],
    [info('Essential Equipment', ['Yoga mat'])]
  ),
  browse(
    'hot-yoga-flow',
    'Hot Yoga Flow',
    'Yoga',
    50,
    '280-420 Calories',
    false,
    ['lose_weight', 'build_endurance'],
    [
      ex('hot-yoga-sun-salutations', 'Sun Salutation Flow', 'duration', 8, '1 round through the sequence'),
      ex('hot-yoga-standing-series', 'Standing Balance Series', 'duration', 4, '1 minute each side'),
      ex('hot-yoga-floor-series', 'Floor & Seated Series', 'duration', 1, '10 minutes'),
    ],
    [info('Safety Essentials', ['Hydrate well before and during class', 'Take a seated rest anytime you feel lightheaded'])],
    [info('Essential Equipment', ['Yoga mat', 'Towel', 'Water bottle'])]
  ),

  // ------------------------------------------------------------ Pilates & Core
  browse(
    'pilates-mat-fundamentals',
    'Pilates Mat Fundamentals',
    'Pilates & Core',
    30,
    '150-230 Calories',
    false,
    ['build_strength'],
    [
      ex('the-hundred', 'The Hundred', 'duration', 1, '100 pumps (about 1 minute)'),
      ex('roll-up', 'Roll-Up', 'reps_weight', 3, '8-10 reps', { tracksWeight: false }),
      ex('single-leg-stretch', 'Single-Leg Stretch', 'reps_weight', 3, '10 reps each leg', { tracksWeight: false }),
      ex('swimming-pilates', 'Swimming', 'duration', 2, '30 second holds'),
    ],
    [info('Form', ['Keep your navel drawn in toward your spine throughout', 'Move with control - no momentum'])],
    [info('Essential Equipment', ['Mat'])]
  ),
  browse(
    'core-stability-circuit',
    'Core Stability Circuit',
    'Pilates & Core',
    20,
    '150-230 Calories',
    false,
    ['build_strength'],
    [
      ex('plank-core', 'Front Plank', 'duration', 3, '30-45 second hold'),
      ex('side-plank-core', 'Side Plank', 'duration', 2, '30 second hold each side'),
      ex('bird-dog', 'Bird Dog', 'reps_weight', 3, '10 reps each side', { tracksWeight: false }),
      ex('dead-bug', 'Dead Bug', 'reps_weight', 3, '12 reps each side', { tracksWeight: false }),
    ],
    [info('Form', ['Keep your lower back flat against the floor on dead bugs', "Don't let your hips sag on planks"])],
    [info('Essential Equipment', ['Mat'])]
  ),
  browse(
    'ab-shred',
    'Ab Shred',
    'Pilates & Core',
    15,
    '100-180 Calories',
    false,
    ['lose_weight', 'build_strength'],
    [
      ex('crunches-shred', 'Crunches', 'reps_weight', 3, '20 reps', { tracksWeight: false }),
      ex('v-ups', 'V-Ups', 'reps_weight', 3, '12-15 reps', { tracksWeight: false }),
      ex('flutter-kicks', 'Flutter Kicks', 'duration', 3, '30 second sets'),
      ex('plank-shred', 'Plank', 'duration', 3, '45 second hold'),
    ],
    [info('Quick Troubleshooting', ["Feeling it in your neck instead of abs? Keep your chin tucked, don't pull on your neck"])],
    [info('Essential Equipment', ['None - bodyweight only', 'Optional: mat for comfort'])]
  ),
  browse(
    'pilates-reformer-style-bodyweight',
    'Pilates Reformer-Style (Bodyweight)',
    'Pilates & Core',
    35,
    '180-260 Calories',
    false,
    ['build_strength'],
    [
      ex('leg-circles', 'Leg Circles', 'reps_weight', 2, '8 circles each direction, each leg', { tracksWeight: false }),
      ex('teaser', 'Teaser', 'reps_weight', 3, '6-8 reps', { tracksWeight: false }),
      ex('scissor-kicks', 'Scissor Kicks', 'duration', 3, '30 second sets'),
      ex('side-kick-series', 'Side Kick Series', 'reps_weight', 2, '10 reps each leg', { tracksWeight: false }),
    ],
    [info('Approach', ['A reformer-inspired flow you can do anywhere with just a mat', 'Focus on slow, controlled leg movement from the core'])],
    [info('Essential Equipment', ['Mat'])]
  ),
  browse(
    'pilates-standing-series',
    'Pilates Standing Series',
    'Pilates & Core',
    25,
    '140-220 Calories',
    false,
    ['build_strength'],
    [
      ex('standing-leg-lifts-pilates', 'Standing Leg Lifts', 'reps_weight', 3, '12 reps each leg', { tracksWeight: false }),
      ex('standing-plie-pilates', 'Standing Plie with Arm Reach', 'reps_weight', 3, '12 reps', { tracksWeight: false }),
      ex('standing-side-bend-pilates', 'Standing Side Bend', 'reps_weight', 3, '10 reps each side', { tracksWeight: false }),
    ],
    [info('Why It Works', ['Great low-impact option if getting up and down off a mat is uncomfortable', 'Focus on balance and core engagement throughout'])],
    [info('Essential Equipment', ['None', 'Chair for balance support (optional)'])]
  ),
  browse(
    'weighted-core-circuit',
    'Weighted Core Circuit',
    'Pilates & Core',
    25,
    '180-260 Calories',
    true,
    ['build_strength'],
    [
      ex('weighted-russian-twist', 'Weighted Russian Twist', 'reps_weight', 3, '16 reps'),
      ex('medicine-ball-slam', 'Medicine Ball Slam', 'reps_weight', 3, '12 reps'),
      ex('weighted-sit-up', 'Weighted Sit-Up', 'reps_weight', 3, '12-15 reps'),
      ex('plank-with-dumbbell-drag', 'Plank Dumbbell Drag', 'reps_weight', 3, '10 reps each side'),
    ],
    [info('Form', ['Move with control - this is not about speed', 'Keep your lower back neutral on weighted sit-ups'])],
    [info('Essential Equipment', ['Medicine ball', 'Dumbbell'])]
  ),
  browse(
    'obliques-rotational-core',
    'Obliques & Rotational Core',
    'Pilates & Core',
    15,
    '100-170 Calories',
    false,
    ['build_strength'],
    [
      ex('side-plank-rotation', 'Side Plank with Rotation', 'reps_weight', 3, '10 reps each side', { tracksWeight: false }),
      ex('bicycle-crunches-oblique', 'Bicycle Crunches', 'reps_weight', 3, '20 reps each side', { tracksWeight: false }),
      ex('windshield-wipers', 'Windshield Wipers', 'reps_weight', 3, '10 reps each side', { tracksWeight: false }),
    ],
    [info('Form', ['Rotate from your ribcage, not just your arms', 'Keep movements slow and controlled to protect your lower back'])],
    [info('Essential Equipment', ['Mat'])]
  ),

  // --------------------------------------------------- Group Fitness Classes
  browse(
    'spin-class-sprint-climb',
    'Spin Class: Sprint & Climb',
    'Group Fitness Classes',
    45,
    '400-550 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('spin-warmup', 'Easy Spin Warm-Up', 'duration', 1, '5 minutes'),
      ex('spin-climbs', 'Seated Climbs', 'duration', 4, '3 minutes high resistance'),
      ex('spin-sprints', 'Standing Sprints', 'duration', 6, '30 seconds all-out'),
      ex('spin-cooldown', 'Cool-Down Spin', 'duration', 1, '5 minutes easy'),
    ],
    [info('Pacing', ['Adjust resistance to keep cadence around 60-80rpm on climbs', 'Sprints should feel maximal for the full 30 seconds'])],
    [info('Essential Equipment', ['Stationary/spin bike', 'Cycling shoes (optional)'])]
  ),
  browse(
    'zumba-dance-cardio-party',
    'Zumba Dance Cardio Party',
    'Group Fitness Classes',
    45,
    '350-500 Calories',
    false,
    ['lose_weight', 'build_endurance'],
    [
      ex('zumba-warmup', 'Warm-Up Dance Set', 'duration', 1, '5 minutes'),
      ex('zumba-latin-cardio', 'Latin Cardio Combos', 'duration', 6, '4 minute songs'),
      ex('zumba-cooldown', 'Cool-Down Stretch Song', 'duration', 1, '4 minutes'),
    ],
    [info('Vibe', ['Follow the choreography as best you can - full effort matters more than perfect steps', 'Stay light on your feet and let your hips lead'])],
    [info('Essential Equipment', ['Supportive sneakers'])]
  ),
  browse(
    'bootcamp-circuit-class',
    'Bootcamp Circuit Class',
    'Group Fitness Classes',
    40,
    '350-480 Calories',
    true,
    ['lose_weight', 'build_strength', 'build_endurance'],
    [
      ex('bootcamp-station-1', 'Station 1: Dumbbell Squat to Press', 'reps_weight', 3, '12 reps'),
      ex('bootcamp-station-2', 'Station 2: Battle Rope Slams', 'duration', 3, '30 seconds'),
      ex('bootcamp-station-3', 'Station 3: Box Jumps', 'reps_weight', 3, '10 reps', { tracksWeight: false }),
      ex('bootcamp-station-4', 'Station 4: Kettlebell Swings', 'reps_weight', 3, '15 reps'),
    ],
    [info('Format', ['Rotate through all 4 stations, resting 1 minute between rounds', 'Complete 3 full rounds'])],
    [info('Essential Equipment', ['Dumbbells', 'Kettlebell', 'Battle ropes', 'Plyo box'])]
  ),
  browse(
    'barre-sculpt-class',
    'Barre Sculpt Class',
    'Group Fitness Classes',
    45,
    '200-320 Calories',
    false,
    ['build_strength'],
    [
      ex('barre-plie-pulses', 'Plie Pulses', 'duration', 3, '1 minute each'),
      ex('barre-leg-lifts', 'Standing Leg Lifts', 'reps_weight', 3, '15 reps each leg', { tracksWeight: false }),
      ex('barre-seat-work', 'Seat Work (Donkey Kicks)', 'reps_weight', 3, '15 reps each side', { tracksWeight: false }),
      ex('barre-arm-series', 'Light Weight Arm Series', 'reps_weight', 3, '15-20 reps'),
    ],
    [info('Form', ['Small, controlled pulses - resist the urge to swing', 'Keep your core engaged the entire class'])],
    [info('Essential Equipment', ['Chair or countertop as a barre', 'Light hand weights (1-3 lbs)'])]
  ),
  browse(
    'kickboxing-cardio-class',
    'Kickboxing Cardio Class',
    'Group Fitness Classes',
    45,
    '400-550 Calories',
    false,
    ['lose_weight', 'build_endurance'],
    [
      ex('kickbox-jab-cross', 'Jab-Cross Combos', 'duration', 4, '2 minute rounds'),
      ex('kickbox-knee-strikes', 'Knee Strikes', 'duration', 3, '1 minute each side'),
      ex('kickbox-roundhouse', 'Roundhouse Kicks', 'duration', 3, '1 minute each side'),
      ex('kickbox-shadowbox', 'Freestyle Shadowboxing', 'duration', 2, '2 minute rounds'),
    ],
    [info('Safety Essentials', ['Keep knees soft when kicking to protect your joints', 'Wrap hands if using a heavy bag'])],
    [info('Essential Equipment', ['None required', 'Optional: heavy bag and gloves'])]
  ),
  browse(
    'step-aerobics-class',
    'Step Aerobics Class',
    'Group Fitness Classes',
    40,
    '300-420 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('step-basic-combos', 'Basic Step Combos', 'duration', 1, '15 minutes'),
      ex('step-power-moves', 'Power Step Moves (Knee Ups & Kicks)', 'duration', 4, '3 minute blocks'),
      ex('step-cooldown', 'Cool-Down & Stretch', 'duration', 1, '5 minutes'),
    ],
    [info('Form', ['Step fully onto the platform - never just tap the edge', 'Keep your core engaged for balance on power moves'])],
    [info('Essential Equipment', ['Step platform'])]
  ),
  browse(
    'row-sculpt-class',
    'Row Sculpt Class',
    'Group Fitness Classes',
    45,
    '380-500 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('row-sculpt-erg-intervals', 'Rowing Machine Intervals', 'duration', 5, '3 minutes hard / 1 minute easy'),
      ex('row-sculpt-dumbbell-strength', 'Dumbbell Strength Block', 'reps_weight', 3, '12 reps'),
    ],
    [info('Format', ['Alternates rowing intervals with strength blocks on the floor', 'Adjust rowing resistance so 3-minute intervals feel like an 8/10 effort'])],
    [info('Essential Equipment', ['Rowing machine', 'Dumbbells'])]
  ),

  // -------------------------------------------------------------- Swimming
  browse(
    'freestyle-endurance-swim',
    'Freestyle Endurance Swim',
    'Swimming',
    40,
    '400-550 Calories',
    true,
    ['build_endurance'],
    [
      ex('swim-warmup', 'Warm-Up Swim', 'duration', 1, '200m easy freestyle'),
      ex('freestyle-main-set', 'Freestyle Endurance Set', 'duration', 1, '1200m continuous'),
      ex('swim-cooldown', 'Cool-Down Swim', 'duration', 1, '100m easy'),
    ],
    [info('Pacing', ['Aim for a steady, sustainable pace you can hold the whole set', 'Focus on a long, smooth stroke rather than speed'])],
    [info('Essential Equipment', ['Pool access', 'Swim goggles', 'Swim cap (optional)'])]
  ),
  browse(
    'swim-sprint-intervals',
    'Swim Sprint Intervals',
    'Swimming',
    30,
    '300-420 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('swim-warmup-sprint', 'Warm-Up Swim', 'duration', 1, '200m easy'),
      ex('swim-50m-sprints', '50m Sprint Intervals', 'duration', 8, '50m fast, rest 30 sec'),
    ],
    [info('Pacing', ['Push close to max effort on each sprint', 'Use the rest interval to fully catch your breath'])],
    [info('Essential Equipment', ['Pool access', 'Swim goggles'])]
  ),
  browse(
    'beginner-pool-workout',
    'Beginner Pool Workout',
    'Swimming',
    25,
    '200-300 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('beginner-kickboard', 'Kickboard Laps', 'duration', 1, '200m'),
      ex('beginner-freestyle', 'Freestyle Practice', 'duration', 1, '150m with rest as needed'),
      ex('beginner-backstroke', 'Backstroke Practice', 'duration', 1, '100m'),
    ],
    [info('Getting Started', ['Rest at the wall whenever you need to - consistency matters more than distance', "Use a kickboard to isolate leg drive if you're new to swimming"])],
    [info('Essential Equipment', ['Pool access', 'Swim goggles', 'Kickboard'])]
  ),
  browse(
    'water-aerobics',
    'Water Aerobics',
    'Swimming',
    35,
    '200-320 Calories',
    true,
    ['lose_weight', 'build_endurance'],
    [
      ex('water-jumping-jacks', 'Water Jumping Jacks', 'duration', 3, '1 minute'),
      ex('water-high-knees', 'Water High Knees', 'duration', 3, '1 minute'),
      ex('water-noodle-crunches', 'Pool Noodle Crunches', 'reps_weight', 3, '15 reps', { tracksWeight: false }),
    ],
    [info('Why It Works', ['Water resistance provides low-impact strength work on joints', 'Great option for recovery days or joint-sensitive training'])],
    [info('Essential Equipment', ['Pool access', 'Pool noodle (optional)'])]
  ),
  browse(
    'swim-technique-drill-session',
    'Swim Technique Drill Session',
    'Swimming',
    30,
    '220-330 Calories',
    true,
    ['build_endurance'],
    [
      ex('catch-up-drill', 'Catch-Up Drill', 'duration', 1, '200m'),
      ex('fingertip-drag-drill', 'Fingertip Drag Drill', 'duration', 1, '150m'),
      ex('bilateral-breathing-drill', 'Bilateral Breathing Practice', 'duration', 1, '200m'),
    ],
    [info('Purpose', ['Focus on form over speed for every drill', 'Bilateral breathing helps balance your stroke on both sides'])],
    [info('Essential Equipment', ['Pool access', 'Swim goggles'])]
  ),
  browse(
    'butterfly-im-practice',
    'Butterfly & IM Practice',
    'Swimming',
    35,
    '350-480 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('butterfly-drill-swim', 'Butterfly Drill Set', 'duration', 1, '200m broken into 25m reps'),
      ex('im-order-practice', 'Individual Medley Practice', 'duration', 1, '4 x 100m IM order'),
    ],
    [info('Form', ['Undulate from your core on butterfly, not just your arms', 'Practice smooth transitions between strokes on IM reps'])],
    [info('Essential Equipment', ['Pool access', 'Swim goggles'])]
  ),
  browse(
    'open-water-swim',
    'Open Water Swim',
    'Swimming',
    45,
    '420-580 Calories',
    true,
    ['build_endurance'],
    [ex('open-water-swim-main', 'Open Water Swim', 'duration', 1, '45 minutes continuous sighting every 6-8 strokes')],
    [info('Safety Essentials', ['Never swim open water alone - use a buddy or a safety buoy', 'Sight landmarks regularly to stay on course'])],
    [info('Essential Equipment', ['Wetsuit (optional)', 'Swim goggles', 'Safety buoy'])]
  ),

  // --------------------------------------------------------------- Cycling
  browse(
    'road-cycling-endurance-ride',
    'Road Cycling Endurance Ride',
    'Cycling',
    60,
    '450-650 Calories',
    true,
    ['build_endurance'],
    [ex('road-ride-endurance', 'Endurance Ride', 'duration', 1, '60 minutes steady effort')],
    [info('Pacing', ['Keep a conversational effort for the full ride', 'Stay hydrated and fuel every 45-60 minutes on longer rides'])],
    [info('Essential Equipment', ['Road bike', 'Helmet', 'Water bottle'])]
  ),
  browse(
    'indoor-cycling-hill-climb',
    'Indoor Cycling Hill Climb',
    'Cycling',
    40,
    '350-500 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('indoor-cycle-warmup', 'Warm-Up Spin', 'duration', 1, '5 minutes'),
      ex('indoor-cycle-climbs', 'Seated & Standing Climbs', 'duration', 5, '4 minutes high resistance'),
    ],
    [info('Form', ['Keep your upper body relaxed while standing to climb', 'Shift up in resistance, not cadence, to simulate hills'])],
    [info('Essential Equipment', ['Stationary bike'])]
  ),
  browse(
    'mountain-biking-trail-ride',
    'Mountain Biking Trail Ride',
    'Cycling',
    50,
    '400-600 Calories',
    true,
    ['build_endurance', 'build_strength'],
    [ex('mtb-trail-ride', 'Trail Ride', 'duration', 1, '50 minutes varied terrain')],
    [info('Safety Essentials', ['Wear a helmet and check brakes before riding', 'Scout unfamiliar trails at a conservative pace first'])],
    [info('Essential Equipment', ['Mountain bike', 'Helmet', 'Gloves (optional)'])]
  ),
  browse(
    'gravel-cycling-adventure',
    'Gravel Cycling Adventure',
    'Cycling',
    70,
    '500-700 Calories',
    true,
    ['build_endurance'],
    [ex('gravel-ride-main', 'Gravel Ride', 'duration', 1, '70 minutes mixed terrain')],
    [info('Preparation', ['Check tire pressure - lower psi helps on loose gravel', 'Carry a spare tube and multitool for remote routes'])],
    [info('Essential Equipment', ['Gravel bike', 'Helmet', 'Repair kit'])]
  ),
  browse(
    'cycling-hill-repeats-outdoor',
    'Cycling Hill Repeats (Outdoor)',
    'Cycling',
    50,
    '420-580 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('hill-repeats-warmup', 'Easy Warm-Up Ride', 'duration', 1, '10 minutes'),
      ex('hill-repeats-climbs', 'Hill Climb Repeats', 'duration', 6, '2 minutes hard climb, descend to recover'),
    ],
    [info('Pacing', ['Stay seated on the first half of each climb, stand for the final push', 'Recover fully on the descent before starting the next repeat'])],
    [info('Essential Equipment', ['Road or gravel bike', 'Helmet', 'A hill or overpass'])]
  ),
  browse(
    'recovery-spin-ride',
    'Recovery Spin Ride',
    'Cycling',
    30,
    '180-260 Calories',
    true,
    ['build_endurance'],
    [ex('recovery-spin-main', 'Easy Recovery Spin', 'duration', 1, '30 minutes very light effort')],
    [info('Purpose', ['Keep effort easy enough that you could hold a full conversation', 'Great the day after a hard leg day or long ride'])],
    [info('Essential Equipment', ['Stationary or road bike'])]
  ),
  browse(
    'cyclocross-interval-training',
    'Cyclocross Interval Training',
    'Cycling',
    45,
    '400-550 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('cx-warmup', 'Warm-Up Spin', 'duration', 1, '10 minutes'),
      ex('cx-power-intervals', 'Power Intervals with Mock Barriers', 'duration', 8, '1 minute hard / 1 minute easy'),
    ],
    [info('Skills', ['Practice quick dismounts and remounts during easy intervals if training for racing'])],
    [info('Essential Equipment', ['Cyclocross or gravel bike', 'Helmet'])]
  ),

  // --------------------------------------------------------- Sports & Outdoor
  browse(
    'basketball-skills-conditioning',
    'Basketball Skills & Conditioning',
    'Sports & Outdoor',
    45,
    '350-500 Calories',
    true,
    ['build_endurance', 'lose_weight'],
    [
      ex('basketball-dribbling-drills', 'Ball-Handling Drills', 'duration', 1, '10 minutes'),
      ex('basketball-shooting-drills', 'Shooting Drills', 'reps_weight', 5, '10 makes from 5 spots', { tracksWeight: false }),
      ex('basketball-suicides', 'Suicide Sprints', 'duration', 6, '1 sprint / 30 sec rest'),
      ex('basketball-scrimmage', 'Pickup Scrimmage', 'duration', 1, '15 minutes'),
    ],
    [info('Conditioning', ['Suicides build the same stop-start endurance the game demands', 'Stay low and quick on defensive slides'])],
    [info('Essential Equipment', ['Basketball', 'Hoop/court access'])]
  ),
  browse(
    'trail-running-adventure',
    'Trail Running Adventure',
    'Sports & Outdoor',
    45,
    '380-520 Calories',
    false,
    ['build_endurance'],
    [ex('trail-run', 'Trail Run', 'duration', 1, '45 minutes varied terrain')],
    [info('Safety Essentials', ['Watch your footing on roots and rocks, especially downhill', 'Tell someone your route if running remote trails'])],
    [info('Essential Equipment', ['Trail running shoes'])]
  ),
  browse(
    'hiking-trek',
    'Hiking Trek',
    'Sports & Outdoor',
    60,
    '350-500 Calories',
    false,
    ['build_endurance'],
    [ex('hiking-trek-main', 'Trail Hike', 'duration', 1, '60 minutes moderate terrain')],
    [info('Preparation', ['Bring more water than you think you need', 'Check trail conditions and weather before heading out'])],
    [info('Essential Equipment', ['Hiking shoes/boots', 'Water', 'Trekking poles (optional)'])]
  ),
  browse(
    'tennis-cardio-drills',
    'Tennis Cardio Drills',
    'Sports & Outdoor',
    45,
    '350-480 Calories',
    true,
    ['build_endurance', 'lose_weight'],
    [
      ex('tennis-footwork-ladder', 'Footwork Ladder Drills', 'duration', 1, '10 minutes'),
      ex('tennis-groundstroke-rally', 'Groundstroke Rally Practice', 'duration', 1, '15 minutes'),
      ex('tennis-serve-practice', 'Serve Practice', 'reps_weight', 3, '10 serves', { tracksWeight: false }),
      ex('tennis-match-play', 'Match Play', 'duration', 1, '15 minutes'),
    ],
    [info('Form', ['Split-step just before your opponent contacts the ball', 'Rotate your hips and shoulders into every groundstroke'])],
    [info('Essential Equipment', ['Tennis racket', 'Tennis balls', 'Court access'])]
  ),
  browse(
    'soccer-skills-conditioning',
    'Soccer Skills & Conditioning',
    'Sports & Outdoor',
    45,
    '380-520 Calories',
    true,
    ['build_endurance', 'lose_weight'],
    [
      ex('soccer-dribbling-drills', 'Dribbling Cone Drills', 'duration', 1, '10 minutes'),
      ex('soccer-passing-drills', 'Passing Drills', 'duration', 1, '10 minutes'),
      ex('soccer-shuttle-runs', 'Shuttle Runs', 'duration', 6, '30 sec sprint / 30 sec rest'),
      ex('soccer-scrimmage', 'Small-Sided Scrimmage', 'duration', 1, '15 minutes'),
    ],
    [info('Conditioning', ['Shuttle runs mimic the repeated sprinting demands of a match', 'Keep your first touch tight under pressure'])],
    [info('Essential Equipment', ['Soccer ball', 'Cones (optional)', 'Open field'])]
  ),
  browse(
    'golf-fitness-mobility',
    'Golf Fitness & Mobility',
    'Sports & Outdoor',
    40,
    '200-320 Calories',
    true,
    ['build_strength'],
    [
      ex('golf-torso-rotation', 'Torso Rotation Stretch', 'duration', 2, '30 seconds each side'),
      ex('golf-swing-practice', 'Swing Practice Reps', 'reps_weight', 3, '15 reps', { tracksWeight: false }),
      ex('golf-walk-course', 'Walking the Course', 'duration', 1, '25 minutes'),
    ],
    [info('Purpose', ['Rotational mobility work reduces strain and improves swing power', 'Walking (vs a cart) adds real cardio benefit to a round'])],
    [info('Essential Equipment', ['Golf clubs', 'Course or driving range access'])]
  ),
  browse(
    'rock-climbing-session',
    'Rock Climbing Session',
    'Sports & Outdoor',
    50,
    '400-550 Calories',
    true,
    ['build_strength', 'build_endurance'],
    [
      ex('climbing-warmup-traverse', 'Warm-Up Traverse', 'duration', 1, '10 minutes easy routes'),
      ex('climbing-route-work', 'Route/Problem Work', 'duration', 1, '30 minutes progressively harder'),
      ex('climbing-forearm-stretch', 'Forearm & Grip Stretch', 'duration', 2, '30 seconds each side'),
    ],
    [info('Safety Essentials', ['Always climb with a partner or certified auto-belay', 'Warm up your fingers and shoulders before pushing grade'])],
    [info('Essential Equipment', ['Climbing shoes', 'Chalk', 'Harness (for roped climbing)'])]
  ),

  // ------------------------------------------------------ Stretching & Recovery
  browse(
    'full-body-stretch-routine',
    'Full-Body Stretch Routine',
    'Stretching & Recovery',
    15,
    '40-80 Calories',
    false,
    [],
    [
      ex('hamstring-stretch', 'Standing Hamstring Stretch', 'duration', 2, '30 seconds each leg'),
      ex('quad-stretch', 'Standing Quad Stretch', 'duration', 2, '30 seconds each leg'),
      ex('shoulder-cross-stretch', 'Cross-Body Shoulder Stretch', 'duration', 2, '20 seconds each arm'),
      ex('cat-cow-stretch', 'Cat-Cow', 'duration', 1, '1 minute'),
    ],
    [info('When to Use', ['Great any time - as a warm-up primer, cool-down, or standalone recovery session'])],
    [info('Essential Equipment', ['None', 'Mat (optional)'])]
  ),
  browse(
    'hip-mobility-flow',
    'Hip Mobility Flow',
    'Stretching & Recovery',
    15,
    '40-80 Calories',
    false,
    [],
    [
      ex('90-90-hip-stretch', '90/90 Hip Stretch', 'duration', 2, '45 seconds each side'),
      ex('world-greatest-stretch', "World's Greatest Stretch", 'duration', 2, '5 reps each side'),
      ex('hip-flexor-lunge-stretch', 'Kneeling Hip Flexor Stretch', 'duration', 2, '30 seconds each side'),
    ],
    [info('Why It Works', ['Tight hips are a common cause of low-back discomfort', 'Do this before lower-body strength days or long sits'])],
    [info('Essential Equipment', ['Mat'])]
  ),
  browse(
    'post-workout-cooldown-stretch',
    'Post-Workout Cooldown Stretch',
    'Stretching & Recovery',
    10,
    '30-60 Calories',
    false,
    [],
    [
      ex('standing-forward-fold-cooldown', 'Standing Forward Fold', 'duration', 1, '1 minute'),
      ex('seated-figure-four', 'Seated Figure-Four Stretch', 'duration', 2, '30 seconds each side'),
      ex('deep-breathing-cooldown', 'Deep Breathing', 'duration', 1, '2 minutes'),
    ],
    [info('When to Use', ['Tack this onto the end of any workout to lower your heart rate gradually'])],
    [info('Essential Equipment', ['None'])]
  ),
  browse(
    'foam-rolling-recovery',
    'Foam Rolling Recovery',
    'Stretching & Recovery',
    15,
    '40-70 Calories',
    true,
    [],
    [
      ex('foam-roll-quads', 'Foam Roll Quads', 'duration', 1, '1 minute each leg'),
      ex('foam-roll-back', 'Foam Roll Upper Back', 'duration', 1, '1 minute'),
      ex('foam-roll-calves', 'Foam Roll Calves', 'duration', 1, '1 minute each leg'),
      ex('foam-roll-glutes', 'Foam Roll Glutes', 'duration', 1, '1 minute each side'),
    ],
    [info('Form', ['Roll slowly and pause on tender spots for 20-30 seconds', 'Avoid rolling directly over joints or your lower back'])],
    [info('Essential Equipment', ['Foam roller'])]
  ),
  browse(
    'deep-stretch-flexibility',
    'Deep Stretch for Flexibility',
    'Stretching & Recovery',
    20,
    '50-90 Calories',
    false,
    [],
    [
      ex('deep-hamstring-stretch', 'Deep Hamstring Stretch', 'duration', 2, '45 seconds each leg'),
      ex('deep-hip-flexor-stretch', 'Deep Hip Flexor Stretch', 'duration', 2, '45 seconds each side'),
      ex('deep-shoulder-stretch', 'Deep Shoulder & Chest Stretch', 'duration', 2, '30 seconds each side'),
      ex('deep-spinal-twist', 'Deep Seated Spinal Twist', 'duration', 2, '30 seconds each side'),
    ],
    [info('Approach', ['Hold each stretch long enough for your muscles to actually relax - 30-45 seconds minimum', 'Never bounce - ease into a stretch and hold still'])],
    [info('Essential Equipment', ['Mat'])]
  ),
  browse(
    'active-recovery-walk-stretch',
    'Active Recovery Walk & Stretch',
    'Stretching & Recovery',
    25,
    '90-150 Calories',
    false,
    ['build_endurance'],
    [
      ex('active-recovery-walk', 'Easy Walk', 'duration', 1, '15 minutes relaxed pace'),
      ex('active-recovery-stretch', 'Full-Body Stretch', 'duration', 1, '10 minutes'),
    ],
    [info('Purpose', ['Light movement promotes blood flow and recovery better than total rest', 'Great to schedule the day after an intense workout'])],
    [info('Essential Equipment', ['Comfortable shoes'])]
  ),
  browse(
    'mobility-flow-desk-workers',
    'Mobility Flow for Desk Workers',
    'Stretching & Recovery',
    15,
    '40-80 Calories',
    false,
    [],
    [
      ex('desk-neck-stretch', 'Neck Side Stretch', 'duration', 2, '20 seconds each side'),
      ex('desk-chest-opener', 'Doorway Chest Opener', 'duration', 2, '30 seconds'),
      ex('desk-hip-flexor-release', 'Kneeling Hip Flexor Release', 'duration', 2, '30 seconds each side'),
      ex('desk-thoracic-rotation', 'Seated Thoracic Rotation', 'duration', 2, '10 reps each side'),
    ],
    [info('When to Use', ['Ideal as a midday break to undo hours of sitting', 'Do it daily for the best relief from desk-related tightness'])],
    [info('Essential Equipment', ['None'])]
  ),
];
