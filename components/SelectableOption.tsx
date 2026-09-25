import { Pressable, StyleSheet, Text } from 'react-native';
import { useMemo } from 'react';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

interface SelectableOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function SelectableOption({ label, selected, onPress }: SelectableOptionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, selected && styles.selected]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  base: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selected: {
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
    color: colors.primary,
  },
  labelSelected: {
    color: colors.textOnDark,
  },
});
