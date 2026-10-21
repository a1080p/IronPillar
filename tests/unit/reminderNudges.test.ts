import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { nudgeForDay, type NudgeProfile } from '../../lib/reminderNudges';

// Wednesday 2026-10-21, noon UTC. Its week starts Monday 2026-10-19.
const WED = new Date('2026-10-21T12:00:00Z');
const SAT = new Date('2026-10-24T12:00:00Z');
const base: NudgeProfile = {
  timeZone: 'UTC',
  weeklyGoal: 3,
  weekStart: '2026-10-19',
  weekGoal: 3,
  streakCount: 4,
  lastGoalWeek: '2026-10-12',
  xp: 0,
};

describe('nudgeForDay', () => {
  it('sends nothing once the weekly goal is hit', () => {
    assert.equal(nudgeForDay({ ...base, weekCount: 3 }, WED, 350).maxReminders, 0);
  });

  it('sends one a day when the week has slack', () => {
    const n = nudgeForDay({ ...base, weekCount: 1 }, WED, 0);
    assert.equal(n.maxReminders, 1);
    assert.match(n.body, /2 to go/);
  });

  it('sends every slot and leads with the streak when a rest day would miss the goal', () => {
    const n = nudgeForDay({ ...base, weekCount: 1 }, SAT, 350);
    assert.equal(n.maxReminders, Infinity);
    assert.match(n.title, /2 workouts, 2 days left/);
    assert.match(n.body, /4-week streak/);
  });

  it('leads with the next rank when it is a workout or two away', () => {
    const n = nudgeForDay({ ...base, weekCount: 1, xp: 300 }, WED, 350);
    assert.equal(n.title, 'One workout from Iron II');
    assert.match(n.body, /200 XP to go/);
  });

  it('starts next week fresh after a goal-hit week', () => {
    const nextMon = new Date('2026-10-26T12:00:00Z');
    assert.equal(nudgeForDay({ ...base, weekCount: 3 }, nextMon, 350).maxReminders, 1);
  });
});
