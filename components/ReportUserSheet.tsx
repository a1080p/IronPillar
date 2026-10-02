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
import { REPORT_REASONS, reportUser, type ReportReason } from '../lib/friends';

// Report another user: pick a reason, optionally add details. Reports go to
// the developer, who reviews them within 24 hours.
export function ReportUserSheet({
  visible,
  userUid,
  userName,
  postId,
  commentId,
  onClose,
}: {
  visible: boolean;
  userUid: string;
  userName: string;
  postId?: string; // reporting a post (or a comment on it) rather than the profile
  commentId?: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const close = () => {
    setReason(null);
    setDetails('');
    onClose();
  };

  const submit = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await reportUser(userUid, reason, details, { postId, commentId });
      close();
      Alert.alert(
        'Report sent',
        `Thanks for letting us know. We review reports within 24 hours. You can also block ${userName} so they can't see your profile or add you.`
      );
    } catch (e) {
      Alert.alert('Could not send report', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.card} accessible={false} onPress={Keyboard.dismiss}>
          <Text style={styles.title} accessibilityRole="header">
            {commentId ? 'Report Comment' : postId ? 'Report Post' : `Report ${userName}`}
          </Text>
          <Text style={styles.subtitle}>What's wrong?</Text>
          {REPORT_REASONS.map((r) => {
            const selected = reason === r.value;
            return (
              <Pressable
                key={r.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setReason(r.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{r.label}</Text>
              </Pressable>
            );
          })}
          <TextInput
            style={styles.input}
            value={details}
            onChangeText={setDetails}
            placeholder="Anything else we should know? (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={1000}
            accessibilityLabel="Report details"
          />
          <View style={styles.buttons}>
            <View style={styles.half}>
              <Button label="Cancel" variant="outline" onPress={close} disabled={sending} />
            </View>
            <View style={styles.half}>
              <Button label="Send Report" onPress={submit} loading={sending} disabled={!reason} />
            </View>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing.lg },
    card: { backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm },
    title: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary },
    subtitle: { color: colors.textMuted, marginBottom: spacing.xs },
    option: {
      borderWidth: 1.5,
      borderColor: colors.divider,
      borderRadius: radii.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    optionSelected: { borderColor: colors.primary, backgroundColor: colors.surfaceMuted },
    optionText: { color: colors.text },
    optionTextSelected: { color: colors.primary, fontWeight: '700' },
    input: {
      minHeight: 80,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      color: colors.text,
      textAlignVertical: 'top',
    },
    buttons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
    half: { flex: 1 },
  });
