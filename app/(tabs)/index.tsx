import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ActionSheet } from '../../components/ActionSheet';
import { TopBar } from '../../components/TopBar';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutTemplates } from '../../hooks/useWorkoutTemplates';
import {
  deleteCustomWorkout,
  duplicateCustomWorkout,
  useCustomWorkouts,
} from '../../hooks/useCustomWorkouts';
import type { CustomWorkout, WorkoutTemplate } from '../../types/models';

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { templates, loading } = useWorkoutTemplates();
  const { customWorkouts } = useCustomWorkouts(user?.uid);

  const presets = templates.filter((t) => t.category === 'preset');
  const quickStarts = templates.filter((t) => t.category === 'quick_start');
  const recommended =
    presets.find((t) => profile?.goals.some((g) => t.tags.includes(g))) ?? presets[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>
          {profile?.name ? `${profile.name}, Lets Get Started` : 'Lets Get Started'}
        </Text>

        {loading && <Text style={styles.note}>Loading workouts...</Text>}

        {!loading && !recommended && (
          <Text style={styles.note}>
            No workouts yet — seed workoutTemplates in Firestore to see them here.
          </Text>
        )}

        {recommended && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Todays Recommended Workout:</Text>
            <Pressable
              style={styles.recommendedCard}
              onPress={() => router.push(`/workout/${recommended.id}`)}
            >
              <Text style={styles.recommendedTitle}>{recommended.name}</Text>
              <View style={styles.recommendedMetaRow}>
                <Text style={styles.recommendedMeta}>{recommended.durationMinutes} Minutes</Text>
                {recommended.equipmentRequired && (
                  <Text style={styles.recommendedMeta}>Equipment Required</Text>
                )}
              </View>
            </Pressable>
          </View>
        )}

        {quickStarts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Quick Start:</Text>
            <Text style={styles.sectionSubLabel}>Jump into a fast workout</Text>
            <View style={styles.quickRow}>
              {quickStarts.map((w) => (
                <QuickStartCard key={w.id} workout={w} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>My Workouts:</Text>
          <Text style={styles.sectionSubLabel}>Workouts you've built yourself</Text>
          <View style={styles.quickRow}>
            {customWorkouts.map((w) => (
              <QuickStartCard key={w.id} workout={w} editable />
            ))}
            <Pressable style={styles.createCard} onPress={() => router.push('/workout/new')}>
              <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
              <Text style={styles.createCardTitle}>Create Your Own</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickStartCard({
  workout,
  editable = false,
}: {
  workout: WorkoutTemplate | CustomWorkout;
  editable?: boolean;
}) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const confirmDelete = () => {
    Alert.alert('Delete workout', `Delete "${workout.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await deleteCustomWorkout(user.uid, workout.id);
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const handleDuplicate = async () => {
    if (!user) return;
    try {
      await duplicateCustomWorkout(user.uid, workout as CustomWorkout);
    } catch (e) {
      Alert.alert('Could not duplicate', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <Pressable style={styles.quickCard} onPress={() => router.push(`/workout/${workout.id}`)}>
      <View style={styles.quickCardHeader}>
        <Text style={styles.quickCardTitle} numberOfLines={2}>
          {workout.name}
        </Text>
        {editable && (
          <Pressable hitSlop={8} onPress={() => setMenuOpen(true)} style={styles.kebab}>
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textOnDark} />
          </Pressable>
        )}
      </View>
      <Text style={styles.quickCardMeta}>{workout.durationMinutes} Minutes</Text>

      {editable && (
        <ActionSheet
          visible={menuOpen}
          title={workout.name}
          onClose={() => setMenuOpen(false)}
          actions={[
            {
              label: 'Edit details',
              icon: 'create-outline',
              onPress: () => router.push(`/workout/${workout.id}/edit`),
            },
            { label: 'Duplicate', icon: 'copy-outline', onPress: handleDuplicate },
            {
              label: 'Delete',
              icon: 'trash-outline',
              destructive: true,
              onPress: confirmDelete,
            },
          ]}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.xl },
  note: { color: colors.textMuted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionLabel: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  sectionSubLabel: { color: colors.textMuted, marginBottom: spacing.md },
  recommendedCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  recommendedTitle: { color: colors.textOnDark, fontSize: typography.sizes.md, fontWeight: '700', marginBottom: spacing.md },
  recommendedMetaRow: { flexDirection: 'row', gap: spacing.md },
  recommendedMeta: { color: colors.textOnDark, fontSize: typography.sizes.small },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.md },
  quickCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '48%',
    minHeight: 90,
    justifyContent: 'space-between',
  },
  quickCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  quickCardTitle: {
    flex: 1,
    color: colors.textOnDark,
    fontWeight: '700',
    fontSize: typography.sizes.small,
  },
  kebab: { marginRight: -4, marginTop: -2, padding: 2 },
  quickCardMeta: { color: colors.textOnDark, fontSize: typography.sizes.small },
  createCard: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    padding: spacing.md,
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '48%',
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  createCardTitle: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: typography.sizes.small,
    textAlign: 'center',
  },
});
