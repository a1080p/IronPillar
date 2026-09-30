import { Animated, StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { radii } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

export function ProgressBar({ progress }: { progress: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const clamped = Math.max(0, Math.min(1, progress));
  // The fill glides to its new width instead of jumping.
  const value = useRef(new Animated.Value(clamped)).current;
  useEffect(() => {
    Animated.timing(value, { toValue: clamped, duration: 350, useNativeDriver: false }).start();
  }, [clamped, value]);
  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.fill,
          { width: value.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
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
