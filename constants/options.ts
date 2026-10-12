import type { Barrier, ExperienceLevel, FitnessGoal, Sex } from '../types/models';

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export const EXPERIENCE_OPTIONS: { value: ExperienceLevel; label: string }[] = [
  { value: 'new', label: "I'm New to This" },
  { value: 'some', label: 'I Know a Little' },
  { value: 'experienced', label: "I'm Experienced" },
];

export const BARRIER_OPTIONS: { value: Barrier; label: string }[] = [
  { value: 'time', label: 'Not enough time' },
  { value: 'motivation', label: 'Staying motivated' },
  { value: 'consistency', label: 'Sticking with a routine' },
  { value: 'knowledge', label: 'Not sure what to do' },
  { value: 'confidence', label: 'Feeling out of place at the gym' },
  { value: 'injury', label: 'An injury or pain' },
  { value: 'other', label: 'Something else' },
];

// Tappable starters for the open-ended goal question.
export const GOAL_EXAMPLES = [
  'Lose 20 lb before summer',
  'Get stronger and build muscle',
  'Run a 5K without stopping',
  'Have more energy for my kids',
];

export const GOAL_TEXT_MAX = 200;

const GOAL_KEYWORDS: Record<FitnessGoal, RegExp> = {
  lose_weight: /\b(lose|losing|weight|fat|lean|slim|tone|toned|cut|cutting|lb|lbs|kg|pounds|belly|waist)\b/i,
  build_strength: /\b(strong|stronger|strength|muscle|muscles|build|bulk|lift|lifting|bench|squat|deadlift|gains|bigger|power)\b/i,
  build_endurance: /\b(run|running|5k|10k|marathon|half|cardio|stamina|endurance|energy|hike|hiking|bike|cycling|swim|breath|breathe|conditioning|sport|sports)\b/i,
};

// The goal tags workouts are matched on, read from the user's own words. A
// goal that mentions none of them gets all three, so nothing is filtered out.
export function goalsFromText(text: string): FitnessGoal[] {
  const matched = (Object.keys(GOAL_KEYWORDS) as FitnessGoal[]).filter((goal) =>
    GOAL_KEYWORDS[goal].test(text)
  );
  return matched.length > 0 ? matched : ['lose_weight', 'build_strength', 'build_endurance'];
}
