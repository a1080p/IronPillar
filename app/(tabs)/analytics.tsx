import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { LineChart } from '../../components/LineChart';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { useProgressMetrics } from '../../hooks/useProgressMetrics';

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function AnalyticsScreen() {
  const { user, profile } = useAuth();
  const { logs } = useWorkoutLogs(user?.uid);
  const { metrics, addMetric } = useProgressMetrics(user?.uid);

  const [bmiInput, setBmiInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [saving, setSaving] = useState(false);

  const bmiPoints = metrics.map((m) => ({ label: formatShortDate(m.recordedAt), value: m.bmi }));
  const bodyFatPoints = metrics.map((m) => ({
    label: formatShortDate(m.recordedAt),
    value: m.bodyFatPercent,
  }));

  const handleAdd = async () => {
    const bmi = Number(bmiInput);
    const bodyFat = Number(bodyFatInput);
    if (!bmi || !bodyFat || !user) {
      Alert.alert('Enter both values', 'Add a BMI and body fat % to save an entry.');
      return;
    }
    setSaving(true);
    try {
      await addMetric(user.uid, bmi, bodyFat);
      setBmiInput('');
      setBodyFatInput('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Progress</Text>
        <Text style={styles.subtitle}>
          {profile?.name ? `${profile.name}, ` : ''}You've been making great progress! Keep it going
        </Text>

        <LineChart title="BMI (kg/m²)" points={bmiPoints} />
        <LineChart title="Percent Body Fat (%)" points={bodyFatPoints} unit="%" />

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Add an entry</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="BMI"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={bmiInput}
              onChangeText={setBmiInput}
            />
            <TextInput
              style={styles.input}
              placeholder="Body fat %"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              value={bodyFatInput}
              onChangeText={setBodyFatInput}
            />
          </View>
          <Button label="Save Entry" onPress={handleAdd} loading={saving} />
        </View>

        <Text style={styles.totalWorkouts}>Total workouts completed: {logs.length}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  subtitle: { textAlign: 'center', color: colors.primary, marginBottom: spacing.lg },
  addCard: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  addTitle: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.text,
  },
  totalWorkouts: { textAlign: 'center', color: colors.primary, fontWeight: '600' },
});
