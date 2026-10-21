// What a day's workout reminders should say, and how many of them, given the
// weekly goal and rank. Pure (no Expo imports) so it can be unit tested.
//
// The rules, in order:
// - Goal already hit this week: no "haven't trained" nudges until Monday.
//   Rest days are earned, and nagging after the goal is what gets apps muted.
// - Week has slack (more days left than workouts needed): one nudge that day.
// - Week is on the wire (a rest day would miss the goal): every enabled slot.
// Copy leads with whichever is closest: a streak at risk, the next rank, then the week.
import { weekProgress } from '../constants/gamification';
import { rankProgress } from '../constants/rank';
import type { UserProfile } from '../types/models';

export type NudgeProfile = Partial<
  Pick<
    UserProfile,
    'xp' | 'timeZone' | 'weeklyGoal' | 'weekStart' | 'weekCount' | 'weekGoal' | 'streakCount' | 'lastGoalWeek'
  >
>;

export interface DayNudge {
  maxReminders: number; // 0, 1, or Infinity (every enabled slot)
  title: string;
  body: string;
}

export function nudgeForDay(profile: NudgeProfile, day: Date, xpPerWorkout: number): DayNudge {
  const week = weekProgress(profile, day);
  if (week.goalHit) return { maxReminders: 0, title: '', body: '' };

  const needed = week.goal - week.count;
  const tight = needed >= week.daysLeft;
  const { next, xpToNext } = rankProgress(profile.xp);
  const workoutsToRank = next && xpPerWorkout > 0 ? Math.max(1, Math.ceil(xpToNext / xpPerWorkout)) : null;
  const weekLine = `${week.count} of ${week.goal} this week`;

  let title: string;
  let body: string;
  if (tight && week.streak > 0) {
    title =
      needed === 1 ? `Your ${week.streak}-week streak needs one more` : `${needed} workouts, ${week.daysLeft} days left`;
    body =
      needed === 1
        ? `${weekLine}. One today keeps the streak alive.`
        : `${weekLine}. A workout today keeps your ${week.streak}-week streak in reach.`;
  } else if (next && workoutsToRank != null && workoutsToRank <= 2) {
    title = workoutsToRank === 1 ? `One workout from ${next.name}` : `Two workouts from ${next.name}`;
    body = `${xpToNext.toLocaleString('en-US')} XP to go. ${weekLine}.`;
  } else if (needed === 1) {
    title = 'One more hits your weekly goal';
    body = `${weekLine}. Get it today and the rest of the week is yours.`;
  } else {
    title = weekLine;
    body = `${needed} to go with ${week.daysLeft} days left. Every set earns XP toward ${next ? next.name : 'the top'}.`;
  }
  return { maxReminders: tight ? Infinity : 1, title, body };
}

// Typical XP a workout, from the 10 most recent that earned any.
export function averageXpPerWorkout(logs: { xpEarned?: number }[]): number {
  const recent = logs.filter((l) => (l.xpEarned ?? 0) > 0).slice(0, 10);
  return recent.length ? recent.reduce((n, l) => n + (l.xpEarned ?? 0), 0) / recent.length : 0;
}
