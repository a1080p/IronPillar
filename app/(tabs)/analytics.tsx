import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { BarChart } from '../../components/BarChart';
import { LineChart } from '../../components/LineChart';
import { StatTile } from '../../components/StatTile';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { useProgressMetrics } from '../../hooks/useProgressMetrics';
import {
  allTimeStats,
  formatDuration,
  formatVolume,
  personalRecords,
  summarizeLog,
  thisWeekVsLast,
  weeklyBuckets,
} from '../../lib/workoutStats';

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function delta(current: number, previous: number, unit: string) {
  const diff = current - previous;
  if (diff === 0) return { hint: `same as last wk`, tone: 'neutral' as const };
  const sign = diff > 0 ? '+' : '−';
  const shown = unit === 'lb' ? formatVolume(Math.abs(diff)) : Math.abs(diff);
  return {
    hint: `${sign}${shown}${unit ? ` ${unit}` : ''} vs last wk`,
    tone: diff > 0 ? ('up' as const) : ('down' as const),
  };
}

export default function AnalyticsScreen() {
  const { user, profile } = useAuth();
  const { logs } = useWorkoutLogs(user?.uid);
  const { metrics, addMetric } = useProgressMetrics(user?.uid);

  const [bmiInput, setBmiInput] = useState('');
  const [bodyFatInput, setBodyFatInput] = useState('');
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => allTimeStats(logs), [logs]);
  const weeks = useMemo(() => weeklyBuckets(logs, 8), [logs]);
  const compare = useMemo(() => thisWeekVsLast(logs), [logs]);
  const prs = useMemo(() => personalRecords(logs, 5), [logs]);
  const recent = useMemo(() => logs.slice(0, 8), [logs]);

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

  const wkWorkouts = delta(compare.thisWeek.workouts, compare.lastWeek.workouts, '');
  const wkVolume = delta(compare.thisWeek.volume, compare.lastWeek.volume, 'lb');
  const wkMinutes = delta(compare.thisWeek.minutes, compare.lastWeek.minutes, 'min');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Progress</Text>
        <Text style={styles.subtitle}>
          {profile?.name ? `${profile.name}, ` : ''}here's how your training is trending
        </Text>

        {logs.length === 0 ? (
          <Text style={styles.note}>
            Finish your first workout and your training stats will show up here.
          </Text>
        ) : (
          <>
            <View style={styles.tileGrid}>
              <StatTile value={stats.workouts} label="Workouts" />
              <StatTile value={`${formatVolume(stats.volume)} lb`} label="Volume lifted" />
              <StatTile value={formatDuration(stats.minutes)} label="Training time" />
              <StatTile value={profile?.streakCount ?? 0} label="Day streak" />
            </View>

            <Text style={styles.sectionLabel}>This week</Text>
            <View style={styles.tileGrid}>
              <StatTile
                value={compare.thisWeek.workouts}
                label="Workouts"
                hint={wkWorkouts.hint}
                hintTone={wkWorkouts.tone}
              />
              <StatTile
                value={`${formatVolume(compare.thisWeek.volume)} lb`}
                label="Volume"
                hint={wkVolume.hint}
                hintTone={wkVolume.tone}
              />
              <StatTile
                value={formatDuration(compare.thisWeek.minutes)}
                label="Time"
                hint={wkMinutes.hint}
                hintTone={wkMinutes.tone}
              />
            </View>

            <BarChart
              title="Workouts per week"
              points={weeks.map((w) => ({ label: w.label, value: w.workouts }))}
            />
            <BarChart
              title="Weekly volume (lb)"
              points={weeks.map((w) => ({ label: w.label, value: w.volume }))}
              formatValue={(v) => (v > 0 ? formatVolume(v) : '')}
            />

            {prs.length > 0 && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Personal records</Text>
                {prs.map((pr) => (
                  <View key={pr.exerciseName} style={styles.prRow}>
                    <Text style={styles.prName} numberOfLines={1}>
                      {pr.exerciseName}
                    </Text>
                    <Text style={styles.prDetail}>
                      {pr.weight} lb × {pr.reps}
                      <Text style={styles.prMuted}>  ·  ~{pr.estimatedOneRepMax} lb 1RM</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Recent workouts</Text>
              {recent.map((log) => {
                const s = summarizeLog(log);
                return (
                  <View key={log.id} style={styles.logRow}>
                    <View style={styles.logRowTop}>
                      <Text style={styles.logName} numberOfLines={1}>
                        {log.workoutName}
                      </Text>
                      <Text style={styles.logDate}>{formatShortDate(log.completedAt)}</Text>
                    </View>
                    <View style={styles.chips}>
                      <Chip text={`${s.minutes}m`} />
                      {s.volume > 0 && <Chip text={`${formatVolume(s.volume)} lb`} />}
                      {s.reps > 0 && <Chip text={`${s.reps} reps`} />}
                      <Chip text={`${s.sets} sets`} />
                      <Chip text={`+${log.xpEarned} xp`} />
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Body measurements</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: { color: colors.textMuted, marginBottom: spacing.lg },
  note: { color: colors.textMuted, marginBottom: spacing.lg },
  sectionLabel: {
    fontWeight: '700',
    color: colors.primary,
    fontSize: typography.sizes.md,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  panel: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  panelTitle: { fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  prRow: { marginBottom: spacing.md },
  prName: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.small },
  prDetail: { color: colors.text, fontSize: typography.sizes.small, marginTop: 2 },
  prMuted: { color: colors.textMuted },
  logRow: {
    borderTopWidth: 1,
    borderTopColor: colors.background,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  logRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  logName: { flex: 1, fontWeight: '700', color: colors.primary, fontSize: typography.sizes.small },
  logDate: { color: colors.textMuted, fontSize: typography.sizes.small },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  chipText: { fontSize: 11, color: colors.text, fontWeight: '600' },
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
});
