import { StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { radii } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

export function ProgressBar({ progress }: { progress: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  track: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
});
