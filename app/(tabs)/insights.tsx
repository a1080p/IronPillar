import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TopBar } from '../../components/TopBar';
import { BarChart } from '../../components/BarChart';
import { LineChart } from '../../components/LineChart';
import { StatTile } from '../../components/StatTile';
import { ProBadge, ProLockCard } from '../../components/ProLock';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePurchases } from '../../contexts/PurchasesContext';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import { useWearableSnapshot } from '../../hooks/useWearableSnapshot';
import { useAppleHealth } from '../../hooks/useAppleHealth';
import { activityTypeLabel } from '../../lib/healthkit';
import { computeReadiness, type ReadinessTone } from '../../lib/readiness';
import {
  e1rmChangePct,
  e1rmSeries,
  exerciseHistories,
  isPlateaued,
  nextTarget,
  outdoorMilesByWeek,
  timeOfDayBreakdown,
  trainingMix,
  weeklyMinutes,
} from '../../lib/insights';

export default function InsightsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const { isPro } = usePurchases();
  const { logs } = useWorkoutLogs(user?.uid);
  const { snapshot: whoop } = useWearableSnapshot(user?.uid);
  const health = useAppleHealth(user?.uid, isPro);

  const histories = useMemo(() => exerciseHistories(logs), [logs]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const selected = histories.find((h) => h.name === selectedName) ?? histories[0];

  const readiness = useMemo(
    () => computeReadiness(logs, health.snapshot, whoop),
    [logs, health.snapshot, whoop]
  );
  const minutesByWeek = useMemo(() => weeklyMinutes(logs, 12), [logs]);
  const mix = useMemo(() => trainingMix(logs), [logs]);
  const timeOfDay = useMemo(() => timeOfDayBreakdown(logs), [logs]);
  const miles = useMemo(() => outdoorMilesByWeek(logs, 8), [logs]);
  const plateaued = useMemo(() => histories.filter(isPlateaued), [histories]);

  if (!isPro) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBar />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Insights</Text>
          <Text style={styles.subtitle}>Coaching-level analytics built from your own training.</Text>
          <ProLockCard
            title="Daily readiness score"
            description="HRV, resting heart rate, sleep, and training load combined into one score with a clear training call."
          />
          <ProLockCard
            title="Next-session targets"
            description="The exact weight and reps to aim for on each lift, based on how your last session went."
          />
          <ProLockCard
            title="Per-exercise 1RM trends & plateau alerts"
            description="See every lift's estimated one-rep max over time, and get flagged when one stalls."
          />
          <ProLockCard
            title="Training load, mix & timing"
            description="12-week training minutes, strength vs. conditioning balance, and when you train best."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const target = selected ? nextTarget(selected) : null;
  const change = selected ? e1rmChangePct(selected, 30) : null;
  const toneColor = (tone: ReadinessTone) =>
    tone === 'up' ? colors.primary : tone === 'down' ? colors.danger : colors.textMuted;
  const recentExternal = health.snapshot?.externalWorkouts.slice(0, 5) ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.titleRow}>
          <Text style={styles.heading}>Insights</Text>
          <ProBadge />
        </View>

        <View style={styles.readinessCard}>
          <View style={styles.readinessTop}>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreValue}>{readiness.score}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.readinessLabel}>Readiness: {readiness.label}</Text>
              <Text style={styles.readinessRec}>{readiness.recommendation}</Text>
            </View>
          </View>
          {readiness.factors.map((f) => (
            <View key={f.label} style={styles.factorRow}>
              <Text style={styles.factorLabel}>{f.label}</Text>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.factorValue, { color: toneColor(f.tone) }]}>{f.value}</Text>
                <Text style={styles.factorDetail}>{f.detail}</Text>
              </View>
            </View>
          ))}
          {!readiness.hasWearableData && (
            <Pressable onPress={() => router.push('/(tabs)/profile')}>
              <Text style={styles.linkText}>
                Connect Apple Health in Profile for a recovery-aware score →
              </Text>
            </Pressable>
          )}
        </View>

        {health.snapshot && (
          <View style={styles.tileGrid}>
            {health.snapshot.stepsToday != null && (
              <StatTile value={health.snapshot.stepsToday.toLocaleString()} label="Steps today" />
            )}
            {health.snapshot.activeEnergyTodayKcal != null && (
              <StatTile value={`${health.snapshot.activeEnergyTodayKcal}`} label="Active kcal" />
            )}
            {health.snapshot.sleepHours != null && (
              <StatTile value={`${health.snapshot.sleepHours}h`} label="Sleep" />
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>Strength progress</Text>
        {histories.length === 0 ? (
          <Text style={[styles.note, { marginBottom: spacing.lg }]}>
            Log a few weighted sets and your per-exercise trends and targets will show up here.
          </Text>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {histories.slice(0, 15).map((h) => {
                const active = h.name === selected?.name;
                return (
                  <Pressable
                    key={h.name}
                    style={[styles.pickChip, active && styles.pickChipActive]}
                    onPress={() => setSelectedName(h.name)}
                  >
                    <Text style={[styles.pickChipText, active && styles.pickChipTextActive]}>
                      {h.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selected && (
              <>
                <View style={styles.tileGrid}>
                  <StatTile
                    value={`${Math.max(...selected.sessions.map((s) => s.bestE1rm))} lb`}
                    label="Best est. 1RM"
                  />
                  <StatTile value={selected.sessions.length} label="Sessions" />
                  {change != null && (
                    <StatTile
                      value={`${change > 0 ? '+' : ''}${change}%`}
                      label="1RM, last 30d"
                      hintTone={change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'}
                    />
                  )}
                </View>
                <LineChart title={`${selected.name}: est. 1RM (lb)`} points={e1rmSeries(selected)} />
                {target && (
                  <View style={styles.panel}>
                    <View style={styles.panelTitleRow}>
                      <Ionicons
                        name={target.action === 'add_weight' ? 'arrow-up-circle' : 'repeat'}
                        size={18}
                        color={colors.primary}
                      />
                      <Text style={styles.panelTitle}>Next session target</Text>
                    </View>
                    <Text style={styles.targetValue}>
                      {target.weight} lb × {target.reps} reps
                    </Text>
                    <Text style={styles.note}>{target.reason}</Text>
                  </View>
                )}
              </>
            )}

            {plateaued.length > 0 && (
              <View style={[styles.panel, styles.warnPanel]}>
                <Text style={styles.panelTitle}>Plateau alert</Text>
                {plateaued.slice(0, 4).map((h) => (
                  <Text key={h.name} style={styles.warnText}>
                    • {h.name}: no new best in 3 sessions
                  </Text>
                ))}
                <Text style={styles.note}>
                  Try a lighter deload week, or switch rep ranges (e.g. 5s → 8–10s) for a few
                  sessions.
                </Text>
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionLabel}>Training load</Text>
        <BarChart title="Training minutes per week" points={minutesByWeek} />

        <View style={styles.tileGrid}>
          <StatTile value={mix.strength} label="Strength" />
          <StatTile value={mix.timed} label="Conditioning" />
          <StatTile value={mix.outdoor} label="Outdoor" />
        </View>

        <BarChart title="When you train" points={timeOfDay} />
        {mix.outdoor > 0 && <BarChart title="Outdoor miles per week" points={miles} />}

        {recentExternal.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>From Apple Health</Text>
            {recentExternal.map((w) => (
              <View key={w.start} style={styles.externalRow}>
                <Text style={styles.externalName}>{activityTypeLabel(w.activityType)}</Text>
                <Text style={styles.note}>
                  {new Date(w.start).toLocaleDateString()} · {w.minutes} min · {w.sourceName}
                </Text>
              </View>
            ))}
            <Text style={styles.note}>Counted toward your training load.</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: 120 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
    subtitle: { color: colors.textMuted, marginBottom: spacing.lg, marginTop: spacing.xs },
    note: { color: colors.textMuted, fontSize: typography.sizes.small },
    sectionLabel: {
      fontWeight: '700',
      color: colors.primary,
      fontSize: typography.sizes.md,
      marginBottom: spacing.md,
      marginTop: spacing.sm,
    },
    readinessCard: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    readinessTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
    scoreRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 5,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scoreValue: { fontSize: typography.sizes.lg, fontWeight: '800', color: colors.primary },
    readinessLabel: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.text },
    readinessRec: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
    factorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.divider,
      paddingTop: spacing.sm,
    },
    factorLabel: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.small },
    factorValue: { fontWeight: '800', fontSize: typography.sizes.small },
    factorDetail: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
    linkText: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: typography.sizes.small,
      marginTop: spacing.xs,
    },
    tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
    chipScroll: { marginBottom: spacing.md, flexGrow: 0 },
    pickChip: {
      borderWidth: 1.5,
      borderColor: colors.divider,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      marginRight: spacing.sm,
    },
    pickChipActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    pickChipText: { color: colors.text, fontWeight: '600', fontSize: typography.sizes.small },
    pickChipTextActive: { color: colors.textOnDark },
    panel: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
      gap: spacing.xs,
    },
    warnPanel: { backgroundColor: colors.warningBg },
    warnText: { color: colors.text, fontSize: typography.sizes.small },
    panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    panelTitle: { fontWeight: '700', color: colors.text },
    targetValue: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.primary },
    externalRow: { paddingVertical: 2 },
    externalName: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.small },
    exportButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: radii.md,
      paddingVertical: spacing.md,
    },
    exportText: { color: colors.primary, fontWeight: '700' },
  });
