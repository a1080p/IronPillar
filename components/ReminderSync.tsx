import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase/config';
import { cancelPendingGymReminders, syncGymGeofences } from '../lib/gymReminders';
import {
  maybeAskNotificationPermissionOnce,
  rescheduleWorkoutReminders,
  workedOutToday,
} from '../lib/reminders';
import {
  loadReminderSettings,
  subscribeReminderSettings,
  type ReminderSettings,
} from '../lib/reminderSettings';
import { PATTERN_LOOKBACK_DAYS } from '../lib/workoutPatterns';
import type { WorkoutLog } from '../types/models';

// Renders nothing — keeps scheduled reminders and gym geofences in step with
// the signed-in user's workout history and reminder settings. The logs
// listener is what makes "only if you haven't worked out today" work: a
// completion (on this device or any other) lands here and today's remaining
// reminders are dropped.
export function ReminderSync({ uid }: { uid: string }) {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<WorkoutLog[] | null>(null);
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [permissionReady, setPermissionReady] = useState(false);
  const [foregroundTick, setForegroundTick] = useState(0);

  useEffect(() => {
    // Only the lookback window matters for patterns and "today", so don't
    // stream someone's entire history just to schedule reminders.
    const since = new Date(Date.now() - PATTERN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const q = query(
      collection(db, 'workoutLogs', uid, 'logs'),
      where('completedAt', '>=', since),
      orderBy('completedAt', 'desc')
    );
    return onSnapshot(
      q,
      (snap) => setLogs(snap.docs.map((d) => d.data() as WorkoutLog)),
      () => {}
    );
  }, [uid]);

  useEffect(() => {
    loadReminderSettings().then(setSettings);
    return subscribeReminderSettings(setSettings);
  }, []);

  useEffect(() => {
    maybeAskNotificationPermissionOnce()
      .catch(() => false)
      .finally(() => setPermissionReady(true));
  }, []);

  // The schedule only covers the next week, so roll it forward (and pick up
  // a new "today") whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  // Only the fields the reminder copy and counts depend on, so unrelated
  // profile writes don't reschedule everything.
  const nudgeProfile = profile
    ? {
        xp: profile.xp,
        timeZone: profile.timeZone,
        weeklyGoal: profile.weeklyGoal,
        weekStart: profile.weekStart,
        weekCount: profile.weekCount,
        weekGoal: profile.weekGoal,
        streakCount: profile.streakCount,
        lastGoalWeek: profile.lastGoalWeek,
      }
    : null;
  const nudgeKey = JSON.stringify(nudgeProfile);

  useEffect(() => {
    if (!logs || !settings || !permissionReady) return;
    rescheduleWorkoutReminders(logs, settings, nudgeProfile);
    if (workedOutToday(logs)) cancelPendingGymReminders();
  }, [logs, settings, permissionReady, foregroundTick, nudgeKey]);

  useEffect(() => {
    if (settings) syncGymGeofences(settings);
  }, [settings]);

  // Reminders open the app to Home, where the day's workout is one tap away.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
  }, [lastResponse]);

  return null;
}
