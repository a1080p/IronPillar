import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useNavigation } from 'expo-router';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { AvatarPicker } from '../components/AvatarPicker';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { deleteAvatar, uploadAvatar } from '../lib/avatar';
import { formatBirthdayInput } from '../lib/dates';

const BIRTHDAY_RE = /^\d{2}-\d{2}-\d{4}$/;

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile, updateProfile } = useAuth();

  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  // Newly-picked local photo waiting to be uploaded on save.
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  // Selected icon+color avatar key, or null.
  const [avatarKey, setAvatarKeyState] = useState<string | null>(profile?.avatarKey ?? null);
  // Whether the user removed/replaced the existing photo in this session.
  // Tracked as "removed" rather than "keep", so a profile that finishes
  // loading after this screen mounts still keeps its photo by default
  // (a `useState(!!profile?.avatarUrl)` snapshot would read false then, and
  // saving would wipe the photo).
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const keepPhoto = !photoRemoved && !!profile?.avatarUrl;
  const [saving, setSaving] = useState(false);
  const navigation = useNavigation();
  // Set right before navigating away after a successful save, so the
  // beforeRemove guard below doesn't prompt on the way out.
  const savedRef = useRef(false);
  // Latest handleSave, so the guard's "Save" option never uses stale state.
  const saveRef = useRef<() => void>(() => {});

  const isDirty =
    !!profile &&
    (name !== (profile.name ?? '') ||
      birthday !== (profile.birthday ?? '') ||
      pickedUri !== null ||
      avatarKey !== (profile.avatarKey ?? null) ||
      keepPhoto !== !!profile.avatarUrl);

  useEffect(() => {
    if (!isDirty) return;
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (savedRef.current) return;
      e.preventDefault();
      Alert.alert('Save changes?', 'You have unsaved changes to your profile.', [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
        { text: 'Save', onPress: () => saveRef.current() },
      ]);
    });
    return unsubscribe;
  }, [navigation, isDirty]);

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
    setPhotoRemoved(true);
  };

  const handleChangeAvatarKey = (key: string) => {
    setAvatarKeyState(key);
    setPickedUri(null);
    setPhotoRemoved(true);
  };

  const removeImage = () => {
    setPickedUri(null);
    setAvatarKeyState(null);
    setPhotoRemoved(true);
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
      // Only delete from storage when the photo was removed outright. A new
      // upload overwrites the same `avatars/<uid>` object, so deleting after
      // a replacement would delete the photo that was just uploaded — which
      // is exactly how new profile photos were vanishing after a reload.
      if (profile.avatarUrl && !avatarUrl) {
        await deleteAvatar(user.uid).catch(() => {});
      }

      await updateProfile({
        name: name.trim(),
        birthday,
        avatarUrl,
        avatarKey: pickedUri || avatarUrl ? null : avatarKey,
      });
      savedRef.current = true;
      router.back();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };
  saveRef.current = handleSave;

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
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
          onChangeText={(text) => setBirthday(formatBirthdayInput(text))}
          placeholder="MM-DD-YYYY"
          keyboardType="number-pad"
          maxLength={10}
        />
      </ScrollView>
      {/* Pinned above the keyboard, and only once there's something to save. */}
      {isDirty && (
        <View style={styles.footer}>
          <Button label="Save Changes" onPress={handleSave} loading={saving} />
        </View>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
});
