import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { deleteAvatar, uploadAvatar } from '../lib/avatar';

const BIRTHDAY_RE = /^\d{2}-\d{2}-\d{4}$/;

export default function EditProfileScreen() {
  const { user, profile, updateProfile } = useAuth();

  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  // Newly-picked local photo waiting to be uploaded on save.
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  // Selected icon+color avatar key, or null.
  const [avatarKey, setAvatarKeyState] = useState<string | null>(profile?.avatarKey ?? null);
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

  const shownUrl = pickedUri ?? (keepPhoto ? profile.avatarUrl ?? null : null);
  const hasPhoto = !!shownUrl;

  const handlePickedPhoto = (uri: string) => {
    setPickedUri(uri);
    setAvatarKeyState(null);
    setKeepPhoto(false);
  };

  const handleChangeAvatarKey = (key: string) => {
    setAvatarKeyState(key);
    setPickedUri(null);
    setKeepPhoto(false);
  };

  const removeImage = () => {
    setPickedUri(null);
    setAvatarKeyState(null);
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
          <AvatarPicker
            photoUrl={shownUrl}
            avatarKey={avatarKey}
            onPickedPhoto={handlePickedPhoto}
            onRemovePhoto={removeImage}
            onChangeAvatarKey={handleChangeAvatarKey}
            showRemove
          />
          {(hasPhoto || avatarKey) && (
            <Pressable onPress={removeImage} hitSlop={8}>
              <Text style={[styles.link, styles.linkMuted]}>Remove avatar</Text>
            </Pressable>
          )}
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
  link: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.body },
  linkMuted: { color: colors.textMuted },
});
