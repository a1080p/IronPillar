import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { levelForXp } from '../constants/gamification';
import type { AchievementStats, UserProfile } from '../types/models';

// The signed-in user's current value for each badge metric: lifetime totals
// from the server-written userStats doc, plus streak and level from the
// profile. Totals are missing until the first workout finished on a build
// that records them.
export function useAchievementStats(
  uid: string | undefined,
  profile: UserProfile | null | undefined,
  workoutCount: number
): AchievementStats {
  const [totals, setTotals] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'userStats', uid),
      (snap) => setTotals(snap.exists() ? (snap.data() as Record<string, unknown>) : null),
      () => setTotals(null)
    );
  }, [uid]);

  return useMemo(() => {
    const num = (key: string) => (typeof totals?.[key] === 'number' ? (totals[key] as number) : undefined);
    const stats: AchievementStats = {
      workouts: num('workoutCount') ?? workoutCount,
      streak: Math.max(profile?.longestStreak ?? 0, profile?.streakCount ?? 0),
      level: levelForXp(profile?.xp ?? 0),
    };
    if (totals) {
      stats.prs = num('prCount');
      stats.volumeLb = num('totalVolumeLb');
      stats.distanceMeters = num('totalDistanceMeters');
      stats.singleDistanceMeters = num('maxDistanceMeters');
      stats.seconds = num('totalSeconds');
      stats.singleSeconds = num('maxSeconds');
      stats.early = num('earlyCount');
      stats.late = num('lateCount');
      stats.variety = Array.isArray(totals.workoutIds) ? totals.workoutIds.length : undefined;
    }
    return stats;
  }, [totals, profile?.longestStreak, profile?.streakCount, profile?.xp, workoutCount]);
}
