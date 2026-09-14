import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheet } from './ActionSheet';
import { Avatar } from './Avatar';
import { GridSheet } from './GridSheet';
import {
  AVATAR_COLORS,
  AVATAR_ICONS,
  DEFAULT_AVATAR_COLOR,
  DEFAULT_AVATAR_ICON,
  buildAvatarKey,
  parseAvatarKey,
} from '../constants/avatars';
import { colors, radii, spacing, typography } from '../constants/theme';

const PHOTO_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.6,
};

// Avatar editor shared by onboarding and Edit Profile: a live preview plus
// three entry points below it — take/choose a photo, pick an icon shape, and
// pick a color for that shape. The parent owns the actual photoUrl/avatarKey
// state (and upload timing); this component only reports picks.
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
  const [cameraSheetOpen, setCameraSheetOpen] = useState(false);
  const [iconSheetOpen, setIconSheetOpen] = useState(false);
  const [colorSheetOpen, setColorSheetOpen] = useState(false);

  const parsed = parseAvatarKey(avatarKey);
  const currentIconKey = parsed?.iconKey ?? DEFAULT_AVATAR_ICON;
  const currentColor = parsed?.color ?? DEFAULT_AVATAR_COLOR;
  const currentIcon = AVATAR_ICONS.find((i) => i.key === currentIconKey)?.icon ?? 'barbell';

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

      <View style={styles.actionRow}>
        <ActionButton icon="camera" label="Photo" onPress={() => setCameraSheetOpen(true)} />
        <ActionButton icon={currentIcon} label="Icon" onPress={() => setIconSheetOpen(true)} />
        <ActionButton
          icon="color-palette"
          label="Color"
          swatchColor={currentColor}
          onPress={() => setColorSheetOpen(true)}
        />
      </View>

      <ActionSheet
        visible={cameraSheetOpen}
        title="Profile Photo"
        onClose={() => setCameraSheetOpen(false)}
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

      <GridSheet
        visible={iconSheetOpen}
        title="Choose an Icon"
        items={AVATAR_ICONS}
        keyExtractor={(item) => item.key}
        isSelected={(item) => item.key === currentIconKey && !photoUrl}
        onSelect={(item) => onChangeAvatarKey(buildAvatarKey(item.key, currentColor))}
        onClose={() => setIconSheetOpen(false)}
        renderSwatch={(item) => (
          <View style={[styles.iconSwatch, { backgroundColor: currentColor }]}>
            <Ionicons name={item.icon} size={26} color={colors.textOnDark} />
          </View>
        )}
      />

      <GridSheet
        visible={colorSheetOpen}
        title="Choose a Color"
        items={AVATAR_COLORS}
        keyExtractor={(item) => item}
        isSelected={(item) => item === currentColor && !photoUrl}
        onSelect={(item) => onChangeAvatarKey(buildAvatarKey(currentIconKey, item))}
        onClose={() => setColorSheetOpen(false)}
        renderSwatch={(item) => <View style={[styles.colorSwatch, { backgroundColor: item }]} />}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  swatchColor,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  swatchColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <View style={[styles.actionCircle, swatchColor ? { backgroundColor: swatchColor } : null]}>
        <Ionicons name={icon} size={20} color={swatchColor ? colors.textOnDark : colors.primary} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.lg },
  actionButton: { alignItems: 'center', gap: spacing.xs },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: typography.sizes.small, color: colors.primary, fontWeight: '600' },
  iconSwatch: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
  },
});
