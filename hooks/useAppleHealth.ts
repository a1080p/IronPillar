import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchHealthSnapshot,
  fetchStepsSnapshot,
  isHealthKitSupported,
  requestHealthAccess,
  saveWorkoutToHealth,
  type HealthScope,
  type HealthSnapshot,
  type WorkoutForHealth,
} from '../lib/healthkit';

// Whether the user turned on Apple Health sync is a per-device, per-account
// preference (HealthKit permission itself is per-device), so it lives in
// AsyncStorage rather than Firestore. The value is the scope permission was
// asked for: 'steps' (free) or '1' (full; the value older builds stored).
const prefKey = (uid: string) => `appleHealth:enabled:${uid}`;

async function grantedScope(uid: string): Promise<HealthScope | null> {
  if (!isHealthKitSupported) return null;
  try {
    const v = await AsyncStorage.getItem(prefKey(uid));
    return v === '1' ? 'full' : v === 'steps' ? 'steps' : null;
  } catch {
    return null;
  }
}

// Called after a workout completes. Pro-only, opt-in, and best-effort — a
// Health write failure must never interfere with finishing a workout.
export async function syncCompletedWorkoutToHealth(
  uid: string,
  isPro: boolean,
  workout: WorkoutForHealth
) {
  if (!isPro || (await grantedScope(uid)) !== 'full') return;
  try {
    await saveWorkoutToHealth(workout);
  } catch (e) {
    console.warn('Saving workout to Apple Health failed', e);
  }
}

// Free users read steps only; Pro reads everything it was granted. A Pro user
// who connected while free has `needsFullAccess` until they allow the rest.
export function useAppleHealth(uid: string | undefined, isPro: boolean) {
  const [scope, setScope] = useState<HealthScope | null>(null);
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const readScope: HealthScope | null = scope === 'full' && isPro ? 'full' : scope ? 'steps' : null;

  const read = useCallback(async (s: HealthScope | null) => {
    if (!isHealthKitSupported || !s) return;
    setLoading(true);
    try {
      setSnapshot(await (s === 'full' ? fetchHealthSnapshot() : fetchStepsSnapshot()));
    } catch (e) {
      console.warn('Apple Health refresh failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => read(readScope), [read, readScope]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // Never read before requestAuthorization has run for that scope (it can
    // crash HealthKit); the pref is only set after it has.
    grantedScope(uid).then((s) => {
      if (!cancelled) setScope(s);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    read(readScope);
  }, [read, readScope]);

  const connect = useCallback(async () => {
    if (!uid) return false;
    const want: HealthScope = isPro ? 'full' : 'steps';
    const ok = await requestHealthAccess(want);
    if (!ok) return false;
    await AsyncStorage.setItem(prefKey(uid), want === 'full' ? '1' : 'steps');
    setScope(want);
    return true;
  }, [uid, isPro]);

  const disconnect = useCallback(async () => {
    if (!uid) return;
    await AsyncStorage.removeItem(prefKey(uid));
    setScope(null);
    setSnapshot(null);
  }, [uid]);

  return {
    supported: isHealthKitSupported,
    enabled: scope != null,
    needsFullAccess: isPro && scope === 'steps',
    snapshot,
    loading,
    connect,
    disconnect,
    refresh,
  };
}
