import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../lib/appAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { SelectableOption } from '../components/SelectableOption';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { GOAL_OPTIONS, EXPERIENCE_OPTIONS } from '../constants/options';
import { useAuth } from '../contexts/AuthContext';
import { router } from 'expo-router';
import { deleteAccount } from '../lib/account';
import type { ExperienceLevel, FitnessGoal } from '../types/models';

export default function AccountDetailsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile, updateProfile, signOut, setDeletingAccount, changePassword } = useAuth();
  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [goals, setGoals] = useState<FitnessGoal[]>(profile?.goals ?? []);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | undefined>(
    profile?.experienceLevel
  );
  const [saving, setSaving] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteUsernameInput, setDeleteUsernameInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const toggleGoal = (goal: FitnessGoal) => {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
  };

  const handleSave = async () => {
    if (!name.trim() || !experienceLevel || goals.length === 0) {
      appAlert('Missing info', 'Fill in your name, at least one goal, and an experience level.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), birthday, goals, experienceLevel });
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
          onChangeText={setBirthday}
          placeholder="MM-DD-YYYY"
        />

        <View style={styles.optionBlock}>
          <Text style={styles.sectionLabel}>Goals</Text>
          {GOAL_OPTIONS.map((goal) => (
            <SelectableOption
              key={goal.value}
              label={goal.label}
              selected={goals.includes(goal.value)}
              onPress={() => toggleGoal(goal.value)}
            />
          ))}
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
