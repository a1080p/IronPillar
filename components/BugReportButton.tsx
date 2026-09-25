import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { submitBugReport } from '../lib/bugReports';
import type { BugReportCategory } from '../types/models';

const CATEGORIES: { value: BugReportCategory; label: string }[] = [
  { value: 'bug', label: 'Something broke' },
  { value: 'crash', label: 'App crashed' },
  { value: 'confusing_ui', label: 'Confusing' },
  { value: 'feature_idea', label: 'Idea' },
  { value: 'other', label: 'Other' },
];

// Floating report button, mounted once at the app root so it's reachable
// from any authenticated screen. Filing writes straight to the `bugReports`
// collection (create-only from the client — see firestore.rules); Claude
// triages new reports server-side and turns valid ones into Jira tickets.
export function BugReportButton({ uid }: { uid: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<BugReportCategory>('bug');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCategory('bug');
    setDescription('');
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Add a few words', 'Let us know what happened before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await submitBugReport({ uid, screen: pathname, category, description: description.trim() });
      setOpen(false);
      reset();
      Alert.alert('Thanks!', "We've got your report and will look into it.");
    } catch {
      Alert.alert("Couldn't send", 'Please try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.fab, { bottom: Math.max(spacing.lg, insets.bottom) + 92 }]}
        accessibilityRole="button"
        accessibilityLabel="Report a bug or issue"
      >
        <Ionicons name="bug" size={22} color={colors.textOnDark} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Report an issue</Text>
            <Text style={styles.subtitle}>On: {pathname}</Text>

            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(c.value)}
                  style={[styles.chip, category === c.value && styles.chipSelected]}
                >
                  <Text style={[styles.chipLabel, category === c.value && styles.chipLabelSelected]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder="What happened?"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={() => setOpen(false)}
                disabled={submitting}
              >
                <Text style={styles.cancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.submitButton]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.textOnDark} />
                ) : (
                  <Text style={styles.submitLabel}>Submit</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: typography.sizes.small, color: colors.textMuted, marginTop: -spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipLabel: { fontSize: typography.sizes.small, fontWeight: '600', color: colors.primary },
  chipLabelSelected: { color: colors.textOnDark },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    minHeight: 96,
    fontSize: typography.sizes.body,
    color: colors.text,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: { backgroundColor: colors.surfaceMuted },
  cancelLabel: { fontWeight: '700', color: colors.textMuted },
  submitButton: { backgroundColor: colors.primary },
  submitLabel: { fontWeight: '700', color: colors.textOnDark },
});
