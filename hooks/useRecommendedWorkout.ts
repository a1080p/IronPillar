import { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayDateString } from '../constants/gamification';
import { pickRecommendedWorkout } from '../lib/recommendations';
import type { UserProfile, WorkoutLog, WorkoutTemplate } from '../types/models';

// The last pick shown, and the one shown on the day before it, so a relaunch
// later the same day still knows what to avoid.
interface ShownPick {
  date: string; // yyyy-mm-dd, local
  id: string;
  previousId?: string;
}

const storageKey = (uid: string) => `recommendation.lastShown.${uid}`;

// The home screen's Recommended workout. Remembers (on this device) which
// workout was shown, so the next day's pick is never the same one again.
export function useRecommendedWorkout(
  templates: WorkoutTemplate[],
  logs: WorkoutLog[],
  profile: UserProfile | null,
  uid: string | undefined
): { recommended: WorkoutTemplate | undefined; ready: boolean } {
  const [stored, setStored] = useState<ShownPick | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) return;
    setReady(false);
    AsyncStorage.getItem(storageKey(uid))
      .catch(() => null)
      .then((raw) => {
        try {
          setStored(raw ? (JSON.parse(raw) as ShownPick) : null);
        } catch {
          setStored(null);
        }
        setReady(true);
      });
  }, [uid]);

  const today = todayDateString();
  // The pick from the most recent earlier day is the one to avoid today.
  const excludeId = stored ? (stored.date === today ? stored.previousId : stored.id) : undefined;

  const recommended = useMemo(
    () => (ready ? pickRecommendedWorkout(templates, logs, profile, uid, excludeId) : undefined),
    [ready, templates, logs, profile, uid, excludeId]
  );

  useEffect(() => {
    if (!uid || !ready || !recommended) return;
    if (stored?.date === today && stored.id === recommended.id) return;
    const next: ShownPick = { date: today, id: recommended.id, previousId: excludeId };
    setStored(next);
    AsyncStorage.setItem(storageKey(uid), JSON.stringify(next)).catch(() => {});
  }, [uid, ready, recommended?.id, today]);

  return { recommended, ready };
}
