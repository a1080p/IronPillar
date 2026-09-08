import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, radii, spacing, typography } from '../constants/theme';

interface ChartPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  title: string;
  points: ChartPoint[];
  unit?: string;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 140;
const PADDING = 24;

export function LineChart({ title, points, unit = '' }: LineChartProps) {
  if (points.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.empty}>No entries yet — add one below.</Text>
      </View>
    );
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const usableWidth = CHART_WIDTH - PADDING * 2;
  const usableHeight = CHART_HEIGHT - PADDING * 2;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? PADDING + usableWidth / 2
        : PADDING + (i / (points.length - 1)) * usableWidth;
    const y = PADDING + usableHeight - ((p.value - min) / range) * usableHeight;
    return { x, y, ...p };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        <Line
          x1={PADDING}
          y1={CHART_HEIGHT - PADDING}
          x2={CHART_WIDTH - PADDING}
          y2={CHART_HEIGHT - PADDING}
          stroke={colors.surfaceMuted}
          strokeWidth={1}
        />
        <Polyline points={polylinePoints} fill="none" stroke={colors.primary} strokeWidth={2} />
        {coords.map((c, i) => (
          <Circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={4}
            fill={i === coords.length - 1 ? colors.accentFlame : colors.primary}
          />
        ))}
      </Svg>
      <View style={styles.labelsRow}>
        {coords.map((c, i) => (
          <View key={i} style={styles.labelCol}>
            <Text style={styles.valueLabel}>
              {c.value}
              {unit}
            </Text>
            <Text style={styles.dateLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  empty: {
    color: colors.textMuted,
    paddingVertical: spacing.lg,
    textAlign: 'center',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  labelCol: {
    alignItems: 'center',
    flex: 1,
  },
  valueLabel: {
    fontSize: typography.sizes.small,
    fontWeight: '700',
    color: colors.text,
  },
  dateLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
});
