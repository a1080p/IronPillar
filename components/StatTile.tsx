import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';

interface StatTileProps {
  value: string | number;
  label: string;
  hint?: string; // e.g. "+2 vs last week"
  hintTone?: 'up' | 'down' | 'neutral';
}

export function StatTile({ value, label, hint, hintTone = 'neutral' }: StatTileProps) {
  return (
    <View style={styles.tile}>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
      {hint ? (
        <Text
          style={[
            styles.hint,
            hintTone === 'up' && styles.hintUp,
            hintTone === 'down' && styles.hintDown,
          ]}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '40%',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  value: { fontSize: typography.sizes.lg, fontWeight: '800', color: colors.primary },
  label: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
  hint: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, fontWeight: '600' },
  hintUp: { color: colors.success },
  hintDown: { color: colors.danger },
});
