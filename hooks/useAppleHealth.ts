import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchHealthSnapshot,
  isHealthKitSupported,
  requestHealthAccess,
  saveWorkoutToHealth,
  type HealthSnapshot,
  type WorkoutForHealth,
} from '../lib/healthkit';

// Whether the user turned on Apple Health sync is a per-device, per-account
// preference (HealthKit permission itself is per-device), so it lives in
// AsyncStorage rather than Firestore.
const prefKey = (uid: string) => `appleHealth:enabled:${uid}`;

export async function isAppleHealthEnabled(uid: string): Promise<boolean> {
  if (!isHealthKitSupported) return false;
  try {
    return (await AsyncStorage.getItem(prefKey(uid))) === '1';
  } catch {
    return false;
  }
}

// Called after a workout completes. Pro-only, opt-in, and best-effort — a
// Health write failure must never interfere with finishing a workout.
export async function syncCompletedWorkoutToHealth(
  uid: string,
  isPro: boolean,
  workout: WorkoutForHealth
) {
  if (!isPro || !(await isAppleHealthEnabled(uid))) return;
  try {
    await saveWorkoutToHealth(workout);
  } catch (e) {
    console.warn('Saving workout to Apple Health failed', e);
  }
}

export function useAppleHealth(uid: string | undefined, active: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isHealthKitSupported) return;
    setLoading(true);
    try {
      setSnapshot(await fetchHealthSnapshot());
    } catch (e) {
      console.warn('Apple Health refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    isAppleHealthEnabled(uid).then((on) => {
      if (cancelled) return;
      setEnabled(on);
      // Only read Health data for Pro users who turned sync on. Reading before
      // requestAuthorization has ever run can crash HealthKit, and the pref is
      // only set after it has.
      if (on && active) refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [uid, active, refresh]);

  const connect = useCallback(async () => {
    if (!uid) return false;
    const ok = await requestHealthAccess();
    if (!ok) return false;
    await AsyncStorage.setItem(prefKey(uid), '1');
    setEnabled(true);
    await refresh();
    return true;
  }, [uid, refresh]);

  const disconnect = useCallback(async () => {
    if (!uid) return;
    await AsyncStorage.removeItem(prefKey(uid));
    setEnabled(false);
    setSnapshot(null);
  }, [uid]);

  return {
    supported: isHealthKitSupported,
    enabled,
    snapshot,
    loading,
    connect,
    disconnect,
    refresh,
  };
}
