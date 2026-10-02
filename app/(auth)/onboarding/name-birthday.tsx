import { useState } from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { TextField } from '../../../components/TextField';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { formatBirthdayInput } from '../../../lib/dates';
import { containsBlockedTerm } from '../../../constants/moderation';

// Age in whole years from an MM-DD-YYYY birthday, or null if it isn't a real date.
function ageFrom(birthday: string): number | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(birthday);
  if (!m) return null;
  const [month, day, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day || date > new Date()) return null;
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() < month - 1 || (now.getMonth() === month - 1 && now.getDate() < day)) age--;
  return age;
}

const MIN_AGE = 13;

export default function NameBirthdayScreen() {
  const { data, setNameBirthday } = useOnboarding();
  const { colors } = useTheme();
  const [name, setName] = useState(data.name);
  const [birthday, setBirthday] = useState(data.birthday);

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
      {message && (
        <Text style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </OnboardingScreen>
  );
}
