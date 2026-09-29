import { useAuth } from '../contexts/AuthContext';
import type { UnitSystem } from '../types/models';

// The signed-in user's preferred units (Settings → Units). Lives on the
// profile so it follows them across devices; defaults to imperial.
export function useUnits(): UnitSystem {
  const { profile } = useAuth();
  return profile?.units ?? 'imperial';
}
