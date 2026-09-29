import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { SelectableOption } from '../../../components/SelectableOption';
import { TextField } from '../../../components/TextField';
import { SEX_OPTIONS } from '../../../constants/options';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { CM_PER_INCH, displayToLb, lbToDisplay } from '../../../lib/units';
import type { UnitSystem } from '../../../types/models';

export default function BodyScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data, setBody } = useOnboarding();
  const [sex, setSex] = useState(data.sex);
  const [units, setUnits] = useState<UnitSystem>(data.units);
  const metric = units === 'metric';

  // Inputs are kept in whichever unit is showing; stored values are always
  // inches + pounds.
  const [feet, setFeet] = useState(
    data.heightInches ? String(Math.floor(Math.round(data.heightInches) / 12)) : ''
  );
  const [inches, setInches] = useState(
    data.heightInches ? String(Math.round(data.heightInches) % 12) : ''
  );
  const [cm, setCm] = useState(
    data.heightInches ? String(Math.round(data.heightInches * CM_PER_INCH)) : ''
  );
  const [weight, setWeight] = useState(
    data.startingWeightLb ? String(lbToDisplay(data.startingWeightLb, data.units)) : ''
  );

  const feetNum = Number(feet);
  const inchesNum = Number(inches);
  const cmNum = Number(cm);
  const weightNum = Number(weight.replace(',', '.'));

  const heightInches = metric
    ? Math.round((cmNum / CM_PER_INCH) * 10) / 10
    : feetNum * 12 + inchesNum;
  const weightLb = displayToLb(weightNum, units);

  const heightValid = metric
    ? cmNum >= 120 && cmNum <= 250
    : feetNum >= 4 && feetNum <= 8 && inchesNum >= 0 && inchesNum <= 11;
  const canContinue = !!sex && heightValid && weightLb >= 60 && weightLb <= 1000;

  // Switching units converts whatever was already typed, so nothing is lost.
  const switchUnits = (next: UnitSystem) => {
    if (next === units) return;
    if (next === 'metric') {
      if (feet || inches) setCm(String(Math.round((feetNum * 12 + inchesNum) * CM_PER_INCH)));
    } else if (cm) {
      const totalIn = Math.round(cmNum / CM_PER_INCH);
      setFeet(String(Math.floor(totalIn / 12)));
      setInches(String(totalIn % 12));
    }
    if (weight) setWeight(String(lbToDisplay(displayToLb(weightNum, units), next)));
    setUnits(next);
  };

  const handleNext = () => {
    if (!sex) return;
    setBody(sex, heightInches, Math.round(weightLb * 10) / 10, units);
    router.push('/onboarding/goals');
  };

  return (
    <OnboardingScreen
      heading="A Few Numbers to Start"
      onBack={() => router.back()}
      onNext={handleNext}
      nextDisabled={!canContinue}
      step={2}
      totalSteps={4}
    >
      <Text style={styles.groupLabel}>Units</Text>
      <View style={styles.segment} accessibilityRole="radiogroup">
        {(['imperial', 'metric'] as const).map((option) => {
          const active = units === option;
          return (
            <Pressable
              key={option}
              onPress={() => switchUnits(option)}
              style={[styles.segmentOption, active && styles.segmentOptionActive]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {option === 'metric' ? 'Metric (cm, kg, km)' : 'Imperial (ft, lb, mi)'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.helper}>You can change this anytime in Settings.</Text>

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

      {metric ? (
        <TextField
          label="Height (cm)"
          value={cm}
          onChangeText={setCm}
          placeholder="178"
          keyboardType="number-pad"
          maxLength={3}
        />
      ) : (
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
      )}

      <TextField
        label={`Starting Weight (${metric ? 'kg' : 'lb'})`}
        value={weight}
        onChangeText={setWeight}
        placeholder={metric ? '75' : '165'}
        keyboardType="decimal-pad"
        maxLength={5}
      />
      <Text style={styles.helper}>
        We'll track your weight over time on the Progress tab — you can log it whenever you like.
      </Text>
    </OnboardingScreen>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    padding: 3,
  },
  segmentOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
  },
  segmentOptionActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.text, fontWeight: '700', fontSize: typography.sizes.small },
  segmentTextActive: { color: colors.textOnDark },
  rowItem: { flex: 1 },
});
