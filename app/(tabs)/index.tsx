import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionSheet } from '../../components/ActionSheet';
import { AppTour, type TourStep } from '../../components/AppTour';
import { TopBar } from '../../components/TopBar';
import { colors, radii, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutTemplates } from '../../hooks/useWorkoutTemplates';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import {
  deleteCustomWorkout,
  duplicateCustomWorkout,
  useCustomWorkouts,
} from '../../hooks/useCustomWorkouts';
import { formatShortDate } from '../../lib/dates';
import { pickQuickStartWorkouts, pickRecommendedWorkout } from '../../lib/recommendations';
import { dedupeRecentWorkouts } from '../../lib/recentWorkouts';
import type { CustomWorkout, OutdoorActivityType, WorkoutTemplate } from '../../types/models';

const OUTDOOR_ACTIVITY_TYPES: OutdoorActivityType[] = ['walk', 'run', 'bike'];
const OUTDOOR_ACTIVITY_LABELS: Record<OutdoorActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
  bike: 'Bike Ride',
};

const QUICK_START_COUNT = 3;

const TOUR_SEEN_KEY_PREFIX = 'tour_seen_';
const NAV_BAR_HEIGHT = 64;

export default function HomeScreen() {
  const { user, profile } = useAuth();
  const { templates, loading } = useWorkoutTemplates();
  const { customWorkouts } = useCustomWorkouts(user?.uid);
  const { logs } = useWorkoutLogs(user?.uid);
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const recommendedRef = useRef<View>(null);
  const quickStartsRef = useRef<View>(null);
  const myWorkoutsRef = useRef<View>(null);

  const [tourVisible, setTourVisible] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem(`${TOUR_SEEN_KEY_PREFIX}${user.uid}`);
      if (!cancelled && !seen) {
        // Let the first layout pass finish before measuring anything.
        setTimeout(() => {
          if (!cancelled) setTourVisible(true);
        }, 500);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const finishTour = () => {
    setTourVisible(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    if (user) AsyncStorage.setItem(`${TOUR_SEEN_KEY_PREFIX}${user.uid}`, '1');
  };

  const measureRef = (ref: RefObject<View | null>) =>
    new Promise<{ x: number; y: number; width: number; height: number } | null>((resolve) => {
      if (!ref.current) {
        resolve(null);
        return;
      }
      ref.current.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
    });

  const scrollToTopAndMeasure = async (ref: RefObject<View | null>) => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    await new Promise((r) => setTimeout(r, 350));
    return measureRef(ref);
  };

  const scrollToEndAndMeasure = async (ref: RefObject<View | null>) => {
    scrollRef.current?.scrollToEnd({ animated: true });
    await new Promise((r) => setTimeout(r, 350));
    return measureRef(ref);
  };

  const getNavBarRect = () => {
    const screen = Dimensions.get('window');
    const bottom = Math.max(spacing.lg, insets.bottom);
    return {
      x: spacing.lg,
      y: screen.height - bottom - NAV_BAR_HEIGHT,
      width: screen.width - spacing.lg * 2,
      height: NAV_BAR_HEIGHT,
    };
  };

  // Both re-derive from `logs` (a live Firestore listener) on every render,
  // so picks update the instant a workout is completed — see lib/recommendations.
  const recommended = useMemo(
    () => pickRecommendedWorkout(templates, logs, profile, user?.uid),
    [templates, logs, profile, user?.uid]
  );
  const quickStarts = useMemo(
    () =>
      pickQuickStartWorkouts(
        templates,
        logs,
        profile,
        user?.uid,
        QUICK_START_COUNT,
        recommended ? [recommended.id] : []
      ),
    [templates, logs, profile, user?.uid, recommended]
  );
  const recentWorkouts = useMemo(() => dedupeRecentWorkouts(logs), [logs]);

  const tourSteps = useMemo(() => {
    const steps: TourStep[] = [];

    if (recommended) {
      steps.push({
        key: 'recommended',
        title: "Today's Recommended Workout",
        description: 'We pick a workout for you each day based on your goals and history — tap it to jump right in.',
        getRect: () => scrollToTopAndMeasure(recommendedRef),
      });
    }

    if (quickStarts.length > 0) {
      steps.push({
        key: 'quickStarts',
        title: 'Quick Start',
        description: 'Short on time? These are fast workouts you can start with one tap.',
        getRect: () => scrollToTopAndMeasure(quickStartsRef),
      });
    }

    steps.push({
      key: 'myWorkouts',
      title: 'My Workouts',
      description: 'Track outdoor walks, runs, and rides, or build and save your own custom workouts here.',
      getRect: () => scrollToEndAndMeasure(myWorkoutsRef),
    });

    steps.push({
      key: 'navBar',
      title: 'Get Around the App',
      description: 'Use the bar below to browse workouts, check your progress, connect with friends, and manage your profile.',
      getRect: () => getNavBarRect(),
    });

    return steps;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommended, quickStarts, insets.bottom]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopBar />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
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
          <View style={styles.section} ref={recommendedRef}>
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

        {recentWorkouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recent Workouts:</Text>
            <Text style={styles.sectionSubLabel}>Jump back into something you've done before</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentRow}
            >
              {recentWorkouts.map((log) => (
                <Pressable
                  key={log.workoutId}
                  style={styles.recentCard}
                  onPress={() => router.push(`/workout/${log.workoutId}`)}
                >
                  <Text style={styles.quickCardTitle} numberOfLines={2}>
                    {log.workoutName}
                  </Text>
                  <Text style={styles.quickCardMeta}>{formatShortDate(log.completedAt)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {quickStarts.length > 0 && (
          <View style={styles.section} ref={quickStartsRef}>
            <Text style={styles.sectionLabel}>Quick Start:</Text>
            <Text style={styles.sectionSubLabel}>Jump into a fast workout</Text>
            <View style={styles.quickRow}>
              {quickStarts.map((w) => (
                <QuickStartCard key={w.id} workout={w} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section} ref={myWorkoutsRef}>
          <Text style={styles.sectionLabel}>My Workouts:</Text>
          <View style={styles.quickRow}>
            {OUTDOOR_ACTIVITY_TYPES.map((activityType) => (
              <OutdoorActivityCard key={activityType} activityType={activityType} />
            ))}
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

      <AppTour visible={tourVisible} steps={tourSteps} onFinish={finishTour} />
    </SafeAreaView>
  );
}

function OutdoorActivityCard({ activityType }: { activityType: OutdoorActivityType }) {
  return (
    <Pressable
      style={styles.quickCard}
      onPress={() => router.push({ pathname: '/workout/outdoor/track', params: { activityType } })}
    >
      <View style={styles.quickCardHeader}>
        <Ionicons
          name={activityType === 'bike' ? 'bicycle' : 'walk'}
          size={16}
          color={colors.textOnDark}
        />
        <Text style={styles.quickCardTitle} numberOfLines={2}>
          {OUTDOOR_ACTIVITY_LABELS[activityType]}
        </Text>
      </View>
    </Pressable>
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
  recentRow: { gap: spacing.md, paddingRight: spacing.lg },
  recentCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    width: 150,
    minHeight: 90,
    justifyContent: 'space-between',
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
