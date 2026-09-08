import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { TextField } from '../../../components/TextField';
import { SEX_OPTIONS } from '../../../constants/options';
import { colors, spacing, typography } from '../../../constants/theme';
import { useOnboarding } from '../../../contexts/OnboardingContext';

export default function BodyScreen() {
  const { data, setBody } = useOnboarding();
  const [sex, setSex] = useState(data.sex);
  const [feet, setFeet] = useState(
    data.heightInches ? String(Math.floor(data.heightInches / 12)) : ''
  );
  const [inches, setInches] = useState(
    data.heightInches ? String(data.heightInches % 12) : ''
  );
  const [weight, setWeight] = useState(
    data.startingWeightLb ? String(data.startingWeightLb) : ''
  );

  const feetNum = Number(feet);
  const inchesNum = Number(inches);
  const weightNum = Number(weight);
  const heightInches = feetNum * 12 + inchesNum;

  const canContinue =
    !!sex &&
    feetNum >= 4 &&
    feetNum <= 8 &&
    inchesNum >= 0 &&
    inchesNum <= 11 &&
    weightNum >= 60 &&
    weightNum <= 1000;

  const handleNext = () => {
    if (!sex) return;
    setBody(sex, heightInches, Math.round(weightNum));
    router.push('/onboarding/goals');
  };

  return (
    <OnboardingScreen
      heading="A Few Numbers to Start"
      onBack={() => router.back()}
      onNext={handleNext}
      nextDisabled={!canContinue}
    >
      <Text style={styles.groupLabel}>Sex</Text>
      {SEX_OPTIONS.map((option) => (
        <SelectableOption
          key={option.value}
          label={option.label}
          selected={sex === option.value}
          onPress={() => setSex(option.value)}
        />
      ))}
      <Text style={styles.helper}>Used to estimate calories and tailor your stats.</Text>

      <View style={styles.row}>
        <View style={styles.rowItem}>
          <TextField
            label="Height (ft)"
            value={feet}
            onChangeText={setFeet}
            placeholder="5"
            keyboardType="number-pad"
            maxLength={1}
          />
        </View>
        <View style={styles.rowItem}>
          <TextField
            label="Height (in)"
            value={inches}
            onChangeText={setInches}
            placeholder="10"
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>

      <TextField
        label="Starting Weight (lb)"
        value={weight}
        onChangeText={setWeight}
        placeholder="165"
        keyboardType="number-pad"
        maxLength={4}
      />
      <Text style={styles.helper}>
        We'll track your weight over time on the Progress tab — you can log it whenever you like.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },
});
