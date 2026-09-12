import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { Avatar } from '../components/Avatar';
import { AVATAR_PRESETS } from '../constants/avatars';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { deleteAvatar, uploadAvatar } from '../lib/avatar';

const BIRTHDAY_RE = /^\d{2}-\d{2}-\d{4}$/;

export default function EditProfileScreen() {
  const { user, profile, updateProfile } = useAuth();

  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  // Newly-picked local photo waiting to be uploaded on save.
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  // Selected built-in avatar, or null.
  const [avatarKey, setAvatarKey] = useState<string | null>(profile?.avatarKey ?? null);
  // Whether the already-uploaded photo should be kept.
  const [keepPhoto, setKeepPhoto] = useState(!!profile?.avatarUrl);
  const [saving, setSaving] = useState(false);

  if (!user || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
      </SafeAreaView>
    );
  }

  const shownUrl = pickedUri ?? (keepPhoto ? profile.avatarUrl : null);
  const hasPhoto = !!shownUrl;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Photo access needed',
        'Enable photo library access for Iron Pillar in Settings to upload a picture.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled) return;
    setPickedUri(result.assets[0].uri);
    setAvatarKey(null);
    setKeepPhoto(false);
  };

  const choosePreset = (key: string) => {
    setAvatarKey(key);
    setPickedUri(null);
    setKeepPhoto(false);
  };

  const removeImage = () => {
    setPickedUri(null);
    setAvatarKey(null);
    setKeepPhoto(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Missing name', 'Enter a name to display on your profile.');
      return;
    }
    if (birthday && !BIRTHDAY_RE.test(birthday)) {
      Alert.alert('Check your birthday', 'Use the format MM-DD-YYYY.');
      return;
    }

    setSaving(true);
    try {
      let avatarUrl: string | null = keepPhoto ? profile.avatarUrl ?? null : null;
      if (pickedUri) {
        avatarUrl = await uploadAvatar(user.uid, pickedUri);
      }
      // Drop the old photo from storage if it's no longer referenced.
      if (profile.avatarUrl && avatarUrl !== profile.avatarUrl) {
        await deleteAvatar(user.uid).catch(() => {});
      }

      await updateProfile({
        name: name.trim(),
        birthday,
        avatarUrl,
        avatarKey: pickedUri || avatarUrl ? null : avatarKey,
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Edit Profile</Text>

        <View style={styles.avatarWrap}>
          <Avatar url={shownUrl} presetKey={avatarKey} size={120} />
          <View style={styles.avatarActions}>
            <Pressable onPress={pickPhoto} hitSlop={8}>
              <Text style={styles.link}>{hasPhoto ? 'Change photo' : 'Upload a photo'}</Text>
            </Pressable>
            {(hasPhoto || avatarKey) && (
              <>
                <Text style={styles.dot}>·</Text>
                <Pressable onPress={removeImage} hitSlop={8}>
                  <Text style={[styles.link, styles.linkMuted]}>Remove</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Or pick an avatar</Text>
        <View style={styles.presetGrid}>
          {AVATAR_PRESETS.map((preset) => {
            const selected = avatarKey === preset.key && !shownUrl;
            return (
              <Pressable
                key={preset.key}
                onPress={() => choosePreset(preset.key)}
                style={[styles.presetItem, selected && styles.presetItemSelected]}
              >
                <View style={[styles.presetCircle, { backgroundColor: preset.color }]}>
                  <Ionicons name={preset.icon} size={26} color={colors.textOnDark} />
                </View>
              </Pressable>
            );
          })}
        </View>

        <TextField label="Name" value={name} onChangeText={setName} placeholder="Name" />
        <TextField
          label="Birthday"
          value={birthday}
          onChangeText={setBirthday}
          placeholder="MM-DD-YYYY"
          keyboardType="numbers-and-punctuation"
        />

        <Button label="Save Changes" onPress={handleSave} loading={saving} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  avatarWrap: { alignItems: 'center', gap: spacing.md },
  avatarActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  link: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.body },
  linkMuted: { color: colors.textMuted },
  dot: { color: colors.textMuted },
  sectionLabel: { fontWeight: '700', color: colors.primary },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  presetItem: {
    padding: 3,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetItemSelected: { borderColor: colors.primary },
  presetCircle: {
    width: 52,
    height: 52,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
