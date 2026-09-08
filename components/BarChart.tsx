import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { colors, radii, spacing, typography } from '../constants/theme';

interface BarPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  title: string;
  points: BarPoint[];
  /** Formats the value shown above each bar. */
  formatValue?: (value: number) => string;
}

const CHART_WIDTH = 320;
const CHART_HEIGHT = 130;
const PADDING = 20;

export function BarChart({ title, points, formatValue }: BarChartProps) {
  const hasData = points.some((p) => p.value > 0);
  const max = Math.max(1, ...points.map((p) => p.value));
  const usableWidth = CHART_WIDTH - PADDING * 2;
  const usableHeight = CHART_HEIGHT - PADDING;
  const slot = usableWidth / points.length;
  const barWidth = Math.min(28, slot * 0.6);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {!hasData ? (
        <Text style={styles.empty}>Finish a workout to start tracking this.</Text>
      ) : (
        <>
          <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
            <Line
              x1={PADDING}
              y1={CHART_HEIGHT - PADDING}
              x2={CHART_WIDTH - PADDING}
              y2={CHART_HEIGHT - PADDING}
              stroke={colors.border}
              strokeWidth={1}
              opacity={0.2}
            />
            {points.map((p, i) => {
              const barHeight = (p.value / max) * usableHeight;
              const x = PADDING + slot * i + (slot - barWidth) / 2;
              const y = CHART_HEIGHT - PADDING - barHeight;
              const isLast = i === points.length - 1;
              return (
                <Rect
                  key={i}
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(barHeight, p.value > 0 ? 2 : 0)}
                  rx={3}
                  fill={isLast ? colors.accentFlame : colors.primary}
                />
              );
            })}
          </Svg>
          <View style={styles.labelsRow}>
            {points.map((p, i) => (
              <View key={i} style={styles.labelCol}>
                <Text style={styles.valueLabel}>
                  {formatValue ? formatValue(p.value) : p.value}
                </Text>
                <Text style={styles.dateLabel}>{p.label}</Text>
              </View>
            ))}
          </View>
        </>
      )}
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
  title: { fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, paddingVertical: spacing.lg, textAlign: 'center' },
  labelsRow: { flexDirection: 'row', marginTop: spacing.xs },
  labelCol: { alignItems: 'center', flex: 1 },
  valueLabel: { fontSize: 11, fontWeight: '700', color: colors.text },
  dateLabel: { fontSize: 10, color: colors.textMuted },
});
