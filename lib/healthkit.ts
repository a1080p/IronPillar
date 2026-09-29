import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { OutdoorActivityType } from '../types/models';

// Apple Health (HealthKit) bridge — also how Apple Watch data reaches the app:
// the Watch records HRV, resting heart rate, sleep, and workouts into Health,
// and Iron Pillar reads them from there.
//
// Same Expo-Go-safety pattern as PurchasesContext: the HealthKit package is a
// Nitro native module, so it's only ever loaded via dynamic import() on an iOS
// build that actually contains it. Everything read here stays on the device —
// it is never written to Firestore (App Store guideline 5.1.3 + our privacy
// policy both depend on that).

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const isHealthKitSupported = Platform.OS === 'ios' && !isExpoGo;

const OWN_BUNDLE_ID = 'com.aidand510.ironpillar';

const READ_TYPES = [
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierBodyMass',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

const SHARE_TYPES = ['HKWorkoutTypeIdentifier'] as const;

async function loadHealthKit() {
  if (!isHealthKitSupported) return null;
  const hk = await import('@kingstinct/react-native-healthkit');
  return hk.isHealthDataAvailable() ? hk : null;
}

// Shows Apple's permission sheet (only the first time — iOS never re-prompts,
// and never tells an app which read types were denied). Returns false when
// Health isn't available on this device/build at all.
export async function requestHealthAccess(): Promise<boolean> {
  const hk = await loadHealthKit();
  if (!hk) return false;
  await hk.requestAuthorization({ toRead: [...READ_TYPES], toShare: [...SHARE_TYPES] });
  return true;
}

export interface ExternalWorkout {
  start: string; // ISO timestamp
  minutes: number;
  activityType: number; // HKWorkoutActivityType raw value
  sourceName: string; // e.g. "Aidan's Apple Watch"
}

export interface HealthSnapshot {
  fetchedAt: string;
  hrvMs?: number; // most recent SDNN sample in the last 36h
  hrvBaselineMs?: number; // 30-day average
  restingHeartRateBpm?: number;
  restingHeartRateBaselineBpm?: number;
  sleepHours?: number; // last night, best single source
  stepsToday?: number;
  activeEnergyTodayKcal?: number;
  latestWeightLb?: number;
  // Workouts from other apps/devices (Apple Watch Workout app, Strava, etc.)
  // in the last 28 days. Iron Pillar's own saved workouts are excluded so
  // they're never double-counted against our own logs.
  externalWorkouts: ExternalWorkout[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function fetchHealthSnapshot(): Promise<HealthSnapshot | null> {
  const hk = await loadHealthKit();
  if (!hk) return null;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const recentCutoff = now.getTime() - 36 * 60 * 60 * 1000;
  // Sleep window: 6 PM yesterday → now, so a night's sleep is fully captured.
  const sleepWindowStart = new Date(startOfToday.getTime() - 6 * 60 * 60 * 1000);
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * DAY_MS);

  // Each read is independent and best-effort: a denied or empty type just
  // leaves that field undefined instead of failing the whole snapshot.
  const safe = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (e) {
      console.warn('HealthKit read failed', e);
      return undefined;
    }
  };

  const [hrvSamples, rhrSamples, sleepSamples, steps, energy, weight, workouts] =
    await Promise.all([
      safe(() =>
        hk.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', {
          unit: 'ms',
          limit: 0,
          ascending: false,
          filter: { date: { startDate: thirtyDaysAgo, endDate: now } },
        })
      ),
      safe(() =>
        hk.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
          unit: 'count/min',
          limit: 0,
          ascending: false,
          filter: { date: { startDate: thirtyDaysAgo, endDate: now } },
        })
      ),
      safe(() =>
        hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
          limit: 0,
          ascending: true,
          filter: { date: { startDate: sleepWindowStart, endDate: now } },
        })
      ),
      safe(() =>
        hk.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], {
          unit: 'count',
          filter: { date: { startDate: startOfToday, endDate: now } },
        })
      ),
      safe(() =>
        hk.queryStatisticsForQuantity(
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          ['cumulativeSum'],
          { unit: 'kcal', filter: { date: { startDate: startOfToday, endDate: now } } }
        )
      ),
      safe(() => hk.getMostRecentQuantitySample('HKQuantityTypeIdentifierBodyMass', 'lb')),
      safe(() =>
        hk.queryWorkoutSamples({
          limit: 0,
          ascending: false,
          filter: { date: { startDate: twentyEightDaysAgo, endDate: now } },
        })
      ),
    ]);

  const snapshot: HealthSnapshot = { fetchedAt: now.toISOString(), externalWorkouts: [] };

  if (hrvSamples && hrvSamples.length > 0) {
    const latest = hrvSamples[0];
    if (new Date(latest.startDate).getTime() >= recentCutoff) snapshot.hrvMs = latest.quantity;
    snapshot.hrvBaselineMs = average(hrvSamples.map((s) => s.quantity));
  }

  if (rhrSamples && rhrSamples.length > 0) {
    const latest = rhrSamples[0];
    if (new Date(latest.startDate).getTime() >= recentCutoff) {
      snapshot.restingHeartRateBpm = latest.quantity;
    }
    snapshot.restingHeartRateBaselineBpm = average(rhrSamples.map((s) => s.quantity));
  }

  if (sleepSamples && sleepSamples.length > 0) {
    // iPhone, Apple Watch, and third-party apps can all write overlapping
    // sleep for the same night. Summing them would double-count, so total per
    // source and take the most complete one.
    const ASLEEP_VALUES = new Set([1, 3, 4, 5]); // asleep/unspecified, core, deep, REM
    const perSource = new Map<string, number>();
    for (const s of sleepSamples) {
      if (!ASLEEP_VALUES.has(Number(s.value))) continue;
      const key = s.sourceRevision?.source?.bundleIdentifier ?? 'unknown';
      const ms = new Date(s.endDate).getTime() - new Date(s.startDate).getTime();
      perSource.set(key, (perSource.get(key) ?? 0) + ms);
    }
    const best = Math.max(0, ...perSource.values());
    if (best > 0) snapshot.sleepHours = Math.round((best / (60 * 60 * 1000)) * 10) / 10;
  }

  const stepsSum = steps?.sumQuantity?.quantity;
  if (stepsSum != null) snapshot.stepsToday = Math.round(stepsSum);
  const energySum = energy?.sumQuantity?.quantity;
  if (energySum != null) snapshot.activeEnergyTodayKcal = Math.round(energySum);
  if (weight?.quantity != null) snapshot.latestWeightLb = Math.round(weight.quantity * 10) / 10;

  for (const w of workouts ?? []) {
    const source = w.sourceRevision?.source;
    if (source?.bundleIdentifier !== OWN_BUNDLE_ID) {
      const start = new Date(w.startDate);
      const minutes = Math.round((new Date(w.endDate).getTime() - start.getTime()) / 60000);
      if (minutes > 0) {
        snapshot.externalWorkouts.push({
          start: start.toISOString(),
          minutes,
          activityType: Number(w.workoutActivityType),
          sourceName: source?.name ?? 'Apple Health',
        });
      }
    }
    // Workouts come back as native proxies; release them eagerly.
    w.dispose?.();
  }

  return snapshot;
}

