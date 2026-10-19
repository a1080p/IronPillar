export const motivationalMessages = [
  "You're on a Roll!",
  'You Got This!',
  'Do You Feel the Burn?',
  'Great Job!',
  "You're Almost Done! Keep Pushing!",
];

// Headline + follow-up for the workout summary. One is picked per workout.
export const completionMessages = [
  { heading: 'Workout Complete', sub: 'You showed up and did the work' },
  { heading: 'That One Counts', sub: 'Stronger than when you walked in' },
  { heading: 'Done and Dusted', sub: 'Another brick in the pillar' },
  { heading: 'Work Put In', sub: 'This is how progress is built' },
  { heading: 'You Finished Strong', sub: 'Consistency beats everything' },
];

// Shown when a workout counted toward the week but didn't finish its goal.
export const streakKeepGoingMessages = [
  'Rest days count too. Come back when you are ready.',
  'A short walk or stretch counts as long as it is 10 minutes.',
  "You're closer than you think.",
];

export const levelUpMessages = [
  'Every rep got you here. Keep building.',
  'You earned this one set at a time.',
  'New level, same discipline. Keep going.',
  'Proof that showing up works.',
];

export const badgeMessages = [
  'Earned, not given.',
  'Your work is adding up.',
  'This one is yours for good.',
];

export const personalRecordMessages = [
  'The strongest you have ever been.',
  'You just beat your old self.',
  'New ground. Remember how this feels.',
];

export function pickMessage<T>(messages: T[], seed: number): T {
  return messages[Math.abs(Math.round(seed)) % messages.length];
}
