import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from './ProgressBar';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import type { CompletionResult } from '../lib/workoutCompletion';

const LINE_MS = 650; // how long each line takes to count up
const GAP_MS = 180; // pause between lines

interface Line {
  label: string;
  detail?: string;
  value: number;
  accent?: boolean;
}

// Eases a number from 0 to `target`, starting after `delay` ms.
function useCountUp(target: number, delay: number, duration = LINE_MS) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    let start: number | null = null;
    const timer = setTimeout(() => {
      const step = (t: number) => {
        if (start === null) start = t;
        const p = Math.min(1, (t - start) / duration);
        setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [target, delay, duration]);
  return value;
}

function buildLines(result: CompletionResult): Line[] {
  const b = result.breakdown;
  const multiplier = result.xpMultiplier ?? 1;
  if (!b) return [{ label: 'Workout XP', value: result.xpEarned }];

  const lines: Line[] = [];
  if (b.exerciseXp > 0) {
    lines.push({ label: 'Exercises completed', detail: `${b.exercises} × 50`, value: b.exerciseXp });
  }
  if (b.setXp > 0) lines.push({ label: 'Sets completed', detail: `${b.sets} × 5`, value: b.setXp });
  if (b.distanceXp > 0) lines.push({ label: 'Distance', detail: '40 per km', value: b.distanceXp });
  if (b.prBonus && b.prBonus > 0) {
    const count = result.personalRecords?.length ?? 1;
    lines.push({
      label: count === 1 ? 'Personal record' : 'Personal records',
      detail: `${count} × ${Math.round(b.prBonus / count)}`,
      value: b.prBonus,
      accent: true,
    });
  }
  for (const improvement of b.improvements ?? []) {
    lines.push({ label: improvement.label, detail: 'Beat your last session', value: improvement.xp });
  }
  if (b.baseStreakBonus > 0) {
    lines.push({
      label: 'Streak bonus',
      detail: `day ${result.streakCountAfter} × 20`,
      value: b.baseStreakBonus,
    });
  }
  if (multiplier > 1) {
    const base = lines.reduce((sum, line) => sum + line.value, 0);
    lines.push({
      label: `Pro ${multiplier}× bonus`,
      detail: 'Iron Pillar Pro',
      value: base * (multiplier - 1),
      accent: true,
    });
  }
  if (lines.length === 0) lines.push({ label: 'Workout XP', value: result.xpEarned });
  return lines;
}

// Animated "receipt": each XP source counts up in turn, then the total
// counts up and pops. Ends with today's progress toward a streak day.
export function XpBreakdown({ result }: { result: CompletionResult }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const lines = useMemo(() => buildLines(result), [result]);
  const totalDelay = lines.length * (LINE_MS + GAP_MS);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>XP earned</Text>
      {lines.map((line, i) => (
        <BreakdownLine key={line.label} line={line} delay={i * (LINE_MS + GAP_MS)} />
      ))}
      <TotalLine total={result.xpEarned} delay={totalDelay} />
      <StreakProgress result={result} />
    </View>
  );
}

function BreakdownLine({ line, delay }: { line: Line; delay: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const value = useCountUp(line.value, delay);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }).start();
  }, [delay, opacity]);

  return (
    <Animated.View style={[styles.line, { opacity }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.lineLabel, line.accent && styles.accent]}>{line.label}</Text>
        {line.detail ? <Text style={styles.lineDetail}>{line.detail}</Text> : null}
      </View>
      <Text style={[styles.lineValue, line.accent && styles.accent]}>+{value}</Text>
    </Animated.View>
  );
}

function TotalLine({ total, delay }: { total: number; delay: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const value = useCountUp(total, delay, 900);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(delay + 900),
        Animated.spring(scale, { toValue: 1.12, useNativeDriver: true, speed: 30 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20 }),
      ]),
    ]).start();
  }, [delay, opacity, scale]);

  return (
    <Animated.View style={[styles.totalRow, { opacity }]}>
      <Text style={styles.totalLabel}>Total</Text>
      <Animated.Text style={[styles.totalValue, { transform: [{ scale }] }]}>
        {value}
        <Text style={styles.totalUnit}> xp</Text>
      </Animated.Text>
    </Animated.View>
  );
}

// Today's progress toward the 30 combined minutes a streak day needs.
function StreakProgress({ result }: { result: CompletionResult }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const min = result.minStreakDayMinutes;
  const day = result.dayMinutes;
  if (min == null || day == null) return null;

  let message: string;
  if (result.dayCountedNow) {
    const n = result.streakCountAfter;
    message = `Today counts! Your streak is now ${n} day${n === 1 ? '' : 's'}.`;
  } else if (result.dayAlreadyCounted) {
    message = 'Today already counted toward your streak.';
  } else {
    const left = Math.max(0, min - day);
    message = `${left} more minute${left === 1 ? '' : 's'} today to count toward your streak.`;
  }

  return (
    <View style={styles.streakBox}>
      <View style={styles.streakHeader}>
        <Text style={styles.streakLabel}>Today's training</Text>
        <Text style={styles.streakMinutes}>
          {Math.min(day, 999)} / {min} min
        </Text>
      </View>
      <ProgressBar progress={Math.min(1, day / min)} />
      <Text style={styles.streakMessage}>{message}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
      alignSelf: 'stretch',
    },
    title: { fontWeight: '800', color: colors.primary, fontSize: typography.sizes.md },
    line: { flexDirection: 'row', alignItems: 'center' },
    lineLabel: { fontWeight: '700', color: colors.text },
    lineDetail: { color: colors.textMuted, fontSize: typography.sizes.small },
    lineValue: { fontWeight: '800', color: colors.text, fontSize: typography.sizes.body },
    accent: { color: colors.accentFlame },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderTopWidth: 1.5,
      borderTopColor: colors.divider,
      paddingTop: spacing.sm,
      marginTop: spacing.xs,
    },
    totalLabel: { fontWeight: '800', color: colors.text, fontSize: typography.sizes.md },
    totalValue: { fontWeight: '900', color: colors.primary, fontSize: typography.sizes.xl },
    totalUnit: { fontSize: typography.sizes.body, fontWeight: '700' },
    streakBox: { marginTop: spacing.sm, gap: spacing.xs },
    streakHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    streakLabel: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.small },
    streakMinutes: { color: colors.textMuted, fontSize: typography.sizes.small },
    streakMessage: { color: colors.textMuted, fontSize: typography.sizes.small },
  });
