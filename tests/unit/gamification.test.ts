// The app's week-streak display must agree with the server, which is the
// source of truth (functions/src/achievements.ts).
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as server from '../../functions/src/achievements';
import { activeStreak, clampWeeklyGoal, weekProgress, weekStartOf } from '../../constants/gamification';

// Every day from 2026-09-21 through 2026-11-15, crossing two month ends.
const DAYS = Array.from({ length: 56 }, (_, i) => server.addDays('2026-09-21', i));
const MONDAYS = DAYS.filter((d) => server.weekStartOf(d) === d);

// Noon UTC on `date`, so the date is the same in UTC and the zones below.
const noon = (date: string) => new Date(`${date}T12:00:00Z`);

const states: server.WeekState[] = [{}, { streakCount: 0, lastGoalWeek: '2026-10-12' }];
for (const lastGoalWeek of MONDAYS) {
  for (const shieldMonth of [null, '2026-09', '2026-10', '2026-11']) {
    states.push({ streakCount: 5, longestWeekStreak: 5, lastGoalWeek, shieldMonth });
  }
}

describe('client and server week logic agree', () => {
  it('weekStartOf and clampWeeklyGoal match', () => {
    for (const d of DAYS) assert.equal(weekStartOf(d), server.weekStartOf(d), d);
    for (const g of [undefined, null, NaN, 0, 1, 2, 3.4, 3.5, 6, 7, 100]) {
      assert.equal(clampWeeklyGoal(g as number), server.clampWeeklyGoal(g), String(g));
    }
  });

  it('activeStreak matches activeWeekStreak', () => {
    for (const state of states) {
      for (const today of DAYS) {
        for (const timeZone of [undefined, 'UTC', 'America/New_York', 'Asia/Tokyo']) {
          assert.equal(
            activeStreak({ ...state, timeZone }, noon(today)),
            server.activeWeekStreak(state, today),
            `${JSON.stringify(state)} on ${today} in ${timeZone}`
          );
        }
      }
    }
  });

  it('activeStreak follows the profile time zone across Sunday midnight', () => {
    // Sunday 2026-10-25 23:30 in New York is already Monday in UTC.
    const now = new Date('2026-10-26T03:30:00Z');
    const state = { streakCount: 3, lastGoalWeek: '2026-10-12' };
    const ny = activeStreak({ ...state, timeZone: 'America/New_York' }, now);
    assert.equal(ny, server.activeWeekStreak(state, '2026-10-25'));
    assert.equal(ny, 3);
    assert.equal(activeStreak({ ...state, timeZone: 'UTC' }, now), server.activeWeekStreak(state, '2026-10-26'));
  });

  it("weekProgress shows the week's count and locked goal the server would use", () => {
    const profiles: (server.WeekState & { weeklyGoal?: number })[] = [
      {},
      { weeklyGoal: 5 },
      { weekStart: '2026-10-19', weekCount: 2, weekGoal: 4, weeklyGoal: 2 },
      { weekStart: '2026-10-12', weekCount: 3, weekGoal: 3, weeklyGoal: 6 },
      { weekStart: '2026-10-26', weekCount: 1, weekGoal: 2, weeklyGoal: 3 }, // stored week ahead
    ];
    const notCounted = { setsDone: 0, durationSeconds: 0 };
    for (const profile of profiles) {
      for (const today of ['2026-10-19', '2026-10-22', '2026-10-25', '2026-10-26']) {
        const client = weekProgress(profile, noon(today));
        const s = server.applyWeekGoal(profile, today, profile.weeklyGoal, notCounted).next;
        const label = `${JSON.stringify(profile)} on ${today}`;
        assert.equal(client.count, s.weekCount, label);
        assert.equal(client.goal, s.weekGoal, label);
        assert.equal(client.goalHit, s.weekCount >= s.weekGoal, label);
        assert.equal(client.streak, server.activeWeekStreak(profile, today), label);
      }
    }
  });

  it('weekProgress counts days left, today included', () => {
    assert.equal(weekProgress({}, noon('2026-10-19')).daysLeft, 7); // Monday
    assert.equal(weekProgress({}, noon('2026-10-22')).daysLeft, 4); // Thursday
    assert.equal(weekProgress({}, noon('2026-10-25')).daysLeft, 1); // Sunday
    assert.equal(weekProgress({}, noon('2026-10-25')).weekStart, '2026-10-19');
  });
});
