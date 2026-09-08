import { useState } from 'react';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { TextField } from '../../../components/TextField';
import { useOnboarding } from '../../../contexts/OnboardingContext';

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
    <OnboardingScreen heading="Let's Get to Know You" onNext={handleNext} nextDisabled={!canContinue}>
      <TextField
        label="What Should We Call You?"
        value={name}
        onChangeText={setName}
        placeholder="Name"
      />
      <TextField
        label="What's Your Birthday?"
        value={birthday}
        onChangeText={setBirthday}
        placeholder="MM-DD-YYYY"
        keyboardType="numbers-and-punctuation"
      />
    </OnboardingScreen>
  );
}
