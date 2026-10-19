import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { weekProgress, type WeekProgress } from '../constants/gamification';
import { useAuth } from '../contexts/AuthContext';

// The signed-in user's week streak and this week's progress toward their
// weekly goal, rechecked at local midnight while the app is open (the week
// rolls over at Monday midnight) and when it comes back to the foreground.
export function useWeekProgress(): WeekProgress {
  const { profile } = useAuth();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const midnight = new Date(now);
    midnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(() => setNow(new Date()), midnight.getTime() - now.getTime());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [now]);

  return weekProgress(profile, now);
}

// Just the week streak.
export function useActiveStreak(): number {
  return useWeekProgress().streak;
}
