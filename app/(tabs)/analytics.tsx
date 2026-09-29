import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ProBadge, ProLockCard } from '../../components/ProLock';
import { useAppleHealth } from '../../hooks/useAppleHealth';
import { exportWorkoutsCsv } from '../../lib/export';
import {
  displayToLb,
  distanceUnit,
  formatVolume as formatVolumeIn,
  lbToDisplay,
  metersToDistance,
  weightUnit,
} from '../../lib/units';
import { useUnits } from '../../hooks/useUnits';
import type { UnitSystem } from '../../types/models';
import { usePurchases } from '../../contexts/PurchasesContext';
import { activeDays, activityCalendar } from '../../lib/insights';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TopBar } from '../../components/TopBar';
import { Button } from '../../components/Button';
import { BarChart } from '../../components/BarChart';
import { LineChart } from '../../components/LineChart';
import { StatTile } from '../../components/StatTile';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { useProgressMetrics } from '../../hooks/useProgressMetrics';
import {
  allTimeStats,
  bmiFrom,
  formatDuration,
  personalRecords,
  strengthTrend,
  summarizeLog,
  thisWeekVsLast,
  weeklyBuckets,
} from '../../lib/workoutStats';

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function delta(current: number, previous: number, unit: string, units?: UnitSystem) {
  const diff = current - previous;
  if (diff === 0) return { hint: `same as last wk`, tone: 'neutral' as const };
  const sign = diff > 0 ? '+' : '−';
  // `unit === 'volume'`: diff is in stored pounds; show it in the user's unit.
  const shown =
    unit === 'volume' ? formatVolumeIn(Math.abs(diff), units ?? 'imperial') : `${Math.abs(diff)}${unit ? ` ${unit}` : ''}`;
  return {
    hint: `${sign}${shown} vs last wk`,
    tone: diff > 0 ? ('up' as const) : ('down' as const),
  };
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile } = useAuth();
  const { logs } = useWorkoutLogs(user?.uid);
  const { metrics, addMetric } = useProgressMetrics(user?.uid);

  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);

  const stats = useMemo(() => allTimeStats(logs), [logs]);
  const weeks = useMemo(() => weeklyBuckets(logs, 8), [logs]);
  const compare = useMemo(() => thisWeekVsLast(logs), [logs]);
  const prs = useMemo(() => personalRecords(logs, 5), [logs]);
  const recent = useMemo(() => logs.slice(0, 8), [logs]);
  const strengthPoints = useMemo(() => strengthTrend(logs, 10), [logs]);
  const calendar = useMemo(() => activityCalendar(logs, 12), [logs]);
  const daysActive = useMemo(() => activeDays(logs, 30), [logs]);
  const { isPro } = usePurchases();
  const units = useUnits();
  const wUnit = weightUnit(units);
  const health = useAppleHealth(user?.uid, isPro);
  const [exporting, setExporting] = useState(false);

  // Best streak ever: the server tracks it now (longestStreak), but older
  // accounts predate that, so also take the best from their logs.
  const highestStreak = useMemo(
    () =>
      Math.max(
        profile?.longestStreak ?? 0,
        profile?.streakCount ?? 0,
        ...logs.map((l) => l.streakCountAfter ?? 0)
      ),
    [profile?.longestStreak, profile?.streakCount, logs]
  );
  const totalDistance = useMemo(
    () => metersToDistance(logs.reduce((sum, l) => sum + (l.distanceMeters ?? 0), 0), units),
    [logs, units]
  );

  const handleExport = async () => {
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    if (logs.length === 0) {
      Alert.alert('Nothing to export yet', 'Finish a workout first.');
      return;
    }
    setExporting(true);
    try {
      await exportWorkoutsCsv(logs, units);
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setExporting(false);
    }
  };

  // Weight line = the starting weight from onboarding, then every logged entry.
  const weightPoints = useMemo(() => {
    const points: { label: string; value: number }[] = [];
    if (profile?.startingWeightLb && profile.createdAt) {
      points.push({ label: formatShortDate(profile.createdAt), value: profile.startingWeightLb });
    }
    for (const m of metrics) {
      points.push({ label: formatShortDate(m.recordedAt), value: m.weightLb });
    }
    return points;
  }, [profile?.startingWeightLb, profile?.createdAt, metrics]);

  const currentWeight = weightPoints.length ? weightPoints[weightPoints.length - 1].value : null;
  const weightChange =
    currentWeight != null && profile?.startingWeightLb != null
      ? currentWeight - profile.startingWeightLb
      : null;
  const bmi =
    currentWeight != null && profile?.heightInches != null
      ? bmiFrom(currentWeight, profile.heightInches)
      : null;

  const handleAdd = async () => {
    // Typed in the user's unit; stored in pounds (to 0.1 so kg entries
    // round-trip cleanly).
    const typed = Number(weightInput.replace(',', '.'));
    const weightLb = displayToLb(typed, units);
    if (!typed || weightLb < 60 || weightLb > 1000 || !user) {
      Alert.alert(
        'Enter your weight',
        `Add your current weight in ${units === 'metric' ? 'kilograms' : 'pounds'} to save an entry.`
      );
      return;
    }
    setSaving(true);
    try {
      await addMetric(user.uid, Math.round(weightLb * 10) / 10);
      setWeightInput('');
    } finally {
      setSaving(false);
    }
  };

  const wkWorkouts = delta(compare.thisWeek.workouts, compare.lastWeek.workouts, '');
  const wkVolume = delta(compare.thisWeek.volume, compare.lastWeek.volume, 'volume', units);
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
              <StatTile value={formatVolumeIn(stats.volume, units)} label="Volume lifted" />
              <StatTile
                value={`${totalDistance >= 100 ? Math.round(totalDistance) : totalDistance.toFixed(1)} ${distanceUnit(units)}`}
                label="Distance traveled"
              />
              <StatTile value={formatDuration(stats.minutes)} label="Training time" />
              <StatTile value={highestStreak} label="Highest streak" />
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
                value={formatVolumeIn(compare.thisWeek.volume, units)}
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

            <View style={styles.panel}>
              <View style={styles.calendarHeader}>
                <Text style={styles.panelTitle}>Consistency</Text>
                <Text style={styles.calendarMeta}>{daysActive} of last 30 days</Text>
              </View>
              <View style={styles.calendarGrid}>
                {calendar.map((week, w) => (
                  <View key={w} style={styles.calendarColumn}>
                    {week.map((day) => (
                      <View
                        key={day.date.toISOString()}
                        style={[
                          styles.calendarCell,
                          day.isFuture
                            ? styles.calendarFuture
                            : day.count > 1
                              ? styles.calendarHot
                              : day.count === 1
                                ? styles.calendarOn
                                : null,
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>

            <BarChart
              title="Workouts per week"
              points={weeks.map((w) => ({ label: w.label, value: w.workouts }))}
            />
            <LineChart
              title={`Strength trend (est. 1RM, ${wUnit})`}
              points={strengthPoints.map((p) => ({ ...p, value: lbToDisplay(p.value, units) }))}
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
                      {lbToDisplay(pr.weight, units)} {wUnit} × {pr.reps}
                      <Text style={styles.prMuted}>
                        {'  ·  '}~{lbToDisplay(pr.estimatedOneRepMax, units)} {wUnit} 1RM
                      </Text>
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
                      {s.volume > 0 && <Chip text={formatVolumeIn(s.volume, units)} />}
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

        <Text style={styles.sectionLabel}>Body weight</Text>

        {currentWeight != null && (
          <View style={styles.tileGrid}>
            <StatTile value={`${lbToDisplay(currentWeight, units)} ${wUnit}`} label="Current weight" />
            {weightChange != null && (
              <StatTile
                value={`${weightChange > 0 ? '+' : weightChange < 0 ? '−' : ''}${lbToDisplay(
                  Math.abs(weightChange),
                  units
                )} ${wUnit}`}
                label="Since you started"
              />
            )}
            {bmi != null && <StatTile value={bmi} label="BMI" />}
          </View>
        )}

        <LineChart
          title={`Body weight (${wUnit})`}
          points={weightPoints.map((p) => ({ ...p, value: lbToDisplay(p.value, units) }))}
        />

        <View style={styles.addCard}>
          <Text style={styles.addTitle}>Log today's weight</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder={`Weight (${wUnit})`}
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              maxLength={5}
              value={weightInput}
              onChangeText={setWeightInput}
            />
          </View>
          <Button label="Save Entry" onPress={handleAdd} loading={saving} />
        </View>

        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionLabel, { marginBottom: 0, marginTop: 0 }]}>Apple Health</Text>
          <ProBadge />
        </View>
        {!isPro ? (
          <ProLockCard
            title="Steps, sleep & heart data"
            description="Connect Apple Health and Apple Watch to see steps, active calories, sleep, and resting heart rate here."
          />
        ) : !health.supported ? (
          <Text style={styles.note}>Apple Health is available on iPhone.</Text>
        ) : !health.enabled ? (
          <Pressable
            style={styles.healthConnect}
            onPress={() =>
              health.connect().catch((e) =>
                Alert.alert('Could not connect', e instanceof Error ? e.message : 'Try again.')
              )
            }
            accessibilityRole="button"
          >
            <Ionicons name="heart" size={18} color={colors.danger} />
            <Text style={styles.healthConnectText}>Connect Apple Health & Apple Watch</Text>
          </Pressable>
        ) : (
          <View style={styles.tileGrid}>
            <StatTile
              value={health.snapshot?.stepsToday?.toLocaleString() ?? '—'}
              label="Steps today"
            />
            <StatTile
              value={health.snapshot?.activeEnergyTodayKcal ?? '—'}
              label="Active kcal"
            />
            <StatTile
              value={health.snapshot?.sleepHours != null ? `${health.snapshot.sleepHours}h` : '—'}
              label="Sleep"
            />
            <StatTile
              value={
                health.snapshot?.restingHeartRateBpm != null
                  ? `${Math.round(health.snapshot.restingHeartRateBpm)}`
                  : '—'
              }
              label="Resting HR"
            />
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.exportButton, pressed && { opacity: 0.7 }]}
          onPress={exporting ? undefined : handleExport}
          accessibilityRole="button"
        >
          <Ionicons name="download-outline" size={18} color={colors.primary} />
          <Text style={styles.exportText}>
            {exporting ? 'Preparing…' : 'Export workout data (CSV)'}
          </Text>
          {!isPro && <ProBadge />}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ text }: { text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  healthConnect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  healthConnectText: { color: colors.primary, fontWeight: '700' },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
  },
  exportText: { color: colors.primary, fontWeight: '700' },
  insightsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  insightsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  insightsTitle: { fontWeight: '800', color: colors.primary, fontSize: typography.sizes.md },
  insightsText: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  calendarMeta: { color: colors.textMuted, fontSize: typography.sizes.small },
  calendarGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  calendarColumn: { gap: 4 },
  calendarCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.background,
  },
  calendarOn: { backgroundColor: colors.primary, opacity: 0.55 },
  calendarHot: { backgroundColor: colors.primary },
  calendarFuture: { opacity: 0.25 },
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
