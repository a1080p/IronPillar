import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  activeWeekStreak,
  applyWeekGoal,
  applyWorkout,
  clampWeeklyGoal,
  emptyStats,
  weekStartOf,
  type StatsWorkout,
  type UserStats,
  type WeekState,
} from '../src/achievements';

// 2026-09-28, 10-05, 10-12, 10-19, 10-26 and 11-02 are Mondays.
const LIFT = { setsDone: 3, durationSeconds: 45 * 60 };

// Logs one counted workout on each date, carrying the week state forward.
function logDays(state: WeekState, dates: string[], goal = 3, workout = LIFT) {
  let result = applyWeekGoal(state, dates[0], goal, workout);
  for (const date of dates.slice(1)) result = applyWeekGoal(result.next, date, goal, workout);
  return result;
}

// Hits a goal of 3 in the week starting `monday` (Mon, Wed, Fri).
function hitWeek(state: WeekState, monday: string) {
  const [y, m, d] = monday.split('-').map(Number);
  const day = (offset: number) => new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
  return logDays(state, [day(0), day(2), day(4)]);
}

describe('weekStartOf', () => {
  it('returns the Monday for every day of the week', () => {
    for (const date of ['2026-10-19', '2026-10-21', '2026-10-24', '2026-10-25']) {
      assert.equal(weekStartOf(date), '2026-10-19', date);
    }
  });

  it('starts a new week on Monday after Sunday', () => {
    assert.equal(weekStartOf('2026-10-25'), '2026-10-19');
    assert.equal(weekStartOf('2026-10-26'), '2026-10-26');
  });

  it('crosses month and year boundaries', () => {
    assert.equal(weekStartOf('2026-11-01'), '2026-10-26');
    assert.equal(weekStartOf('2027-01-01'), '2026-12-28');
  });
});

describe('clampWeeklyGoal', () => {
  it('keeps goals within 2-6', () => {
    assert.equal(clampWeeklyGoal(1), 2);
    assert.equal(clampWeeklyGoal(2), 2);
    assert.equal(clampWeeklyGoal(6), 6);
    assert.equal(clampWeeklyGoal(10), 6);
  });

  it('rounds and parses', () => {
    assert.equal(clampWeeklyGoal(3.6), 4);
    assert.equal(clampWeeklyGoal('5'), 5);
  });

  it('falls back to the default of 3 for missing or junk values', () => {
    assert.equal(clampWeeklyGoal(undefined), 3);
    assert.equal(clampWeeklyGoal(null), 3);
    assert.equal(clampWeeklyGoal(''), 3);
    assert.equal(clampWeeklyGoal('abc'), 3);
    assert.equal(clampWeeklyGoal(NaN), 3);
  });
});

