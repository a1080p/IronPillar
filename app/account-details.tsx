import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { appAlert } from '../lib/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { SelectableOption } from '../components/SelectableOption';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import {
  BARRIER_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_EXAMPLES,
  GOAL_TEXT_MAX,
  goalsFromText,
} from '../constants/options';
import { containsBlockedTerm } from '../constants/moderation';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { deleteAccount } from '../lib/account';
import { ageFromBirthday, formatBirthdayInput, MIN_AGE } from '../lib/dates';
import type { Barrier, ExperienceLevel, FitnessGoal } from '../types/models';

const LEGACY_GOAL_TEXT: Record<FitnessGoal, string> = {
  lose_weight: 'Lose weight',
  build_strength: 'Build strength',
  build_endurance: 'Build endurance',
};

export default function AccountDetailsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile, updateProfile, signOut, setDeletingAccount, changePassword } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  // Same questions as onboarding: the goal in their own words, experience,
  // and what's holding them back.
  // Profiles from before the open-response goal only have goal tags; start
  // from those so an unrelated edit (like a name fix) can still be saved.
  const [goalText, setGoalText] = useState(
    profile?.goalText ??
      (profile?.goals ?? [])
        .map((g) => LEGACY_GOAL_TEXT[g])
        .join(', ')
  );
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | undefined>(
    profile?.experienceLevel
  );
  const [barrier, setBarrier] = useState<Barrier | undefined>(profile?.barrier);
  const [barrierOther, setBarrierOther] = useState(profile?.barrierOther ?? '');
  const [saving, setSaving] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteUsernameInput, setDeleteUsernameInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedGoal = goalText.trim();
    const trimmedOther = barrier === 'other' ? barrierOther.trim() : '';
    const age = ageFromBirthday(birthday);
    if (!trimmedName || !experienceLevel || trimmedGoal.length < 3) {
      appAlert('Missing info', 'Fill in your name, your goal, and an experience level.');
      return;
    }
    if (age == null) {
      appAlert('Check your birthday', 'Enter a real date as MM-DD-YYYY.');
      return;
    }
    if (age < MIN_AGE) {
      appAlert('Check your birthday', `You need to be at least ${MIN_AGE} to use Iron Pillar.`);
      return;
    }
    if (barrier === 'other' && !trimmedOther) {
      appAlert('Missing info', 'Tell us what holds you back, or pick another option.');
      return;
    }
    if ([trimmedName, trimmedGoal, trimmedOther].some(containsBlockedTerm)) {
      appAlert('Please reword', 'Your name, goal, or answer has words that are not allowed.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: trimmedName,
        birthday,
        goalText: trimmedGoal,
        goals: goalsFromText(trimmedGoal),
        experienceLevel,
        ...(barrier ? { barrier, barrierOther: trimmedOther } : {}),
      });
      appAlert('Saved', 'Your account details have been updated.');
    } catch (e) {
      appAlert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  // Email/password accounts can change their password here; Apple and Google
  // sign-ups have no Iron Pillar password at all.
  const hasPassword = !!user?.providerData.some((p) => p.providerId === 'password');
  const socialProvider = user?.providerData.some((p) => p.providerId === 'apple.com')
    ? 'Apple'
    : 'Google';
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const resetPasswordForm = () => {
    setChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (!currentPassword || !newPassword) {
      setPasswordError('Enter your current password and a new one.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Your new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('Choose a password different from your current one.');
      return;
    }
    setUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      resetPasswordForm();
      appAlert('Password updated', 'Use your new password next time you log in.');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Could not change your password. Try again.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const usernameMatches = deleteUsernameInput.trim() === profile?.username;

  const handleDeleteAccount = () => {
    appAlert(
      'Are you sure?',
      'This permanently deletes your profile, workout history, badges, and friends. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            setDeletingAccount(true);
            try {
              await deleteAccount();
              await signOut().catch(() => {});
              router.replace('/welcome');
            } catch (e) {
              appAlert('Could not delete account', e instanceof Error ? e.message : 'Try again.');
              setDeleting(false);
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Account Details</Text>

        <View style={styles.readOnlyBlock}>
          <View>
            <Text style={styles.readOnlyLabel}>Email</Text>
            <Text style={styles.readOnlyValue}>{user?.email}</Text>
          </View>
          <View>
            <Text style={styles.readOnlyLabel}>Username</Text>
            <Text style={styles.readOnlyValue}>@{profile?.username}</Text>
          </View>
        </View>

        <View style={styles.signInBlock}>
          <Text style={styles.sectionLabel}>Sign-in</Text>
          {!hasPassword ? (
            <Text style={styles.signInNote}>
              You sign in with {socialProvider}, so there's no Iron Pillar password to change.
              {socialProvider === 'Apple'
                ? ' Manage it in your iPhone Settings under your name → Sign in with Apple.'
                : ' Manage it in your Google Account settings.'}
            </Text>
          ) : !changingPassword ? (
            <Button
              label="Change Password"
              variant="outline"
              onPress={() => setChangingPassword(true)}
            />
          ) : (
            <View style={styles.passwordForm}>
              <TextField
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Current password"
              />
              <TextField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="At least 6 characters"
              />
              <TextField
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Re-enter your new password"
              />
              {passwordError && <Text style={styles.passwordError}>{passwordError}</Text>}
              <View style={styles.dangerButtonRow}>
                <Button label="Cancel" variant="outline" onPress={resetPasswordForm} />
                <Button label="Update" onPress={handleChangePassword} loading={updatingPassword} />
              </View>
            </View>
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

        <View style={styles.optionBlock}>
          <Text style={styles.sectionLabel}>Your goal</Text>
          <TextInput
            style={styles.goalInput}
            value={goalText}
            onChangeText={setGoalText}
            placeholder="e.g. Get strong enough to deadlift my body weight"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={GOAL_TEXT_MAX}
            accessibilityLabel="Your goal"
          />
          <View style={styles.chips}>
            {GOAL_EXAMPLES.map((example) => (
              <Pressable
                key={example}
                style={styles.chip}
                onPress={() => setGoalText(example)}
                accessibilityRole="button"
                accessibilityLabel={`Use goal: ${example}`}
              >
                <Text style={styles.chipText}>{example}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.optionBlock}>
          <Text style={styles.sectionLabel}>Experience Level</Text>
          {EXPERIENCE_OPTIONS.map((level) => (
            <SelectableOption
              key={level.value}
              label={level.label}
              selected={experienceLevel === level.value}
              onPress={() => setExperienceLevel(level.value)}
            />
          ))}
        </View>

        <View style={styles.optionBlock}>
          <Text style={styles.sectionLabel}>What's holding you back the most?</Text>
          {BARRIER_OPTIONS.map((option) => (
            <SelectableOption
              key={option.value}
              label={option.label}
              selected={barrier === option.value}
              onPress={() => setBarrier(option.value)}
            />
          ))}
          {barrier === 'other' && (
            <TextInput
              style={styles.otherInput}
              value={barrierOther}
              onChangeText={setBarrierOther}
              placeholder="Tell us what gets in the way"
              placeholderTextColor={colors.textMuted}
              maxLength={GOAL_TEXT_MAX}
              accessibilityLabel="What's holding you back"
            />
          )}
        </View>

        <Button label="Save Changes" onPress={handleSave} loading={saving} />

        <View style={styles.dangerZone}>
          <Text style={styles.dangerHeading}>Danger Zone</Text>

          {!confirmingDelete ? (
            <Button
              label="Delete Account"
              variant="outline"
              onPress={() => setConfirmingDelete(true)}
            />
          ) : (
            <View style={styles.dangerConfirmBlock}>
              <Text style={styles.dangerWarning}>
                This permanently deletes your profile, workout history, badges, and friends. This
                cannot be undone.
              </Text>
              <TextField
                label={`Type "${profile?.username}" to confirm`}
                value={deleteUsernameInput}
                onChangeText={setDeleteUsernameInput}
                autoCapitalize="none"
                placeholder={profile?.username}
              />
              <View style={styles.dangerButtonRow}>
                <Button
                  label="Cancel"
                  variant="outline"
                  onPress={() => {
                    setConfirmingDelete(false);
                    setDeleteUsernameInput('');
                  }}
                />
                <Button
                  label={deleting ? 'Deleting...' : 'Delete Account'}
                  onPress={handleDeleteAccount}
                  disabled={!usernameMatches || deleting}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>
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
  readOnlyBlock: { gap: spacing.md },
  readOnlyLabel: { color: colors.textMuted, fontSize: typography.sizes.small },
  readOnlyValue: { color: colors.text, fontWeight: '600' },
  optionBlock: { gap: spacing.md },
  signInBlock: { gap: spacing.md },
  goalInput: {
    minHeight: 88,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.sizes.body,
    textAlignVertical: 'top',
  },
  otherInput: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.sizes.body,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: { color: colors.text, fontSize: typography.sizes.small, fontWeight: '600' },
  signInNote: { color: colors.textMuted, fontSize: typography.sizes.small },
  passwordForm: { gap: spacing.md },
  passwordError: { color: colors.danger },
  sectionLabel: {
    fontWeight: '700',
    color: colors.primary,
  },
  dangerZone: {
    borderWidth: 1.5,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  dangerHeading: { fontWeight: '700', color: colors.danger },
  dangerConfirmBlock: { gap: spacing.md },
  dangerWarning: { color: colors.text },
  dangerButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
