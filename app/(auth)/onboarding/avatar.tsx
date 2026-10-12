import { useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { appAlert } from '../../../lib/appAlert';
import { router } from 'expo-router';
import { AvatarPicker } from '../../../components/AvatarPicker';
import { OnboardingScreen } from '../../../components/OnboardingScreen';
import { spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnboarding } from '../../../contexts/OnboardingContext';
import { uploadAvatar } from '../../../lib/avatar';
import { goalsFromText } from '../../../constants/options';

export default function AvatarScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { data, setAvatarKey, setAvatarPhotoUri, clearAvatarPhoto } = useOnboarding();
  const { user, createProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    if (
      !data.experienceLevel ||
      !data.barrier ||
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
        goals: goalsFromText(data.goalText),
        goalText: data.goalText,
        barrier: data.barrier,
        ...(data.barrierOther ? { barrierOther: data.barrierOther } : {}),
        experienceLevel: data.experienceLevel,
        sex: data.sex,
        heightInches: data.heightInches,
        startingWeightLb: data.startingWeightLb,
        units: data.units,
        avatarKey: avatarUrl ? undefined : data.avatarKey ?? undefined,
        avatarUrl,
      });
      // Root layout's auth guard redirects to the tabs home once the
      // profile document exists.
    } catch (e) {
      appAlert('Could not save your profile', e instanceof Error ? e.message : 'Try again.');
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
      step={5}
      totalSteps={5}
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

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  helper: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