describe('applyWeekGoal', () => {
  it('hits the goal on the Nth counted workout', () => {
    const first = applyWeekGoal({}, '2026-10-19', 3, LIFT);
    assert.equal(first.next.weekCount, 1);
    assert.equal(first.goalHitNow, false);
    assert.equal(first.bonusXp, 0);

    const second = applyWeekGoal(first.next, '2026-10-20', 3, LIFT);
    assert.equal(second.goalHitNow, false);

    const third = applyWeekGoal(second.next, '2026-10-22', 3, LIFT);
    assert.equal(third.next.weekCount, 3);
    assert.equal(third.goalHitNow, true);
    assert.equal(third.next.streakCount, 1);
    assert.equal(third.next.lastGoalWeek, '2026-10-19');
    assert.equal(third.bonusXp, 100);
  });

  it('pays the goal bonus only once a week', () => {
    const hit = logDays({}, ['2026-10-19', '2026-10-20', '2026-10-21']);
    const extra = applyWeekGoal(hit.next, '2026-10-23', 3, LIFT);
    assert.equal(extra.counted, true);
    assert.equal(extra.next.weekCount, 4);
    assert.equal(extra.goalHitNow, false);
    assert.equal(extra.bonusXp, 0);
    assert.equal(extra.next.streakCount, 1);
  });

  it('counts two workouts on the same day', () => {
    const r = logDays({}, ['2026-10-19', '2026-10-19', '2026-10-19']);
    assert.equal(r.goalHitNow, true);
  });

  it('ignores short workouts with no completed sets', () => {
    const short = applyWeekGoal({}, '2026-10-19', 3, { setsDone: 0, durationSeconds: 9 * 60 + 59 });
    assert.equal(short.counted, false);
    assert.equal(short.next.weekCount, 0);

    const longWalk = applyWeekGoal({}, '2026-10-19', 3, { setsDone: 0, durationSeconds: 10 * 60 });
    assert.equal(longWalk.counted, true);

    const quickLift = applyWeekGoal({}, '2026-10-19', 3, { setsDone: 1, durationSeconds: 60 });
    assert.equal(quickLift.counted, true);
  });

  it('does not hit the goal on a workout that did not count', () => {
    const two = logDays({}, ['2026-10-19', '2026-10-20']);
    const short = applyWeekGoal(two.next, '2026-10-21', 3, { setsDone: 0, durationSeconds: 60 });
    assert.equal(short.goalHitNow, false);
    assert.equal(short.next.weekCount, 2);
  });

  it('grows the streak over consecutive weeks, rest days in between', () => {
    let r = hitWeek({}, '2026-10-05');
    r = hitWeek(r.next, '2026-10-12');
    r = hitWeek(r.next, '2026-10-19');
    assert.equal(r.next.streakCount, 3);
    assert.equal(r.next.longestWeekStreak, 3);
    assert.equal(r.bonusXp, 100 + 25 * 2);
    assert.equal(r.shieldUsed, false);
  });

  it('caps the streak bonus at 8 extra steps', () => {
    const state: WeekState = {
      weekStart: '2026-10-12',
      weekCount: 3,
      weekGoal: 3,
      streakCount: 19,
      longestWeekStreak: 19,
      lastGoalWeek: '2026-10-12',
    };
    const r = hitWeek(state, '2026-10-19');
    assert.equal(r.next.streakCount, 20);
    assert.equal(r.bonusXp, 100 + 25 * 8);
  });

  it('covers one missed week with the monthly shield', () => {
    let r = hitWeek({}, '2026-09-28');
    r = hitWeek(r.next, '2026-10-05');
    // 2026-10-12 missed.
    r = hitWeek(r.next, '2026-10-19');
    assert.equal(r.shieldUsed, true);
    assert.equal(r.next.streakCount, 3);
    assert.equal(r.next.shieldMonth, '2026-10');
  });

  it('allows a shield again in a new month', () => {
    let r = hitWeek({}, '2026-10-05');
    r = hitWeek(r.next, '2026-10-19'); // shield for 10-12, October
    // 2026-10-26 missed.
    r = hitWeek(r.next, '2026-11-02');
    assert.equal(r.shieldUsed, true);
    assert.equal(r.next.streakCount, 3);
    assert.equal(r.next.shieldMonth, '2026-11');
  });

  it('resets on a second miss in the same month', () => {
    let r = hitWeek({}, '2026-09-28');
    // 2026-10-05 missed.
    r = hitWeek(r.next, '2026-10-12');
    assert.equal(r.shieldUsed, true);
    assert.equal(r.next.streakCount, 2);
    // 2026-10-19 missed, shield already used in October.
    r = hitWeek(r.next, '2026-10-26');
    assert.equal(r.shieldUsed, false);
    assert.equal(r.next.streakCount, 1);
    assert.equal(r.next.longestWeekStreak, 2);
  });

  it('ends the streak after two missed weeks in a row', () => {
    let r = hitWeek({}, '2026-09-28');
    r = hitWeek(r.next, '2026-10-05');
    // 2026-10-12 and 2026-10-19 missed.
    assert.equal(activeWeekStreak(r.next, '2026-10-26'), 0);
    r = hitWeek(r.next, '2026-10-26');
    assert.equal(r.shieldUsed, false);
    assert.equal(r.next.streakCount, 1);
    assert.equal(r.next.longestWeekStreak, 2);
  });

  it('keeps a mid-week goal change for next Monday (lowering)', () => {
    const one = applyWeekGoal({}, '2026-10-19', 3, LIFT);
    assert.equal(one.next.weekGoal, 3);
    const two = applyWeekGoal(one.next, '2026-10-20', 2, LIFT);
    assert.equal(two.next.weekGoal, 3);
    assert.equal(two.goalHitNow, false);
    const nextWeek = applyWeekGoal(two.next, '2026-10-26', 2, LIFT);
    assert.equal(nextWeek.next.weekGoal, 2);
    assert.equal(nextWeek.next.weekCount, 1);
  });

  it('keeps a mid-week goal change for next Monday (raising)', () => {
    const one = applyWeekGoal({}, '2026-10-19', 2, LIFT);
    const two = applyWeekGoal(one.next, '2026-10-20', 5, LIFT);
    assert.equal(two.next.weekGoal, 2);
    assert.equal(two.goalHitNow, true);
  });

  it('counts Sunday toward its week and starts fresh on Monday', () => {
    const sun = logDays({}, ['2026-10-23', '2026-10-24', '2026-10-25']);
    assert.equal(sun.next.weekStart, '2026-10-19');
    assert.equal(sun.goalHitNow, true);

    const mon = applyWeekGoal(sun.next, '2026-10-26', 3, LIFT);
    assert.equal(mon.next.weekStart, '2026-10-26');
    assert.equal(mon.next.weekCount, 1);
    assert.equal(mon.next.streakCount, 1); // last week still counts
  });

  it('treats a stored week later than today as the same week', () => {
    const state: WeekState = { weekStart: '2026-10-26', weekCount: 2, weekGoal: 3 };
    const r = applyWeekGoal(state, '2026-10-25', 3, LIFT);
    assert.equal(r.next.weekStart, '2026-10-26');
    assert.equal(r.next.weekCount, 3);
    assert.equal(r.goalHitNow, true);
  });
});

