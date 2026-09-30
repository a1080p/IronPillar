// What each badge looks like in the app. Which badges a user has earned is
// decided on the server: the ids and thresholds here must match
// functions/src/achievements.ts.
import type { Badge, BadgeCategory, BadgeTier } from '../types/models';

function badge(
  id: string,
  name: string,
  description: string,
  category: BadgeCategory,
  tier: BadgeTier,
  iconKey: string
): Badge {
  return { id, name, description, category, tier, iconKey };
}

// In display order.
export const BADGE_LIST: Badge[] = [
  badge('the-journey-begins', 'The Journey Begins', 'Complete your first workout', 'workouts', 'bronze', 'flag'),
  badge('workouts-5', 'Finding a Rhythm', 'Complete 5 workouts', 'workouts', 'bronze', 'barbell'),
  badge('workouts-10', 'Double Digits', 'Complete 10 workouts', 'workouts', 'bronze', 'barbell'),
  badge('workouts-25', 'Committed', 'Complete 25 workouts', 'workouts', 'silver', 'barbell'),
  badge('workouts-50', 'Fifty Strong', 'Complete 50 workouts', 'workouts', 'silver', 'medal'),
  badge('workouts-100', 'Century Club', 'Complete 100 workouts', 'workouts', 'gold', 'medal'),
  badge('workouts-250', 'Iron Regular', 'Complete 250 workouts', 'workouts', 'gold', 'shield-checkmark'),
  badge('workouts-500', 'Pillar of Iron', 'Complete 500 workouts', 'workouts', 'platinum', 'shield-checkmark'),

  badge('streak-3', 'Three in a Row', 'Reach a 3-day streak', 'streaks', 'bronze', 'flame'),
  badge('streak-7', 'One Week Strong', 'Reach a 7-day streak', 'streaks', 'bronze', 'flame'),
  badge('streak-14', 'Two Weeks Strong', 'Reach a 14-day streak', 'streaks', 'silver', 'flame'),
  badge('streak-30', '30-Day Streak', 'Reach a 30-day streak', 'streaks', 'silver', 'bonfire'),
  badge('streak-60', '60-Day Streak', 'Reach a 60-day streak', 'streaks', 'gold', 'bonfire'),
  badge('streak-100', '100-Day Streak', 'Reach a 100-day streak', 'streaks', 'gold', 'bonfire'),
  badge('streak-365', 'Year of Iron', 'Reach a 365-day streak', 'streaks', 'platinum', 'calendar'),

  badge('level-5', 'Level 5', 'Reach level 5', 'levels', 'bronze', 'star'),
  badge('level-10', 'Level 10', 'Reach level 10', 'levels', 'bronze', 'star'),
  badge('level-15', 'Level 15', 'Reach level 15', 'levels', 'silver', 'star'),
  badge('level-20', 'Level 20', 'Reach level 20', 'levels', 'silver', 'star'),
  badge('level-25', 'Level 25', 'Reach level 25', 'levels', 'gold', 'star'),
  badge('level-30', 'Level 30', 'Reach level 30', 'levels', 'gold', 'star'),
  badge('level-40', 'Level 40', 'Reach level 40', 'levels', 'platinum', 'star'),
  badge('level-50', 'Level 50', 'Reach level 50', 'levels', 'platinum', 'star'),

  badge('pr-1', 'First Personal Record', 'Beat your best on any lift', 'records', 'bronze', 'trophy'),
  badge('pr-5', '5 Personal Records', 'Set 5 personal records', 'records', 'bronze', 'trophy'),
  badge('pr-10', '10 Personal Records', 'Set 10 personal records', 'records', 'silver', 'trophy'),
  badge('pr-25', '25 Personal Records', 'Set 25 personal records', 'records', 'gold', 'trophy'),
  badge('pr-50', '50 Personal Records', 'Set 50 personal records', 'records', 'platinum', 'trophy'),

  badge('volume-10k', '10,000 lb Lifted', 'Lift 10,000 lb (4,500 kg) in total', 'strength', 'bronze', 'fitness'),
  badge('volume-50k', '50,000 lb Lifted', 'Lift 50,000 lb (22,700 kg) in total', 'strength', 'bronze', 'fitness'),
  badge('volume-100k', '100,000 lb Lifted', 'Lift 100,000 lb (45,400 kg) in total', 'strength', 'silver', 'fitness'),
  badge('volume-250k', '250,000 lb Lifted', 'Lift 250,000 lb (113,400 kg) in total', 'strength', 'silver', 'fitness'),
  badge('volume-500k', 'Half a Million Pounds', 'Lift 500,000 lb (226,800 kg) in total', 'strength', 'gold', 'fitness'),
  badge('volume-1m', 'Million Pound Club', 'Lift 1,000,000 lb (453,600 kg) in total', 'strength', 'platinum', 'diamond'),

  badge('distance-first', 'Out the Door', 'Finish your first outdoor walk, run or ride', 'distance', 'bronze', 'walk'),
  badge('distance-25k', 'Road Tested', 'Cover 25 km (15.5 mi) outdoors in total', 'distance', 'bronze', 'map'),
  badge('distance-100k', 'Distance Builder', 'Cover 100 km (62 mi) outdoors in total', 'distance', 'silver', 'map'),
  badge('distance-250k', 'Long Hauler', 'Cover 250 km (155 mi) outdoors in total', 'distance', 'gold', 'compass'),
  badge('distance-500k', 'Ultra Distance', 'Cover 500 km (311 mi) outdoors in total', 'distance', 'platinum', 'earth'),
  badge('single-5k', '5K', 'Cover 5 km (3.1 mi) in one outdoor activity', 'distance', 'bronze', 'navigate'),
  badge('single-10k', '10K', 'Cover 10 km (6.2 mi) in one outdoor activity', 'distance', 'silver', 'navigate'),
  badge('single-half', 'Half Marathon', 'Cover 21.1 km (13.1 mi) in one outdoor activity', 'distance', 'gold', 'navigate'),

  badge('time-10h', '10 Hours In', 'Train for 10 hours in total', 'time', 'bronze', 'time'),
  badge('time-50h', '50 Hours In', 'Train for 50 hours in total', 'time', 'silver', 'time'),
  badge('time-100h', '100 Hours In', 'Train for 100 hours in total', 'time', 'gold', 'hourglass'),
  badge('time-250h', '250 Hours In', 'Train for 250 hours in total', 'time', 'platinum', 'hourglass'),
  badge('session-60', 'Hour of Power', 'Finish a workout lasting an hour or more', 'time', 'bronze', 'stopwatch'),

  badge('early-bird', 'Early Bird', 'Finish 5 workouts before 7 AM', 'habits', 'silver', 'sunny'),
  badge('night-owl', 'Night Owl', 'Finish 5 workouts after 9 PM', 'habits', 'silver', 'moon'),
  badge('variety-5', 'Explorer', 'Try 5 different workouts', 'habits', 'bronze', 'telescope'),
  badge('variety-15', 'Well-Rounded', 'Try 15 different workouts', 'habits', 'gold', 'shapes'),
];

export const badges: Record<string, Badge> = Object.fromEntries(BADGE_LIST.map((b) => [b.id, b]));

export const BADGE_CATEGORIES: { key: BadgeCategory; label: string }[] = [
  { key: 'workouts', label: 'Workouts' },
  { key: 'streaks', label: 'Streaks' },
  { key: 'levels', label: 'Levels' },
  { key: 'records', label: 'Personal records' },
  { key: 'strength', label: 'Strength' },
  { key: 'distance', label: 'Distance' },
  { key: 'time', label: 'Time' },
  { key: 'habits', label: 'Habits' },
];
