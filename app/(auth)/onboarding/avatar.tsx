import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { AvatarPicker } from '../../../components/AvatarPicker';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { colors, spacing, typography } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { uploadAvatar } from '../../../lib/avatar';

export default function AvatarScreen() {
  const { data, setAvatarKey, setAvatarPhotoUri, clearAvatarPhoto } = useOnboarding();
  const { user, createProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    if (
      !data.experienceLevel ||
      !data.sex ||
      data.heightInches == null ||
      data.startingWeightLb == null ||
      !user
    ) {
      return;
    }
    setSaving(true);
    try {
      const avatarUrl = data.avatarPhotoUri
        ? await uploadAvatar(user.uid, data.avatarPhotoUri)
        : undefined;
      await createProfile({
        name: data.name,
        birthday: data.birthday,
        goals: data.goals,
        experienceLevel: data.experienceLevel,
        sex: data.sex,
        heightInches: data.heightInches,
        startingWeightLb: data.startingWeightLb,
        avatarKey: avatarUrl ? undefined : data.avatarKey ?? undefined,
        avatarUrl,
      });
      // Root layout's auth guard redirects to the tabs home once the
      // profile document exists.
    } catch (e) {
      Alert.alert('Could not save your profile', e instanceof Error ? e.message : 'Try again.');
      setSaving(false);
    }
  };

  return (
    <OnboardingScreen
      heading="Pick Your Avatar"
      onBack={() => router.back()}
      onNext={handleFinish}
      nextLabel={saving ? 'Saving...' : 'Finish'}
      nextDisabled={saving}
      step={4}
      totalSteps={4}
    >
      <AvatarPicker
        photoUrl={data.avatarPhotoUri}
        avatarKey={data.avatarKey}
        onPickedPhoto={setAvatarPhotoUri}
        onRemovePhoto={clearAvatarPhoto}
        onChangeAvatarKey={setAvatarKey}
        showRemove
      />
      <Text style={styles.helper}>
        Pick one now or skip — you can always change it later from your profile.
      </Text>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  helper: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
