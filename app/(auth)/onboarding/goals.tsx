import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { GOAL_OPTIONS as GOALS } from '../../../constants/options';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function GoalsScreen() {
  const { data, toggleGoal } = useOnboarding();

  return (
    <OnboardingScreen
      heading={`It's Nice to Meet You, ${data.name || 'there'}!`}
      onBack={() => router.back()}
      onNext={() => router.push('/onboarding/experience')}
      nextDisabled={data.goals.length === 0}
    >
      {GOALS.map((goal) => (
        <SelectableOption
          key={goal.value}
          label={goal.label}
          selected={data.goals.includes(goal.value)}
          onPress={() => toggleGoal(goal.value)}
        />
      ))}
    </OnboardingScreen>
  );
}
