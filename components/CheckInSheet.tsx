import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
  Alert,
  Image,
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
import { createCheckIn } from '../lib/friends';

const PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 5],
  quality: 0.6,
};

// "Workout check-in": take a post-workout selfie (or pick one) and share it
// with friends, with an optional caption. Entirely optional.
export function CheckInSheet({
  visible,
  uid,
  onClose,
}: {
  visible: boolean;
  uid: string;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [posting, setPosting] = useState(false);

  const close = () => {
    setPhotoUri(null);
    setCaption('');
    onClose();
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Enable camera access for Iron Pillar in Settings to take a check-in photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ ...PHOTO_OPTIONS, cameraType: ImagePicker.CameraType.front });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const choosePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photo access needed', 'Enable photo access for Iron Pillar in Settings to pick a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(PHOTO_OPTIONS);
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const share = async () => {
    if (!photoUri) return;
    setPosting(true);
    try {
      await createCheckIn(uid, photoUri, caption);
      close();
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={styles.card} accessible={false} onPress={Keyboard.dismiss}>
          <Text style={styles.title} accessibilityRole="header">
            Workout Check-In
          </Text>
          <Text style={styles.subtitle}>
            Snap a post-workout selfie and share it with your friends. Totally optional.
          </Text>

          {photoUri ? (
            <Pressable onPress={takePhoto} accessibilityRole="button" accessibilityLabel="Retake photo">
              <Image source={{ uri: photoUri }} style={styles.preview} accessibilityIgnoresInvertColors />
            </Pressable>
          ) : (
            <View style={styles.pickRow}>
              <Pressable style={styles.pick} onPress={takePhoto} accessibilityRole="button">
                <Ionicons name="camera" size={28} color={colors.primary} />
                <Text style={styles.pickText}>Take Selfie</Text>
              </Pressable>
              <Pressable style={styles.pick} onPress={choosePhoto} accessibilityRole="button">
                <Ionicons name="images" size={28} color={colors.primary} />
                <Text style={styles.pickText}>Choose Photo</Text>
              </Pressable>
            </View>
          )}

          {photoUri && (
            <TextInput
              style={styles.input}
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption (optional)"
              placeholderTextColor={colors.textMuted}
              maxLength={200}
              accessibilityLabel="Caption"
            />
          )}

          <View style={styles.buttons}>
            <View style={styles.half}>
              <Button label="Not Now" variant="outline" onPress={close} disabled={posting} />
            </View>
            <View style={styles.half}>
              <Button label="Share" onPress={share} loading={posting} disabled={!photoUri} />
            </View>
          </View>
          <Text style={styles.fine}>Only your friends can see check-ins. You can delete one any time.</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: spacing.lg },
    card: { backgroundColor: colors.background, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
    title: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.primary },
    subtitle: { color: colors.textMuted, marginTop: -spacing.sm },
    pickRow: { flexDirection: 'row', gap: spacing.md },
    pick: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
    },
    pickText: { color: colors.primary, fontWeight: '700' },
    preview: { width: '100%', aspectRatio: 4 / 5, borderRadius: radii.md, backgroundColor: colors.surfaceMuted },
    input: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      color: colors.text,
    },
    buttons: { flexDirection: 'row', gap: spacing.md },
    half: { flex: 1 },
    fine: { color: colors.textMuted, fontSize: typography.sizes.small, textAlign: 'center' },
  });
