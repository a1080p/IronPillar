import React, { createContext, useContext, useState } from 'react';
import type { ExperienceLevel, FitnessGoal } from '../types/models';

interface OnboardingData {
  name: string;
  birthday: string;
  goals: FitnessGoal[];
  experienceLevel: ExperienceLevel | null;
}

interface OnboardingContextValue {
  data: OnboardingData;
  setNameBirthday: (name: string, birthday: string) => void;
  toggleGoal: (goal: FitnessGoal) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>({
    name: '',
    birthday: '',
    goals: [],
    experienceLevel: null,
  });

  const value: OnboardingContextValue = {
    data,
    setNameBirthday: (name, birthday) => setData((d) => ({ ...d, name, birthday })),
    toggleGoal: (goal) =>
      setData((d) => ({
        ...d,
        goals: d.goals.includes(goal) ? d.goals.filter((g) => g !== goal) : [...d.goals, goal],
      })),
    setExperienceLevel: (experienceLevel) => setData((d) => ({ ...d, experienceLevel })),
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
