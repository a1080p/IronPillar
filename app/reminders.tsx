import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';
import { requestGymReminderPermissions } from '../lib/gymReminders';
import { DAILY_SLOT_TIMES, ensureNotificationPermission, patternReminderMinutes } from '../lib/reminders';
import {
  DEFAULT_GYM_RADIUS_M,
  DEFAULT_REMINDER_SETTINGS,
  MAX_GYMS,
  loadReminderSettings,
  saveReminderSettings,
  type DailySlot,
  type ReminderSettings,
} from '../lib/reminderSettings';
import { detectWorkoutPatterns } from '../lib/workoutPatterns';

const SLOT_LABELS: Record<DailySlot, string> = {
  morning: 'Morning',
  midday: 'Midday',
  evening: 'Evening',
};
const DELAY_OPTIONS = [5, 10, 15, 20];
const WEEKDAY_PLURALS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

function formatMinutes(minutes: number) {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function RemindersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const { logs } = useWorkoutLogs(user?.uid);
  const patterns = useMemo(() => detectWorkoutPatterns(logs), [logs]);

  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [notificationsAllowed, setNotificationsAllowed] = useState(true);
  const [gymName, setGymName] = useState('');
  const [gymAddress, setGymAddress] = useState('');
  const [addingGym, setAddingGym] = useState(false);

  useEffect(() => {
    loadReminderSettings().then(setSettings);
    ensureNotificationPermission(false).then(setNotificationsAllowed);
  }, []);

  const update = (next: ReminderSettings) => {
    setSettings(next);
    saveReminderSettings(next);
  };

  // Turning any reminder on is the moment to ask for notification access —
  // the user just told us they want them.
  const enableWithPermission = async (next: ReminderSettings) => {
    update(next);
    const granted = await ensureNotificationPermission(true);
    setNotificationsAllowed(granted);
  };

  const toggleSlot = (slot: DailySlot, value: boolean) => {
    const next = { ...settings, dailySlots: { ...settings.dailySlots, [slot]: value } };
    if (value) enableWithPermission(next);
    else update(next);
  };

  const togglePatterns = (value: boolean) => {
    const next = { ...settings, patternReminders: value };
    if (value) enableWithPermission(next);
    else update(next);
  };

  const toggleGyms = async (value: boolean) => {
    if (!value) {
      update({ ...settings, gymReminders: false });
      return;
    }
    const granted = await requestGymReminderPermissions();
    if (!granted) {
      Alert.alert(
        'Location access needed',
        'Gym reminders need location access set to "Always" so Iron Pillar can notice when you arrive at your gym, even when the app is closed.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    setNotificationsAllowed(true);
    update({ ...settings, gymReminders: true });
  };

  const addGym = async () => {
    const name = gymName.trim() || 'My gym';
    if (settings.gyms.length >= MAX_GYMS) {
      Alert.alert('Gym limit reached', `You can save up to ${MAX_GYMS} gyms.`);
      return;
    }
    setAddingGym(true);
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (!fg.granted) {
        Alert.alert('Location access needed', 'Allow location access to save a gym.');
        return;
      }
      let coords: { latitude: number; longitude: number };
      if (gymAddress.trim()) {
        const results = await Location.geocodeAsync(gymAddress.trim());
        if (results.length === 0) {
          Alert.alert("Couldn't find that address", 'Try a fuller address, or leave it blank to use where you are now.');
          return;
        }
        coords = { latitude: results[0].latitude, longitude: results[0].longitude };
      } else {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      }
      update({
        ...settings,
        gyms: [
          ...settings.gyms,
          { id: `gym-${Date.now()}`, name, ...coords, radiusMeters: DEFAULT_GYM_RADIUS_M },
        ],
      });
      setGymName('');
      setGymAddress('');
    } catch {
      Alert.alert("Couldn't get your location", 'Please try again in a moment.');
    } finally {
      setAddingGym(false);
    }
  };

  const removeGym = (id: string) => {
    update({ ...settings, gyms: settings.gyms.filter((g) => g.id !== id) });
  };

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Reminders</Text>

        {!notificationsAllowed ? (
          <Pressable
            style={styles.banner}
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
          >
            <Text style={styles.bannerText}>
              Notifications are turned off for Iron Pillar. Tap to open Settings and allow them.
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily reminders</Text>
          <Text style={styles.sectionHint}>
            A friendly nudge if you haven't logged a workout yet that day. Skipped once you've trained.
          </Text>
          {(Object.keys(SLOT_LABELS) as DailySlot[]).map((slot) => (
            <View key={slot} style={styles.row}>
              <View>
                <Text style={styles.rowLabel}>{SLOT_LABELS[slot]}</Text>
                <Text style={styles.rowSub}>{formatMinutes(DAILY_SLOT_TIMES[slot])}</Text>
              </View>
              <Switch
                value={settings.dailySlots[slot]}
                onValueChange={(v) => toggleSlot(slot, v)}
                trackColor={{ true: colors.primary }}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Habit reminders</Text>
              <Text style={styles.rowSub}>
                Learns your routine — like leg day on Fridays — and reminds you ahead of your usual time.
              </Text>
            </View>
            <Switch
              value={settings.patternReminders}
              onValueChange={togglePatterns}
              trackColor={{ true: colors.primary }}
            />
          </View>
          {settings.patternReminders ? (
            patterns.length > 0 ? (
              patterns.map((p) => (
                <Text key={p.weekday} style={styles.patternItem}>
                  • {WEEKDAY_PLURALS[p.weekday]}
                  {p.focus ? ` · ${p.focus}` : ''} — reminder at {formatMinutes(patternReminderMinutes(p))}
                </Text>
              ))
            ) : (
              <Text style={styles.sectionHint}>
                No routine spotted yet. Train on the same day a few weeks running and it'll show up here.
              </Text>
            )
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>Gym reminders</Text>
              <Text style={styles.rowSub}>
                If you're at one of your gyms and haven't started a workout, we'll remind you.
              </Text>
            </View>
            <Switch
              value={settings.gymReminders}
              onValueChange={toggleGyms}
              trackColor={{ true: colors.primary }}
            />
          </View>

          {settings.gymReminders ? (
            <>
              <Text style={styles.rowSub}>Remind me after</Text>
              <View style={styles.chips}>
                {DELAY_OPTIONS.map((m) => {
                  const selected = settings.gymDelayMinutes === m;
                  return (
                    <Pressable
                      key={m}
                      style={[styles.chip, selected && styles.chipSelected]}
                      accessibilityRole="radio"
                      accessibilityLabel={`${m} minutes`}
                      accessibilityState={{ checked: selected }}
                      onPress={() => update({ ...settings, gymDelayMinutes: m })}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{m} min</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={styles.subheading}>My gyms</Text>
          {settings.gyms.length === 0 ? (
            <Text style={styles.sectionHint}>No gyms saved yet.</Text>
          ) : (
            settings.gyms.map((g) => (
              <View key={g.id} style={styles.row}>
                <Text style={styles.rowLabel}>{g.name}</Text>
                <Pressable
                  onPress={() => removeGym(g.id)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${g.name}`}
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}

          <TextField label="Gym name" placeholder="e.g. Downtown Gym" value={gymName} onChangeText={setGymName} />
          <TextField
            label="Address (optional)"
            placeholder="Leave blank to use where you are now"
            value={gymAddress}
            onChangeText={setGymAddress}
          />
          <Button
            label={gymAddress.trim() ? 'Add gym at this address' : 'Add gym at my current location'}
            variant="outline"
            onPress={addGym}
            loading={addingGym}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  banner: { backgroundColor: colors.warningBg, borderRadius: radii.md, padding: spacing.md },
  bannerText: { color: colors.text, fontSize: typography.sizes.md },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: typography.sizes.body, fontWeight: '700', color: colors.text },
  sectionHint: { fontSize: typography.sizes.md, color: colors.textMuted },
  subheading: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: typography.sizes.body, color: colors.primary, fontWeight: '600' },
  rowSub: { fontSize: typography.sizes.md, color: colors.textMuted },
  patternItem: { fontSize: typography.sizes.md, color: colors.text },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextSelected: { color: colors.textOnDark },
  remove: { color: colors.danger, fontWeight: '600' },
});
