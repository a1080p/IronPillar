import { useState } from 'react';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { TextField } from '../../../components/TextField';
import { useOnboarding } from '../../../contexts/OnboardingContext';

// Auto-inserts dashes as digits come in, so typing "05102004" fills the
// field as "05-10-2004" without the user typing the dashes themselves.
function formatBirthdayInput(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('-');
}

export default function NameBirthdayScreen() {
  const { data, setNameBirthday } = useOnboarding();
  const [name, setName] = useState(data.name);
  const [birthday, setBirthday] = useState(data.birthday);

  const canContinue = name.trim().length > 0 && /^\d{2}-\d{2}-\d{4}$/.test(birthday);

  const handleNext = () => {
    setNameBirthday(name.trim(), birthday);
    router.push('/onboarding/body');
  };

  return (
    <OnboardingScreen
      heading="Let's Get to Know You"
      onNext={handleNext}
      nextDisabled={!canContinue}
      step={1}
      totalSteps={4}
    >
      <TextField
        label="What Should We Call You?"
        value={name}
        onChangeText={setName}
        placeholder="Name"
      />
      <TextField
        label="What's Your Birthday?"
        value={birthday}
        onChangeText={(text) => setBirthday(formatBirthdayInput(text))}
        placeholder="MM-DD-YYYY"
        keyboardType="number-pad"
        maxLength={10}
      />
    </OnboardingScreen>
  );
}
