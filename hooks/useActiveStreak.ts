import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { activeStreak } from '../constants/gamification';
import { useAuth } from '../contexts/AuthContext';

// The signed-in user's current streak, dropping to 0 at local midnight after
// a day without a qualifying workout — while the app is open (a timer for
// midnight) or when it comes back to the foreground.
export function useActiveStreak(): number {
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

  return activeStreak(profile, now);
}
