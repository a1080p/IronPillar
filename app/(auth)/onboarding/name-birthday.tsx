import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { TextField } from '../../../components/TextField';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { ageFromBirthday as ageFrom, formatBirthdayInput, MIN_AGE } from '../../../lib/dates';
import { containsBlockedTerm } from '../../../constants/moderation';

export default function NameBirthdayScreen() {
  const { data, setNameBirthday } = useOnboarding();
  const { colors } = useTheme();
  const [name, setName] = useState(data.name);
  const [birthday, setBirthday] = useState(data.birthday);
  // An Apple/Google name can arrive just after this screen opens.
  useEffect(() => {
    if (data.name) setName((current) => current || data.name);
  }, [data.name]);

  const age = ageFrom(birthday);
  const nameBlocked = containsBlockedTerm(name);
  const tooYoung = age != null && age < MIN_AGE;
  const canContinue = name.trim().length > 0 && !nameBlocked && age != null && !tooYoung;
  const message = nameBlocked
    ? 'Please choose a different name.'
    : birthday.length === 10 && age == null
      ? 'Enter a real date as MM-DD-YYYY.'
      : tooYoung
        ? 'You need to be at least 13 to use Iron Pillar.'
        : null;

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
      totalSteps={5}
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
      {message && (
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </OnboardingScreen>
  );
}
