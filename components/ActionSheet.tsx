import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

export interface SheetAction {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

// Bottom-anchored action menu. Tapping the backdrop or Cancel dismisses;
// picking an action closes the sheet first, then runs it.
export function ActionSheet({
  visible,
  title,
  actions,
  onClose,
}: {
  visible: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable swallows taps so they don't dismiss the sheet. */}
        <Pressable>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            {title ? (
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            ) : null}
            {actions.map((action) => (
              <Pressable
                key={action.label}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => {
                  onClose();
                  // Let the modal finish dismissing before the action runs —
                  // navigating or opening an Alert mid-dismiss gets swallowed.
                  setTimeout(action.onPress, 200);
                }}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? colors.danger : colors.primary}
                />
                <Text style={[styles.rowLabel, action.destructive && styles.destructive]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.row, styles.cancelRow, pressed && styles.rowPressed]}
              onPress={onClose}
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  title: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted },
  rowLabel: { fontSize: typography.sizes.body, fontWeight: '600', color: colors.primary },
  destructive: { color: colors.danger },
  cancelRow: {
    justifyContent: 'center',
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  cancelLabel: { fontSize: typography.sizes.body, fontWeight: '700', color: colors.textMuted },
});
