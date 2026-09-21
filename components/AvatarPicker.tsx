import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActionSheet } from './ActionSheet';
import { Avatar } from './Avatar';
import { Button } from './Button';
import { AVATAR_PRESETS, buildAvatarKey, parseAvatarKey } from '../constants/avatars';
import { colors, radii, spacing } from '../constants/theme';

const PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
};

// Avatar editor shared by onboarding and Edit Profile: a live preview, one
// button to take/choose a photo, and an inline grid of preset icon+color
// avatars below it. The parent owns the actual photoUrl/avatarKey state (and
// upload timing); this component only reports picks.
export function AvatarPicker({
  photoUrl,
  avatarKey,
  onPickedPhoto,
  onRemovePhoto,
  onChangeAvatarKey,
  showRemove = false,
  size = 120,
}: {
  photoUrl: string | null;
  avatarKey: string | null;
  onPickedPhoto: (localUri: string) => void;
  onRemovePhoto?: () => void;
  onChangeAvatarKey: (key: string) => void;
  showRemove?: boolean;
  size?: number;
}) {
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);

  const parsed = parseAvatarKey(avatarKey);
  const currentIconKey = parsed?.iconKey;

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera access needed',
        'Enable camera access for Iron Pillar in Settings to take a photo.'
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PHOTO_OPTIONS);
    if (!result.canceled) onPickedPhoto(result.assets[0].uri);
  };

  const choosePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Enable photo library access for Iron Pillar in Settings to upload a picture.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(PHOTO_OPTIONS);
    if (!result.canceled) onPickedPhoto(result.assets[0].uri);
  };

  return (
    <View style={styles.container}>
      <Avatar url={photoUrl} presetKey={photoUrl ? null : avatarKey} size={size} />

      <Button
        label="Upload or Choose Photo"
        variant="outline"
        onPress={() => setPhotoSheetOpen(true)}
      />

      <View style={styles.grid}>
        {AVATAR_PRESETS.map((preset) => {
          const selected = !photoUrl && preset.key === currentIconKey;
          return (
            <Pressable
              key={preset.key}
              onPress={() => onChangeAvatarKey(buildAvatarKey(preset.key, preset.color))}
              style={[styles.swatchWrap, selected && styles.swatchWrapSelected]}
            >
              <View style={[styles.swatch, { backgroundColor: preset.color }]}>
                <Ionicons name={preset.icon} size={26} color={colors.textOnDark} />
              </View>
            </Pressable>
          );
        })}
      </View>

      <ActionSheet
        visible={photoSheetOpen}
        title="Profile Photo"
        onClose={() => setPhotoSheetOpen(false)}
        actions={[
          { label: 'Take Photo', icon: 'camera-outline', onPress: takePhoto },
          { label: 'Choose from Library', icon: 'images-outline', onPress: choosePhoto },
          ...(showRemove && photoUrl
            ? [
                {
                  label: 'Remove Photo',
                  icon: 'trash-outline' as const,
                  destructive: true,
                  onPress: () => onRemovePhoto?.(),
                },
              ]
            : []),
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.md,
  },
  swatchWrap: {
    padding: 3,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchWrapSelected: { borderColor: colors.primary },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
