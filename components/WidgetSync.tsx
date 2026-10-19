// Keeps the "Iron Pillar Today" home/lock screen widget (widgets/TodayWidget)
// current while the app runs. Widgets can't read Firestore or HealthKit on
// their own, so the app hands them a timeline: today's numbers now, then a
// reset at the next midnight (and on Monday, the week rolling over).
// Safe everywhere: without the native widget module it does nothing.
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { Widget } from 'expo-widgets';
import { todayDateString, weekProgress } from '../constants/gamification';
import { useAuth } from '../contexts/AuthContext';
import { usePurchases } from '../contexts/PurchasesContext';
import { useAppleHealth } from '../hooks/useAppleHealth';
import { useFoodLog } from '../hooks/useFoodLog';
import { useProgressMetrics } from '../hooks/useProgressMetrics';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';
import { estimatedCalorieGoal, workoutCaloriesBurned } from '../lib/calories';
import type { TodayWidgetConfig, TodayWidgetProps } from '../widgets/TodayWidget';

const STEPS_GOAL = 10000;

// Week streak and this week's workouts as of `at`.
function weekFields(profile: Parameters<typeof weekProgress>[0], at = new Date()) {
  const week = weekProgress(profile, at);
  return { streak: week.streak, weekCount: week.count, weekGoal: week.goal };
}

let widget: Widget<TodayWidgetProps, TodayWidgetConfig> | null | undefined;
function getWidget() {
  if (widget !== undefined) return widget;
  widget = null;
  if (Platform.OS === 'ios') {
    try {
      // Required lazily: importing it at module load would throw on builds
      // without the native module.
      widget = require('../widgets/TodayWidget').default as Widget<TodayWidgetProps, TodayWidgetConfig>;
    } catch {
      widget = null;
    }
  }
  return widget;
}

function nextMidnight(from: Date, days = 1) {
  const d = new Date(from);
  d.setHours(24 * days, 0, 1, 0);
  return d;
}

export function WidgetSync({ uid }: { uid: string }) {
  const { profile } = useAuth();
  const { isPro } = usePurchases();
  const { logs } = useWorkoutLogs(uid);
  const { metrics } = useProgressMetrics(uid);
  const health = useAppleHealth(uid, isPro);
  const [day, setDay] = useState(todayDateString());
  const { entries } = useFoodLog(isPro ? uid : undefined, day);

  // Coming back to the app: new day, fresh steps.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setDay(todayDateString());
      if (isPro && health.enabled) health.refresh();
    });
    return () => sub.remove();
  }, [isPro, health.enabled, health.refresh]);

  const props = useMemo<TodayWidgetProps | null>(() => {
    if (!profile) return null;
    const todaysLogs = logs.filter((l) => todayDateString(new Date(l.completedAt)) === day);
    const weightLb = metrics.at(-1)?.weightLb ?? profile.startingWeightLb ?? 165;
    const calorieGoal = isPro ? profile.calorieGoal ?? estimatedCalorieGoal(profile, weightLb) : null;
    const burned = todaysLogs.reduce((sum, l) => sum + workoutCaloriesBurned(l, weightLb), 0);
    const eaten = entries.reduce((sum, e) => sum + e.calories, 0);
    const healthConnected = isPro && health.enabled;
    return {
      ...weekFields(profile),
      steps: healthConnected ? health.snapshot?.stepsToday ?? null : null,
      stepsGoal: STEPS_GOAL,
      caloriesLeft: calorieGoal != null ? Math.round(calorieGoal + burned - eaten) : null,
      calorieGoal,
      isPro,
      healthConnected,
      updatedAt: Date.now(),
    };
  }, [profile, logs, metrics, isPro, entries, health.enabled, health.snapshot, day]);

  // Only push when something visible changed (not just updatedAt).
  const key = props ? JSON.stringify({ ...props, updatedAt: 0 }) : '';
  useEffect(() => {
    const w = getWidget();
    if (!w || !props || !profile) return;
    const now = new Date();
    const midnight = nextMidnight(now);
    const dayAfter = nextMidnight(now, 2);
    const freshDay = {
      steps: props.steps == null ? null : 0,
      caloriesLeft: props.calorieGoal,
    };
    try {
      w.updateTimeline([
        { date: now, props },
        { date: midnight, props: { ...props, ...freshDay, ...weekFields(profile, midnight) } },
        { date: dayAfter, props: { ...props, ...freshDay, ...weekFields(profile, dayAfter) } },
      ]);
    } catch {
      // Widget extension missing on this build.
    }
  }, [key]);

  return null;
}
