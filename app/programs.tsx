import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { PROGRAMS, suggestedProgram, type Program } from '../data/programs';
import { appAlert } from '../lib/appAlert';

// Pick a training program. Starting one also sets the weekly goal to its
// number of days, since that's how many workouts a week it's built for.
export default function ProgramsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { profile, updateProfile } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const activeId = profile?.programId ?? null;
  const suggested = suggestedProgram(profile?.experienceLevel, profile?.barrier);

  // Suggested first, then the rest in their usual order.
  const ordered = [suggested, ...PROGRAMS.filter((p) => p.id !== suggested.id)];

  const start = async (program: Program) => {
    setSaving(program.id);
    try {
      await updateProfile({ programId: program.id, weeklyGoal: program.daysPerWeek });
      appAlert(
        `${program.name} started`,
        `Your weekly goal is now ${program.daysPerWeek} workouts. If you've already worked out this week, it takes effect next Monday.`
      );
      router.back();
    } catch (e) {
      appAlert('Could not start program', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(null);
    }
  };

  const stop = () =>
    appAlert('Stop this program?', 'Home goes back to a daily recommended workout. Your history is kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop Program',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateProfile({ programId: null });
          } catch (e) {
            appAlert('Could not stop program', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Programs
        </Text>
        <Text style={styles.intro}>
          A program repeats the same days every week, so you can see your lifts go up. Do the days
          in order, whenever suits you. Rest days are built in.
        </Text>

        {ordered.map((program) => {
          const active = program.id === activeId;
          return (
            <View key={program.id} style={[styles.card, active && styles.cardActive]}>
              {(active || (program.id === suggested.id && !activeId)) && (
                <Text style={styles.flag}>{active ? 'YOUR PROGRAM' : 'SUGGESTED FOR YOU'}</Text>
              )}
              <Text style={styles.name}>{program.name}</Text>
              <Text style={styles.meta}>
                {program.level} · {program.daysPerWeek} days a week · {program.equipment}
              </Text>
              <Text style={styles.summary}>{program.summary}</Text>
              {program.days.map((day, i) => (
                <Pressable
                  key={day.id}
                  style={styles.dayRow}
                  onPress={() => router.push(`/workout/${day.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${i + 1}, ${day.name}, ${day.durationMinutes} minutes. View exercises`}
                >
                  <Text style={styles.dayIndex}>{i + 1}</Text>
                  <View style={styles.dayText}>
                    <Text style={styles.dayName}>{day.name}</Text>
                    <Text style={styles.dayMeta} numberOfLines={1}>
                      {day.exercises.map((e) => e.name).join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
              <View style={styles.cardFooter}>
                {active ? (
                  <Button label="Stop Program" variant="outline" onPress={stop} />
                ) : (
                  <Button
                    label={activeId ? 'Switch to This Program' : 'Start Program'}
                    onPress={() => start(program)}
                    loading={saving === program.id}
                    disabled={!!saving}
                  />
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: 60 },
    heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
    intro: { color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
    card: {
      borderWidth: 1.5,
      borderColor: colors.divider,
      borderRadius: radii.md,
      padding: spacing.md,
      marginBottom: spacing.lg,
    },
    cardActive: { borderColor: colors.primary },
    flag: { color: colors.accentFlameText, fontWeight: '800', fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.xs },
    name: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary },
    meta: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2, marginBottom: spacing.sm },
    summary: { color: colors.text, lineHeight: 20, marginBottom: spacing.md },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
    dayIndex: { width: 18, textAlign: 'center', fontWeight: '800', color: colors.primary },
    dayText: { flex: 1 },
    dayName: { fontWeight: '700', color: colors.text },
    dayMeta: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
    cardFooter: { marginTop: spacing.md },
  });
