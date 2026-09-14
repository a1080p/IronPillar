import React, { createContext, useContext, useState } from 'react';
import type { ExperienceLevel, FitnessGoal, Sex } from '../types/models';

interface OnboardingData {
  name: string;
  birthday: string;
  sex: Sex | null;
  heightInches: number | null;
  startingWeightLb: number | null;
  goals: FitnessGoal[];
  experienceLevel: ExperienceLevel | null;
  avatarKey: string | null;
  avatarPhotoUri: string | null;
}

interface OnboardingContextValue {
  data: OnboardingData;
  setNameBirthday: (name: string, birthday: string) => void;
  setBody: (sex: Sex, heightInches: number, startingWeightLb: number) => void;
  toggleGoal: (goal: FitnessGoal) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  // A picked photo and a preset icon/color key are mutually exclusive —
  // setting one clears the other.
  setAvatarKey: (avatarKey: string) => void;
  setAvatarPhotoUri: (uri: string) => void;
  clearAvatarPhoto: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<OnboardingData>({
    name: '',
    birthday: '',
    sex: null,
    heightInches: null,
    startingWeightLb: null,
    goals: [],
    experienceLevel: null,
    avatarKey: null,
    avatarPhotoUri: null,
  });

  const value: OnboardingContextValue = {
    data,
    setNameBirthday: (name, birthday) => setData((d) => ({ ...d, name, birthday })),
    setBody: (sex, heightInches, startingWeightLb) =>
      setData((d) => ({ ...d, sex, heightInches, startingWeightLb })),
    toggleGoal: (goal) =>
      setData((d) => ({
        ...d,
        goals: d.goals.includes(goal) ? d.goals.filter((g) => g !== goal) : [...d.goals, goal],
      })),
    setExperienceLevel: (experienceLevel) => setData((d) => ({ ...d, experienceLevel })),
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
