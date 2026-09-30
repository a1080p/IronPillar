// What each badge looks like in the app. Which badges a user has earned is
// decided on the server: the ids and thresholds here must match
// functions/src/achievements.ts.
import type { Badge, BadgeCategory, BadgeMetric, BadgeTier } from '../types/models';

function badge(
  id: string,
  name: string,
  description: string,
  category: BadgeCategory,
  tier: BadgeTier,
  iconKey: string,
  metric: BadgeMetric,
  threshold: number
): Badge {
  return { id, name, description, category, tier, iconKey, metric, threshold };
}

// In display order.
export const BADGE_LIST: Badge[] = [
  badge('the-journey-begins', 'The Journey Begins', 'Complete your first workout', 'workouts', 'bronze', 'flag', 'workouts', 1),
  badge('workouts-5', 'Finding a Rhythm', 'Complete 5 workouts', 'workouts', 'bronze', 'barbell', 'workouts', 5),
  badge('workouts-10', 'Double Digits', 'Complete 10 workouts', 'workouts', 'bronze', 'barbell', 'workouts', 10),
  badge('workouts-25', 'Committed', 'Complete 25 workouts', 'workouts', 'silver', 'barbell', 'workouts', 25),
  badge('workouts-50', 'Fifty Strong', 'Complete 50 workouts', 'workouts', 'silver', 'medal', 'workouts', 50),
  badge('workouts-100', 'Century Club', 'Complete 100 workouts', 'workouts', 'gold', 'medal', 'workouts', 100),
  badge('workouts-250', 'Iron Regular', 'Complete 250 workouts', 'workouts', 'gold', 'shield-checkmark', 'workouts', 250),
  badge('workouts-500', 'Pillar of Iron', 'Complete 500 workouts', 'workouts', 'platinum', 'shield-checkmark', 'workouts', 500),

  badge('streak-3', 'Three in a Row', 'Reach a 3-day streak', 'streaks', 'bronze', 'flame', 'streak', 3),
  badge('streak-7', 'One Week Strong', 'Reach a 7-day streak', 'streaks', 'bronze', 'flame', 'streak', 7),
  badge('streak-14', 'Two Weeks Strong', 'Reach a 14-day streak', 'streaks', 'silver', 'flame', 'streak', 14),
  badge('streak-30', '30-Day Streak', 'Reach a 30-day streak', 'streaks', 'silver', 'bonfire', 'streak', 30),
  badge('streak-60', '60-Day Streak', 'Reach a 60-day streak', 'streaks', 'gold', 'bonfire', 'streak', 60),
  badge('streak-100', '100-Day Streak', 'Reach a 100-day streak', 'streaks', 'gold', 'bonfire', 'streak', 100),
  badge('streak-365', 'Year of Iron', 'Reach a 365-day streak', 'streaks', 'platinum', 'calendar', 'streak', 365),

  badge('level-5', 'Level 5', 'Reach level 5', 'levels', 'bronze', 'star', 'level', 5),
  badge('level-10', 'Level 10', 'Reach level 10', 'levels', 'bronze', 'star', 'level', 10),
  badge('level-15', 'Level 15', 'Reach level 15', 'levels', 'silver', 'star', 'level', 15),
  badge('level-20', 'Level 20', 'Reach level 20', 'levels', 'silver', 'star', 'level', 20),
  badge('level-25', 'Level 25', 'Reach level 25', 'levels', 'gold', 'star', 'level', 25),
  badge('level-30', 'Level 30', 'Reach level 30', 'levels', 'gold', 'star', 'level', 30),
  badge('level-40', 'Level 40', 'Reach level 40', 'levels', 'platinum', 'star', 'level', 40),
  badge('level-50', 'Level 50', 'Reach level 50', 'levels', 'platinum', 'star', 'level', 50),

  badge('pr-1', 'First Personal Record', 'Beat your best on any lift', 'records', 'bronze', 'trophy', 'prs', 1),
  badge('pr-5', '5 Personal Records', 'Set 5 personal records', 'records', 'bronze', 'trophy', 'prs', 5),
  badge('pr-10', '10 Personal Records', 'Set 10 personal records', 'records', 'silver', 'trophy', 'prs', 10),
  badge('pr-25', '25 Personal Records', 'Set 25 personal records', 'records', 'gold', 'trophy', 'prs', 25),
  badge('pr-50', '50 Personal Records', 'Set 50 personal records', 'records', 'platinum', 'trophy', 'prs', 50),

  badge('volume-10k', '10,000 lb Lifted', 'Lift 10,000 lb (4,500 kg) in total', 'strength', 'bronze', 'fitness', 'volumeLb', 10000),
  badge('volume-50k', '50,000 lb Lifted', 'Lift 50,000 lb (22,700 kg) in total', 'strength', 'bronze', 'fitness', 'volumeLb', 50000),
  badge('volume-100k', '100,000 lb Lifted', 'Lift 100,000 lb (45,400 kg) in total', 'strength', 'silver', 'fitness', 'volumeLb', 100000),
  badge('volume-250k', '250,000 lb Lifted', 'Lift 250,000 lb (113,400 kg) in total', 'strength', 'silver', 'fitness', 'volumeLb', 250000),
  badge('volume-500k', 'Half a Million Pounds', 'Lift 500,000 lb (226,800 kg) in total', 'strength', 'gold', 'fitness', 'volumeLb', 500000),
  badge('volume-1m', 'Million Pound Club', 'Lift 1,000,000 lb (453,600 kg) in total', 'strength', 'platinum', 'diamond', 'volumeLb', 1000000),

  badge('distance-first', 'Out the Door', 'Finish your first outdoor walk, run or ride', 'distance', 'bronze', 'walk', 'distanceMeters', 1),
  badge('distance-25k', 'Road Tested', 'Cover 25 km (15.5 mi) outdoors in total', 'distance', 'bronze', 'map', 'distanceMeters', 25000),
  badge('distance-100k', 'Distance Builder', 'Cover 100 km (62 mi) outdoors in total', 'distance', 'silver', 'map', 'distanceMeters', 100000),
  badge('distance-250k', 'Long Hauler', 'Cover 250 km (155 mi) outdoors in total', 'distance', 'gold', 'compass', 'distanceMeters', 250000),
  badge('distance-500k', 'Ultra Distance', 'Cover 500 km (311 mi) outdoors in total', 'distance', 'platinum', 'earth', 'distanceMeters', 500000),
  badge('single-5k', '5K', 'Cover 5 km (3.1 mi) in one outdoor activity', 'distance', 'bronze', 'navigate', 'singleDistanceMeters', 5000),
  badge('single-10k', '10K', 'Cover 10 km (6.2 mi) in one outdoor activity', 'distance', 'silver', 'navigate', 'singleDistanceMeters', 10000),
  badge('single-half', 'Half Marathon', 'Cover 21.1 km (13.1 mi) in one outdoor activity', 'distance', 'gold', 'navigate', 'singleDistanceMeters', 21097),

  badge('time-10h', '10 Hours In', 'Train for 10 hours in total', 'time', 'bronze', 'time', 'seconds', 36000),
  badge('time-50h', '50 Hours In', 'Train for 50 hours in total', 'time', 'silver', 'time', 'seconds', 180000),
  badge('time-100h', '100 Hours In', 'Train for 100 hours in total', 'time', 'gold', 'hourglass', 'seconds', 360000),
  badge('time-250h', '250 Hours In', 'Train for 250 hours in total', 'time', 'platinum', 'hourglass', 'seconds', 900000),
  badge('session-60', 'Hour of Power', 'Finish a workout lasting an hour or more', 'time', 'bronze', 'stopwatch', 'singleSeconds', 3600),

  badge('early-bird', 'Early Bird', 'Finish 5 workouts before 7 AM', 'habits', 'silver', 'sunny', 'early', 5),
  badge('night-owl', 'Night Owl', 'Finish 5 workouts after 9 PM', 'habits', 'silver', 'moon', 'late', 5),
  badge('variety-5', 'Explorer', 'Try 5 different workouts', 'habits', 'bronze', 'telescope', 'variety', 5),
  badge('variety-15', 'Well-Rounded', 'Try 15 different workouts', 'habits', 'gold', 'shapes', 'variety', 15),
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
