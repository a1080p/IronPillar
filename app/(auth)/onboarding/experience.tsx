import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { EXPERIENCE_OPTIONS as LEVELS } from '../../../constants/options';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function ExperienceScreen() {
  const { data, setExperienceLevel } = useOnboarding();
  const { createProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    if (!data.experienceLevel) return;
    setSaving(true);
    try {
      await createProfile({
        name: data.name,
        birthday: data.birthday,
        goals: data.goals,
        experienceLevel: data.experienceLevel,
      });
      // Root layout's auth guard redirects to the tabs home once the
      // profile document exists.
    } catch (e) {
      Alert.alert('Could not save your profile', e instanceof Error ? e.message : 'Try again.');
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      heading="Almost There!"
      onBack={() => router.back()}
      onNext={handleFinish}
      nextLabel={saving ? 'Saving...' : 'Next'}
      nextDisabled={!data.experienceLevel || saving}
    >
      {LEVELS.map((level) => (
        <SelectableOption
          key={level.value}
          label={level.label}
          selected={data.experienceLevel === level.value}
          onPress={() => setExperienceLevel(level.value)}
        />
      ))}
    </OnboardingScreen>
  );
}
