import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { TopBar } from '../../components/TopBar';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { BROWSE_CATEGORIES } from '../../data/browseWorkoutTemplates';
import { useWorkoutTemplates } from '../../hooks/useWorkoutTemplates';
import type { WorkoutTemplate } from '../../types/models';

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Cardio: 'heart',
  'Strength Training': 'barbell',
  HIIT: 'flash',
  Yoga: 'body',
  'Pilates & Core': 'ellipse',
  'Group Fitness Classes': 'people',
  Swimming: 'water',
  Cycling: 'bicycle',
  'Sports & Outdoor': 'basketball',
  'Stretching & Recovery': 'leaf',
};

export default function BrowseScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { templates, loading } = useWorkoutTemplates();
  const browseWorkouts = templates.filter((t) => t.category === 'browse');

  const sections = BROWSE_CATEGORIES.map((category) => ({
    category,
    workouts: browseWorkouts.filter((w) => w.browseCategory === category),
  })).filter((s) => s.workouts.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Browse Workouts</Text>
        <Text style={styles.subheading}>Explore workouts across every style of training</Text>

        {loading && <Text style={styles.note}>Loading workouts...</Text>}

        {!loading && sections.length === 0 && (
          <Text style={styles.note}>
            No workouts yet — seed workoutTemplates in Firestore to see them here.
          </Text>
        )}

        {sections.map(({ category, workouts }) => (
          <View key={category} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons
                name={CATEGORY_ICONS[category] ?? 'fitness'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.sectionLabel}>{category}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
            >
              {workouts.map((w) => (
                <BrowseCard key={w.id} workout={w} />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function BrowseCard({ workout }: { workout: WorkoutTemplate }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/workout/${workout.id}`)}>
      <Text style={styles.cardTitle} numberOfLines={2}>
        {workout.name}
      </Text>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardMeta}>{workout.durationMinutes} Min</Text>
        {workout.equipmentRequired && (
          <Ionicons name="barbell-outline" size={13} color={colors.textOnDark} />
        )}
      </View>
      <Text style={styles.cardCalories}>{workout.caloriesRangeLabel}</Text>
    </Pressable>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subheading: { color: colors.textMuted, marginBottom: spacing.xl },
  note: { color: colors.textMuted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionLabel: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.md },
  row: { gap: spacing.md, paddingRight: spacing.lg },
  card: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    width: 160,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: colors.textOnDark,
    fontWeight: '700',
    fontSize: typography.sizes.small,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  cardMeta: { color: colors.textOnDark, fontSize: typography.sizes.small },
  cardCalories: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
});