describe('activeWeekStreak', () => {
  const base = { streakCount: 4, longestWeekStreak: 4 };

  it('is zero without a hit week', () => {
    assert.equal(activeWeekStreak({}, '2026-10-21'), 0);
    assert.equal(activeWeekStreak({ streakCount: 0, lastGoalWeek: '2026-10-19' }, '2026-10-21'), 0);
  });

  it('stays alive through this week and last week', () => {
    assert.equal(activeWeekStreak({ ...base, lastGoalWeek: '2026-10-19' }, '2026-10-21'), 4);
    assert.equal(activeWeekStreak({ ...base, lastGoalWeek: '2026-10-12' }, '2026-10-25'), 4);
  });

  it('stays alive one missed week while the shield is unused this month', () => {
    assert.equal(activeWeekStreak({ ...base, lastGoalWeek: '2026-10-05' }, '2026-10-21'), 4);
    assert.equal(
      activeWeekStreak({ ...base, lastGoalWeek: '2026-10-05', shieldMonth: '2026-10' }, '2026-10-21'),
      0
    );
  });

  it('is over after two missed weeks', () => {
    assert.equal(activeWeekStreak({ ...base, lastGoalWeek: '2026-09-28' }, '2026-10-21'), 0);
  });
});

describe('applyWorkout personal records', () => {
  const at = new Date('2026-10-20T15:00:00Z');
  const lift = (name: string, weight: number, reps: number): StatsWorkout => ({
    workoutId: 'w',
    isOutdoor: false,
    completedAt: at,
    durationSeconds: 3600,
    distanceMeters: 0,
    exercises: [{ exerciseId: 'e', exerciseName: name, logType: 'reps_weight', sets: [{ weight, reps }] }],
  });
  const run = (stats: UserStats, w: StatsWorkout) => applyWorkout(stats, w, 'UTC');

  it('treats the first logged weight as a baseline, not a record', () => {
    const r = run(emptyStats(), lift('Barbell Bench Press', 135, 5));
    assert.deepEqual(r.personalRecords, []);
    assert.equal(r.stats.prCount, 0);
    assert.equal(r.stats.bests['barbell bench press'], 135 * (1 + 5 / 30));
  });

  it('records a PR when the estimated 1RM goes up', () => {
    const first = run(emptyStats(), lift('Barbell Bench Press', 135, 5));
    const second = run(first.stats, lift('Barbell Bench Press', 145, 5));
    assert.equal(second.personalRecords.length, 1);
    assert.equal(second.personalRecords[0].weight, 145);
    assert.equal(second.personalRecords[0].previousOneRepMax, Math.round(135 * (1 + 5 / 30)));
    assert.equal(second.stats.prCount, 1);
  });

  it('does not record a PR for an equal or lighter lift', () => {
    const first = run(emptyStats(), lift('Barbell Bench Press', 135, 5));
    assert.equal(run(first.stats, lift('Barbell Bench Press', 135, 5)).personalRecords.length, 0);
    assert.equal(run(first.stats, lift('Barbell Bench Press', 125, 5)).personalRecords.length, 0);
  });

  it('matches names case- and whitespace-insensitively', () => {
    const first = run(emptyStats(), lift('Barbell Bench Press', 135, 5));
    const second = run(first.stats, lift('  barbell bench press ', 125, 5));
    assert.equal(second.personalRecords.length, 0);
  });

  it('folds an old best under a renamed exercise into its new name', () => {
    const stats = { ...emptyStats(), bests: { 'conventional deadlift': 300 } };
    const lighter = run(stats, lift('Barbell Deadlift', 225, 5)); // 1RM 262.5
    assert.deepEqual(lighter.personalRecords, []);
    assert.equal(lighter.stats.bests['barbell deadlift'], 300);
    assert.equal('conventional deadlift' in lighter.stats.bests, false);

    const heavier = run(stats, lift('Barbell Deadlift', 300, 3)); // 1RM 330
    assert.equal(heavier.personalRecords.length, 1);
    assert.equal(heavier.personalRecords[0].previousOneRepMax, 300);
  });

  it('keeps the higher best when both old and new names are stored', () => {
    const stats = {
      ...emptyStats(),
      bests: { 'front plank': 50, plank: 80, 'conventional deadlift': 400, 'barbell deadlift': 350 },
    };
    const r = run(stats, lift('Barbell Deadlift', 315, 3)); // 1RM 346.5
    assert.equal(r.stats.bests['barbell deadlift'], 400);
    assert.equal(r.stats.bests.plank, 80);
    assert.deepEqual(r.personalRecords, []);
  });

  it('logs an old template name under its new key', () => {
    const stats = { ...emptyStats(), bests: { 'barbell deadlift': 300 } };
    const r = run(stats, lift('Conventional Deadlift', 225, 5));
    assert.deepEqual(r.personalRecords, []);
    assert.deepEqual(Object.keys(r.stats.bests), ['barbell deadlift']);
  });

  it('skips sets without weight or reps', () => {
    const w = lift('Barbell Bench Press', 0, 10);
    w.exercises[0].sets.push({ weight: 100, reps: 0 });
    const r = run(emptyStats(), w);
    assert.deepEqual(r.stats.bests, {});
    assert.equal(r.stats.totalVolumeLb, 0);
  });
});
