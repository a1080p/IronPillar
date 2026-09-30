import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from './Button';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { WORKOUT_NOTE_MAX_LENGTH, useWorkoutNote } from '../hooks/useWorkoutNote';

// "Add notes for this workout": a small button that opens an editor for the
// user's own note on a workout. With `showPreview`, a saved note is also shown
// inline (used on the workout detail page; the logging screen keeps it to the
// button so it doesn't push the sets down).
export function WorkoutNotes({
  uid,
  workoutId,
  showPreview = false,
}: {
  uid: string | undefined;
  workoutId: string | undefined;
  showPreview?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { note, saveNote } = useWorkoutNote(uid, workoutId);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  if (!uid || !workoutId) return null;

  const openEditor = () => {
    setDraft(note);
    setOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveNote(draft);
      setOpen(false);
    } catch (e) {
      Alert.alert('Could not save your notes', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {showPreview && note ? (
        <Pressable style={styles.preview} onPress={openEditor} accessibilityRole="button">
          <View style={styles.previewHeader}>
            <Text style={styles.previewHeading}>Your notes</Text>
            <Text style={styles.previewEdit}>Edit</Text>
          </View>
          <Text style={styles.previewText}>{note}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.link} onPress={openEditor} hitSlop={8} accessibilityRole="button">
          <Ionicons name="document-text-outline" size={16} color={colors.primary} />
          <Text style={styles.linkText}>{note ? 'View notes for this workout' : 'Add notes for this workout'}</Text>
        </Pressable>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <Pressable style={styles.card} onPress={Keyboard.dismiss}>
            <Text style={styles.heading}>Workout notes</Text>
            <Text style={styles.hint}>
              Seat heights, machine settings, what to try next time. Only you can see these.
            </Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="e.g. Leg press seat at 4, feet high on the plate"
              placeholderTextColor={colors.textMuted}
              multiline
              autoFocus
              maxLength={WORKOUT_NOTE_MAX_LENGTH}
              textAlignVertical="top"
            />
            <View style={styles.buttons}>
              <View style={styles.buttonHalf}>
                <Button label="Cancel" variant="outline" onPress={() => setOpen(false)} disabled={saving} />
              </View>
              <View style={styles.buttonHalf}>
                <Button label="Save" onPress={handleSave} loading={saving} />
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    linkText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
    preview: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
    },
    previewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
    previewHeading: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.small },
    previewEdit: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.small },
    previewText: { color: colors.text, fontSize: typography.sizes.small, lineHeight: 18 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: { backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing.lg },
    heading: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary },
    hint: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: spacing.xs },
    input: {
      minHeight: 140,
      maxHeight: 260,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      color: colors.text,
      marginTop: spacing.md,
    },
    buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
    buttonHalf: { flex: 1 },
  });
