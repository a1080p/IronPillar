import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../constants/theme';

// Bottom-anchored menu for picking one of several swatches laid out in a
// grid, rather than ActionSheet's vertical list of labeled rows — used for
// the avatar icon and color pickers.
export function GridSheet<T>({
  visible,
  title,
  items,
  keyExtractor,
  isSelected,
  renderSwatch,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  items: T[];
  keyExtractor: (item: T) => string;
  isSelected: (item: T) => boolean;
  renderSwatch: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable swallows taps so they don't dismiss the sheet. */}
        <Pressable>
          <SafeAreaView edges={['bottom']} style={styles.sheet}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View style={styles.grid}>
              {items.map((item) => {
                const selected = isSelected(item);
                return (
                  <Pressable
                    key={keyExtractor(item)}
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    style={[styles.swatchWrap, selected && styles.swatchWrapSelected]}
                  >
                    {renderSwatch(item)}
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              style={({ pressed }) => [styles.cancelRow, pressed && styles.cancelRowPressed]}
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

const styles = StyleSheet.create({
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
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    fontWeight: '700',
    paddingVertical: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  swatchWrap: {
    padding: 3,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchWrapSelected: { borderColor: colors.primary },
  cancelRow: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceMuted,
  },
  cancelRowPressed: { backgroundColor: colors.surfaceMuted },
  cancelLabel: { fontSize: typography.sizes.body, fontWeight: '700', color: colors.textMuted },
});
