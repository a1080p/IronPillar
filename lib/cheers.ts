// Short, hopeful messages for the quick pop-up after each finished exercise.
// Built from parts (opener + body, sometimes a personal line drawn from the
// goal and "what's holding you back" answers from onboarding), so there are
// thousands of combinations, and the last few are never repeated.
import type { Barrier } from '../types/models';

const OPENERS = [
  'Boom.',
  'Yes!',
  "That's it.",
  'Look at you.',
  'Nailed it.',
  'Huge.',
  'Clean work.',
  'Love that.',
  'Big moment.',
  'Strong.',
  'Beautiful.',
  "Let's go!",
  'Nice.',
  'Respect.',
  'Crushed it.',
  'Done and done.',
  'Smooth.',
  'Heck yes.',
  'There it is.',
  'Money.',
];

// {exercise} is the one just finished, {next} the one coming up.
const BODIES = [
  '{exercise} is in the books.',
  'Every rep of {exercise} counted.',
  '{exercise}: handled.',
  'Your future self felt that one.',
  'One more brick in the pillar.',
  "You're stronger than you were ten minutes ago.",
  'That effort is going to show.',
  'Momentum is on your side now.',
  'Progress loves people who show up.',
  "You didn't skip it. That matters.",
  'Small wins stack into big ones.',
  'This is what consistency looks like.',
  "Your body is keeping score, and you're winning.",
  'Breathe it in. You earned that.',
  'Up next: {next}. You are ready.',
  "{next} doesn't stand a chance.",
  'Carry this energy into {next}.',
  'Shake it out and bring it to {next}.',
  'Most people stopped before this. You kept going.',
  'Today you chose the hard thing. Good call.',
  "That's the kind of set people remember.",
  "Proof you're capable of more than you think.",
  'Discipline today, confidence tomorrow.',
  'Keep stacking these and watch what happens.',
  "You're building something real here.",
];

const BARRIER_LINES: Record<Barrier, string[]> = {
  time: [
    'Short on time and still getting it done.',
    'No wasted minutes here.',
    'Busy people who train anyway are a different breed.',
  ],
  motivation: [
    "Motivation follows action. You're proving it.",
    "You didn't wait to feel like it. You just did it.",
    'This is the spark. Keep it lit.',
  ],
  consistency: [
    'Another rep of the habit, not just the exercise.',
    'This is how routines are built: one finished exercise at a time.',
    'Show up, finish, repeat. You are doing it.',
  ],
  knowledge: [
    'You are learning this one rep at a time.',
    'Look at you following the plan like a pro.',
    'Every exercise you finish makes the next one easier to figure out.',
  ],
  confidence: [
    'You belong here as much as anyone.',
    'Head up. You are doing the work.',
    'Confidence is built exactly like this.',
  ],
  injury: [
    'Smart, steady work. Your body will thank you.',
    'Moving well beats moving heavy. Nice job.',
    'Listening to your body and still showing up. Respect.',
  ],
  other: [
    "Whatever's in the way, you just moved past it.",
    "You're bigger than what holds you back.",
    'One more step around the obstacle.',
  ],
};

const GOAL_LINES = [
  'One step closer to: {goal}',
  'Remember why you started: {goal}',
  'This is how "{goal}" happens.',
  'Every set gets you nearer to: {goal}',
];

const EMOJIS = ['🔥', '💪', '⚡️', '🚀', '🏆', '👏', '🙌', '✨', '💥', '🎯'];

const RECENT_LIMIT = 8;
const recent: string[] = [];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export interface Cheer {
  emoji: string;
  title: string;
  body: string;
}

export function makeCheer(options: {
  exercise: string;
  next?: string;
  barrier?: Barrier;
  goalText?: string;
}): Cheer {
  const { exercise, next, barrier, goalText } = options;
  const shortGoal =
    goalText && goalText.length <= 60 ? goalText.replace(/[.!]+$/, '') : undefined;

  for (let attempt = 0; attempt < 12; attempt++) {
    let bodies = BODIES.filter((b) => next || !b.includes('{next}'));
    const roll = Math.random();
    // About a third of the time, make it personal.
    if (barrier && roll < 0.2) bodies = BARRIER_LINES[barrier];
    else if (shortGoal && roll < 0.33) bodies = GOAL_LINES;

    const body = pick(bodies)
      .replace('{exercise}', exercise)
      .replace('{next}', next ?? '')
      .replace('{goal}', shortGoal ?? '');
    const title = pick(OPENERS);
    const key = `${title}|${body}`;
    if (recent.includes(key) && attempt < 11) continue;
    recent.push(key);
    if (recent.length > RECENT_LIMIT) recent.shift();
    return { emoji: pick(EMOJIS), title, body };
  }
  return { emoji: '💪', title: 'Nice.', body: `${exercise} is in the books.` };
}
