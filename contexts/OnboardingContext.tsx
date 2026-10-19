import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Barrier, ExperienceLevel, Sex, UnitSystem } from '../types/models';
import { defaultUnitsForDevice } from '../lib/units';
import { useAuth } from './AuthContext';

interface OnboardingData {
  name: string;
  birthday: string;
  sex: Sex | null;
  heightInches: number | null;
  startingWeightLb: number | null;
  units: UnitSystem;
  goalText: string;
  experienceLevel: ExperienceLevel | null;
  barrier: Barrier | null;
  barrierOther: string;
  weeklyGoal: number;
  avatarKey: string | null;
  avatarPhotoUri: string | null;
}

interface OnboardingContextValue {
  data: OnboardingData;
  setNameBirthday: (name: string, birthday: string) => void;
  setBody: (sex: Sex, heightInches: number, startingWeightLb: number, units: UnitSystem) => void;
  setGoal: (goalText: string, experienceLevel: ExperienceLevel) => void;
  setBarrier: (barrier: Barrier, barrierOther: string) => void;
  setWeeklyGoal: (weeklyGoal: number) => void;
  // A picked photo and a preset icon/color key are mutually exclusive —
  // setting one clears the other.
  setAvatarKey: (avatarKey: string) => void;
  setAvatarPhotoUri: (uri: string) => void;
  clearAvatarPhoto: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { signInName } = useAuth();
  const [data, setData] = useState<OnboardingData>({
    // Apple and Google sign-ups usually come with a name; start from it.
    name: signInName ?? '',
    birthday: '',
    sex: null,
    heightInches: null,
    startingWeightLb: null,
    units: defaultUnitsForDevice(),
    goalText: '',
    experienceLevel: null,
    barrier: null,
    barrierOther: '',
    weeklyGoal: 3,
    avatarKey: null,
    avatarPhotoUri: null,
  });

  // The name can land just after onboarding opens; fill it in if the field
  // is still empty.
  useEffect(() => {
    if (signInName) setData((d) => (d.name ? d : { ...d, name: signInName }));
  }, [signInName]);

  const value: OnboardingContextValue = {
    data,
    setNameBirthday: (name, birthday) => setData((d) => ({ ...d, name, birthday })),
    setBody: (sex, heightInches, startingWeightLb, units) =>
      setData((d) => ({ ...d, sex, heightInches, startingWeightLb, units })),
    setGoal: (goalText, experienceLevel) =>
      setData((d) => ({ ...d, goalText, experienceLevel })),
    setBarrier: (barrier, barrierOther) => setData((d) => ({ ...d, barrier, barrierOther })),
    setWeeklyGoal: (weeklyGoal) => setData((d) => ({ ...d, weeklyGoal })),
    setAvatarKey: (avatarKey) => setData((d) => ({ ...d, avatarKey, avatarPhotoUri: null })),
    setAvatarPhotoUri: (avatarPhotoUri) => setData((d) => ({ ...d, avatarPhotoUri, avatarKey: null })),
    clearAvatarPhoto: () => setData((d) => ({ ...d, avatarPhotoUri: null })),
  };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
