import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { EXPERIENCE_OPTIONS as LEVELS } from '../../../constants/options';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function ExperienceScreen() {
  const { data, setExperienceLevel } = useOnboarding();

  return (
    <OnboardingScreen
      heading="Almost There!"
      onBack={() => router.back()}
      onNext={() => router.push('/onboarding/avatar')}
      nextDisabled={!data.experienceLevel}
      step={4}
      totalSteps={5}
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
