import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { SelectableOption } from '../components/SelectableOption';
import { colors, radii, spacing, typography } from '../constants/theme';
import { GOAL_OPTIONS, EXPERIENCE_OPTIONS } from '../constants/options';
import { useAuth } from '../contexts/AuthContext';
import { deleteAccount } from '../lib/account';
import type { ExperienceLevel, FitnessGoal } from '../types/models';

export default function AccountDetailsScreen() {
  const { user, profile, updateProfile, signOut } = useAuth();
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
      Alert.alert('Missing info', 'Fill in your name, at least one goal, and an experience level.');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), birthday, goals, experienceLevel });
      Alert.alert('Saved', 'Your account details have been updated.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const usernameMatches = deleteUsernameInput.trim() === profile?.username;

  const handleDeleteAccount = () => {
    Alert.alert(
      'Are you sure?',
      'This permanently deletes your profile, workout history, badges, and friends. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await signOut();
            } catch (e) {
              Alert.alert('Could not delete account', e instanceof Error ? e.message : 'Try again.');
              setDeleting(false);
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

const styles = StyleSheet.create({
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
  sectionLabel: {
    fontWeight: '700',
    color: colors.primary,
  },
  dangerZone: {
    borderWidth: 1.5,
    borderColor: '#D33',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  dangerHeading: { fontWeight: '700', color: '#D33' },
  dangerConfirmBlock: { gap: spacing.md },
  dangerWarning: { color: colors.text },
  dangerButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});