export interface WorkoutForHealth {
  startDate: Date;
  endDate: Date;
  activityType?: OutdoorActivityType; // outdoor GPS activities; otherwise strength
  distanceMeters?: number;
}

// Saves a completed Iron Pillar workout to Apple Health, which is what makes
// it show up in the Fitness app and count toward Activity rings on the Watch.
export async function saveWorkoutToHealth(workout: WorkoutForHealth): Promise<boolean> {
  const hk = await loadHealthKit();
  if (!hk) return false;
  const { WorkoutActivityType } = hk;

  let type = WorkoutActivityType.traditionalStrengthTraining;
  if (workout.activityType === 'walk') type = WorkoutActivityType.walking;
  else if (workout.activityType === 'run') type = WorkoutActivityType.running;
  else if (workout.activityType === 'bike') type = WorkoutActivityType.cycling;

  const totals = workout.distanceMeters ? { distance: workout.distanceMeters } : undefined;
  const saved = await hk.saveWorkoutSample(type, [], workout.startDate, workout.endDate, totals);
  saved?.dispose?.();
  return true;
}

// Human label for the activity types we're most likely to see from a Watch.
export function activityTypeLabel(raw: number): string {
  switch (raw) {
    case 13:
      return 'Cycling';
    case 16:
      return 'Elliptical';
    case 20:
      return 'Functional strength';
    case 35:
      return 'Rowing';
    case 37:
      return 'Running';
    case 46:
      return 'Swimming';
    case 50:
      return 'Strength training';
    case 52:
      return 'Walking';
    case 57:
      return 'Yoga';
    case 63:
      return 'HIIT';
    default:
      return 'Workout';
  }
}
