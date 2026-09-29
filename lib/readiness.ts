import type { WearableSnapshot, WorkoutLog } from '../types/models';
import type { ExternalWorkout, HealthSnapshot } from './healthkit';

// Pro daily readiness score (0-100). Blends up to three signals, re-weighting
// across whichever are available so a user with no wearable still gets a
// load-based score:
//   - recovery: WHOOP's recovery score if connected, otherwise Apple Health
//     HRV and resting HR against the user's own 30-day baseline
//   - sleep: last night's hours (Apple Health), else WHOOP sleep performance
//   - training load: acute (7-day) vs chronic (28-day) training minutes,
//     including Apple Watch / other-app workouts read from Apple Health

const DAY_MS = 24 * 60 * 60 * 1000;
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export type ReadinessTone = 'up' | 'down' | 'neutral';

export interface ReadinessFactor {
  label: string;
  value: string;
  detail: string;
  tone: ReadinessTone;
}

export interface Readiness {
  score: number;
  label: 'Primed' | 'Ready' | 'Moderate' | 'Recover';
  recommendation: string;
  factors: ReadinessFactor[];
  hasWearableData: boolean;
}

function loadEntries(logs: WorkoutLog[], external: ExternalWorkout[]) {
  return [
    ...logs.map((l) => ({
      at: new Date(l.completedAt).getTime(),
      minutes: Math.round(l.durationSeconds / 60),
    })),
    ...external.map((w) => ({ at: new Date(w.start).getTime(), minutes: w.minutes })),
  ];
}

// Acute:chronic workload ratio. ~0.8–1.3 is the commonly cited sweet spot;
// well above it is a spike in load, below it means you're fresh.
function loadScore(ratio: number | null): number {
  if (ratio == null) return 80;
  if (ratio > 1.5) return clamp(55 - (ratio - 1.5) * 60, 20);
  if (ratio > 1.3) return 70;
  if (ratio >= 0.8) return 85;
  return 92;
}

function sleepScore(hours: number): number {
  if (hours >= 8) return 100;
  if (hours >= 7) return 85 + (hours - 7) * 15;
  if (hours >= 6) return 65 + (hours - 6) * 20;
  if (hours >= 5) return 45 + (hours - 5) * 20;
  return clamp(hours * 9, 10);
}

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))}`;

export function computeReadiness(
  logs: WorkoutLog[],
  health: HealthSnapshot | null,
  whoop: WearableSnapshot | null
): Readiness {
  const now = Date.now();
  const entries = loadEntries(logs, health?.externalWorkouts ?? []);
  const acute = entries.filter((e) => e.at >= now - 7 * DAY_MS).reduce((s, e) => s + e.minutes, 0);
  const chronicWeekly =
    entries.filter((e) => e.at >= now - 28 * DAY_MS).reduce((s, e) => s + e.minutes, 0) / 4;
  const ratio = chronicWeekly >= 30 ? Math.round((acute / chronicWeekly) * 100) / 100 : null;

  const parts: { weight: number; score: number }[] = [];
  const factors: ReadinessFactor[] = [];

  // Recovery
  if (whoop?.connected && whoop.recoveryScore != null) {
    parts.push({ weight: 0.45, score: whoop.recoveryScore });
    factors.push({
      label: 'WHOOP recovery',
      value: `${Math.round(whoop.recoveryScore)}%`,
      detail: 'From your latest WHOOP recovery',
      tone: whoop.recoveryScore >= 67 ? 'up' : whoop.recoveryScore < 34 ? 'down' : 'neutral',
    });
  } else {
    const recoveryScores: number[] = [];
    if (health?.hrvMs != null && health.hrvBaselineMs) {
      const pct = (health.hrvMs - health.hrvBaselineMs) / health.hrvBaselineMs;
      recoveryScores.push(clamp(60 + pct * 200));
      factors.push({
        label: 'HRV',
        value: `${Math.round(health.hrvMs)} ms`,
        detail: `${signed(pct * 100)}% vs your 30-day avg`,
        tone: pct > 0.05 ? 'up' : pct < -0.1 ? 'down' : 'neutral',
      });
    }
    if (health?.restingHeartRateBpm != null && health.restingHeartRateBaselineBpm) {
      const diff = health.restingHeartRateBpm - health.restingHeartRateBaselineBpm;
      recoveryScores.push(clamp(70 - diff * 7));
      factors.push({
        label: 'Resting HR',
        value: `${Math.round(health.restingHeartRateBpm)} bpm`,
        detail: `${signed(diff)} vs your 30-day avg`,
        tone: diff <= -1 ? 'up' : diff >= 3 ? 'down' : 'neutral',
      });
    }
    if (recoveryScores.length > 0) {
      parts.push({
        weight: 0.45,
        score: recoveryScores.reduce((a, b) => a + b, 0) / recoveryScores.length,
      });
    }
  }

  // Sleep
  if (health?.sleepHours != null) {
    parts.push({ weight: 0.25, score: sleepScore(health.sleepHours) });
    factors.push({
      label: 'Sleep',
      value: `${health.sleepHours} h`,
      detail: health.sleepHours >= 7 ? 'Solid night' : 'Below the 7h most adults need',
      tone: health.sleepHours >= 7 ? 'up' : health.sleepHours < 6 ? 'down' : 'neutral',
    });
  } else if (whoop?.connected && whoop.sleepPerformancePct != null) {
    parts.push({ weight: 0.25, score: whoop.sleepPerformancePct });
    factors.push({
      label: 'Sleep',
      value: `${Math.round(whoop.sleepPerformancePct)}%`,
      detail: 'WHOOP sleep performance',
      tone:
        whoop.sleepPerformancePct >= 85 ? 'up' : whoop.sleepPerformancePct < 70 ? 'down' : 'neutral',
    });
  }

  // Training load
  parts.push({ weight: 0.3, score: loadScore(ratio) });
  const avg = Math.round(chronicWeekly);
  factors.push({
    label: 'Training load',
    value: ratio == null ? `${acute} min` : `${ratio.toFixed(2)}×`,
    detail:
      ratio == null
        ? 'Last 7 days. Keep logging to unlock your load ratio'
        : ratio > 1.3
          ? `${acute} min this week, well above your ${avg} min average`
          : ratio < 0.8
            ? `${acute} min this week, lighter than your ${avg} min average`
            : `${acute} min this week, right around your ${avg} min average`,
    tone: ratio == null ? 'neutral' : ratio > 1.5 ? 'down' : ratio < 0.8 ? 'up' : 'neutral',
  });

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight);

  if (score >= 80) {
    return {
      score,
      label: 'Primed',
      recommendation: 'Good day to push it. Go for a heavy strength session or a PR attempt.',
      factors,
      hasWearableData: parts.length > 1,
    };
  }
  if (score >= 65) {
    return {
      score,
      label: 'Ready',
      recommendation: 'Train as planned: normal volume and intensity.',
      factors,
      hasWearableData: parts.length > 1,
    };
  }
  if (score >= 45) {
    return {
      score,
      label: 'Moderate',
      recommendation: 'Keep it moderate. Trim a set or two, or do a lighter conditioning day.',
      factors,
      hasWearableData: parts.length > 1,
    };
  }
  return {
    score,
    label: 'Recover',
    recommendation: 'Your body is asking for rest. Try a walk, mobility work, or yoga instead.',
    factors,
    hasWearableData: parts.length > 1,
  };
}
