import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import {
  MUSCLE_LABELS,
  searchCatalog,
  swapSuggestions,
  type CatalogExercise,
} from '../data/exercises';
import type { ExerciseSpec } from '../types/models';
import { ExerciseFormThumb } from './ExerciseForm';

// Pick a different exercise for this slot of the workout: machine taken, no
// barbell, or a move that doesn't suit you today. Suggests exercises for the
// same main muscle, and searches the whole catalog. Only exercises logged the
// same way (reps vs. time) are offered, so the slot's target still makes sense.
export function SwapExerciseSheet({
  visible,
  current,
  currentCatalog,
  canRestore,
  onPick,
  onRestore,
  onClose,
}: {
  visible: boolean;
  current: ExerciseSpec;
  currentCatalog?: CatalogExercise;
  canRestore: boolean;
  onPick: (exercise: CatalogExercise) => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const list = query.trim()
      ? searchCatalog(query, 40)
      : swapSuggestions(currentCatalog, 12);
    return list.filter((e) => e.logType === current.logType && e.id !== currentCatalog?.id);
  }, [query, currentCatalog, current.logType]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Swap {current.name}
          </Text>
          <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.primary} />
          </Pressable>
        </View>
        <TextInput
          style={styles.search}
          placeholder="Search exercises"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search exercises"
        />
        {canRestore && (
          <Pressable
            style={styles.restore}
            onPress={() => {
              onRestore();
              close();
            }}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-undo" size={16} color={colors.primary} />
            <Text style={styles.restoreText}>Back to the original exercise</Text>
          </Pressable>
        )}
        <Text style={styles.sectionLabel}>
          {query.trim() ? 'Results' : currentCatalog ? 'Works the same muscles' : 'Search to find a replacement'}
        </Text>
        <FlatList
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            query.trim() ? <Text style={styles.empty}>No matching exercises.</Text> : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => {
                onPick(item);
                close();
              }}
              accessibilityRole="button"
              accessibilityLabel={`Swap to ${item.name}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  {item.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')} · {item.equipment}
                </Text>
              </View>
              <ExerciseFormThumb exercise={item} />
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    title: { flex: 1, fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary },
    search: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
      fontSize: typography.sizes.body,
    },
    restore: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    restoreText: { color: colors.primary, fontWeight: '700' },
    sectionLabel: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      color: colors.textMuted,
      fontSize: typography.sizes.small,
      fontWeight: '600',
    },
    list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    rowPressed: { opacity: 0.6 },
    rowText: { flex: 1 },
    rowName: { fontWeight: '700', color: colors.text },
    rowMeta: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  });
