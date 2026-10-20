import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '../../lib/appAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionSheet } from '../../components/ActionSheet';
import { AppTour, type TourStep } from '../../components/AppTour';
import { TopBar } from '../../components/TopBar';
import { radii, spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePurchases } from '../../contexts/PurchasesContext';
import { FREE_CUSTOM_WORKOUT_LIMIT } from '../../constants/pro';
import { useWorkoutTemplates } from '../../hooks/useWorkoutTemplates';
import { useWorkoutLogs } from '../../hooks/useWorkoutLogs';
import {
  deleteCustomWorkout,
  duplicateCustomWorkout,
  useCustomWorkouts,
} from '../../hooks/useCustomWorkouts';
import { formatShortDate } from '../../lib/dates';
import { pickQuickStartWorkouts } from '../../lib/recommendations';
import { useRecommendedWorkout } from '../../hooks/useRecommendedWorkout';
import { useWeekProgress } from '../../hooks/useActiveStreak';
import { nextProgramDay, programById, suggestedProgram } from '../../data/programs';
import { FlameIcon } from '../../components/icons/BrandIcons';
import { dedupeRecentWorkouts, hideRecent, loadHiddenRecents } from '../../lib/recentWorkouts';
import { deleteWorkoutLog } from '../../lib/workoutCompletion';
import type { CustomWorkout, OutdoorActivityType, UnitSystem, WorkoutLog, WorkoutTemplate } from '../../types/models';
import { RankEmblem } from '../../components/RankEmblem';
import { ExerciseFormThumb } from '../../components/ExerciseForm';
import { ProgressBar } from '../../components/ProgressBar';
import { rankProgress } from '../../constants/rank';
import { offsetDateString, todayDateString } from '../../constants/gamification';
import { canonicalExerciseName, findCatalogExercise } from '../../data/exercises';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { useUnits } from '../../hooks/useUnits';
import { personalRecords } from '../../lib/workoutStats';
import { lbToDisplay, weightUnit } from '../../lib/units';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const PR_RECENT_DAYS = 14;

// A greeting that knows where the week stands.
function greeting(
  name: string | undefined,
  hour: number,
  week: { count: number; goal: number; goalHit: boolean },
  trainedToday: boolean,
  todayName?: string
) {
  const first = name?.split(' ')[0];
  const hello = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const who = first ? `${hello}, ${first}.` : `${hello}.`;
  if (trainedToday) return `${who} Nice work today.`;
  if (week.goalHit) return `${who} Weekly goal hit. Anything now is a bonus.`;
  if (todayName) return `${who} ${todayName} today.`;
  return `${who} ${week.count} of ${week.goal} this week.`;
}

// "Last time" for a workout: the first exercise's sets from the most recent
// log of it, e.g. "Goblet Squat 3 × 8 at 25 lb".
function lastTimeLine(logs: WorkoutLog[], workoutId: string, units: UnitSystem) {
  const log = logs.find((l) => l.workoutId === workoutId);
  if (!log) return null;
  for (const e of log.exercises) {
    const done = e.sets.filter((set) => set.reps != null || set.durationSeconds != null);
    if (done.length === 0) continue;
    const top = done[0];
    if (top.durationSeconds != null) return `${e.exerciseName} ${done.length} × ${top.durationSeconds}s`;
    const w = top.weight ? ` at ${lbToDisplay(top.weight, units)} ${weightUnit(units)}` : '';
    return `${e.exerciseName} ${done.length} × ${top.reps}${w}`;
  }
  return null;
}


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
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, profile } = useAuth();
  const { templates, loading } = useWorkoutTemplates();
  const { customWorkouts } = useCustomWorkouts(user?.uid);
  const { isPro } = usePurchases();
  const atCustomLimit = !isPro && customWorkouts.length >= FREE_CUSTOM_WORKOUT_LIMIT;
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
  const { recommended, ready: recommendationReady } = useRecommendedWorkout(
    templates,
    logs,
    profile,
    user?.uid
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
  const week = useWeekProgress();
  const units = useUnits();
  const { items: feed } = useActivityFeed(user?.uid);
  const rp = rankProgress(profile?.xp);
  const program = programById(profile?.programId);
  const programNext = useMemo(() => (program ? nextProgramDay(program, logs) : null), [program, logs]);
  const suggested = suggestedProgram(profile?.experienceLevel, profile?.barrier);

  const [hiddenRecents, setHiddenRecents] = useState<Record<string, string>>({});
  const [recentMenuLog, setRecentMenuLog] = useState<WorkoutLog | null>(null);
  useEffect(() => {
    if (user?.uid) loadHiddenRecents(user.uid).then(setHiddenRecents);
  }, [user?.uid]);
  const recentWorkouts = useMemo(
    () => dedupeRecentWorkouts(logs, 5, hiddenRecents),
    [logs, hiddenRecents]
  );

  const todayWorkout: WorkoutTemplate | null = programNext?.day ?? recommended ?? null;
  const todayLastTime = todayWorkout ? lastTimeLine(logs, todayWorkout.id, units) : null;

  // Monday-to-Sunday dots: a day is filled when a workout that counts
  // toward the week (some XP, or 10+ minutes) was logged on it.
  const todayStr = todayDateString();
  const trainedDays = new Set(
    logs
      .filter((l) => !l.imported && (l.xpEarned > 0 || l.durationSeconds >= 600))
      .map((l) => todayDateString(new Date(l.completedAt)))
  );
  const weekDays = WEEKDAY_LABELS.map((label, i) => {
    const date = offsetDateString(week.weekStart, i);
    return { label, date, trained: trainedDays.has(date), isToday: date === todayStr, future: date > todayStr };
  });
  const trainedToday = trainedDays.has(todayStr);

  // A personal record from the last two weeks, if there is one.
  const recentPr = useMemo(() => {
    const cutoff = Date.now() - PR_RECENT_DAYS * 24 * 60 * 60 * 1000;
    // Only a real record: the lift was logged with weight in an earlier
    // session too (an exercise's first session is a baseline, not a PR).
    const loggedBefore = (name: string, before: string) =>
      logs.some(
        (l) =>
          l.completedAt < before &&
          l.exercises.some(
            (e) => canonicalExerciseName(e.exerciseName) === name && e.sets.some((x) => x.weight && x.reps)
          )
      );
    const pr = personalRecords(logs, 100)
      .filter((r) => new Date(r.achievedAt).getTime() >= cutoff && loggedBefore(r.exerciseName, r.achievedAt))
      .sort((x, y) => y.achievedAt.localeCompare(x.achievedAt))[0];
    if (!pr) return null;
    const days = Math.floor((Date.now() - new Date(pr.achievedAt).getTime()) / 86_400_000);
    const when = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
    return `New best ${when}: ${pr.exerciseName}, ${lbToDisplay(pr.weight, units)} ${weightUnit(units)} × ${pr.reps}`;
  }, [logs, units]);

  // Friends who finished a workout in the last day.
  const friendsToday = useMemo(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const names: string[] = [];
    for (const item of feed) {
      if (item.type !== 'friend_workout' || item.actorUid === user?.uid || item.createdAt < cutoff) continue;
      const first = item.actorName.split(' ')[0];
      if (!names.includes(first)) names.push(first);
    }
    return names;
  }, [feed, user?.uid]);

  const confirmDeleteLog = (log: WorkoutLog) => {
    appAlert(
      'Delete workout?',
      `This removes "${log.workoutName}" from ${formatShortDate(log.completedAt)} and takes back the ${log.xpEarned} XP it earned. Weeks you already hit are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWorkoutLog(log.id);
            } catch (e) {
              appAlert('Could not delete', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ]
    );
  };

  const tourSteps = useMemo(() => {
    const steps: TourStep[] = [];

    if (recommended) {
      steps.push({
        key: 'recommended',
        title: 'Today',
        description: 'Your next program day, or a workout we picked for you. Tap Start to go straight to logging.',
        getRect: () => scrollToTopAndMeasure(recommendedRef),
      });
    }

    {
      steps.push({
        key: 'quickStarts',
        title: 'Your Week',
        description: 'Hit your weekly goal to keep your week streak. Rest days never break it.',
        getRect: () => scrollToTopAndMeasure(quickStartsRef),
      });
    }

    steps.push({
      key: 'myWorkouts',
      title: 'Other Workouts',
      description: 'Recent workouts, quick starts, walks, runs and rides, and your own custom workouts.',
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
          {greeting(profile?.name, new Date().getHours(), week, trainedToday, programNext?.day.name)}
        </Text>

        {loading && <Text style={styles.note}>Loading workouts...</Text>}

        {/* Rank: what every workout moves. */}
        <Pressable
          style={styles.rankCard}
          onPress={() => router.push('/rank')}
          accessibilityRole="button"
          accessibilityLabel={`Rank ${rp.rank.name}. ${rp.next ? `${rp.xpToNext} XP to ${rp.next.name}` : 'Top rank'}`}
        >
          <RankEmblem rank={rp.rank} size={44} framed={isPro} />
          <View style={styles.rankText}>
            <View style={styles.rankRow}>
              <Text style={styles.rankName}>{rp.rank.name}</Text>
              <Text style={styles.rankToGo}>
                {rp.next ? `${rp.xpToNext.toLocaleString()} XP to ${rp.next.name}` : 'Top rank'}
              </Text>
            </View>
            <ProgressBar progress={rp.progress} />
          </View>
        </Pressable>

        {/* Today: the one thing to do. */}
        {todayWorkout && (
          <View ref={recommendedRef} style={styles.section}>
            <View style={styles.programLabelRow}>
              <Text style={styles.sectionLabel}>
                {program && programNext ? `Today · ${program.name}` : "Today's pick"}
              </Text>
              <Pressable onPress={() => router.push('/programs')} hitSlop={8} accessibilityRole="button">
                <Text style={styles.changeLink}>{program ? 'Change' : 'Follow a program'}</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.todayCard}
              onPress={() => router.push(`/workout/${todayWorkout.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${todayWorkout.name}, ${todayWorkout.durationMinutes} minutes. View details`}
            >
              {program && programNext && (
                <Text style={styles.programDayKicker}>
                  DAY {programNext.index + 1} OF {program.days.length}
                </Text>
              )}
              <Text style={styles.todayTitle}>{todayWorkout.name}</Text>
              <Text style={styles.todayMeta}>
                {todayWorkout.durationMinutes} min · {todayWorkout.exercises.length} exercises
              </Text>
              <View style={styles.thumbRow}>
                {todayWorkout.exercises.slice(0, 4).map((e) => (
                  <ExerciseFormThumb key={e.id} exercise={findCatalogExercise(e)} />
                ))}
              </View>
              <Text style={styles.lastTime} numberOfLines={1}>
                {todayLastTime
                  ? `Last time: ${todayLastTime}`
                  : program
                    ? 'First time: start light and learn the moves.'
                    : todayWorkout.exercises.map((e) => e.name).slice(0, 3).join(' · ')}
              </Text>
              <Pressable
                style={styles.startButton}
                onPress={() => router.push(`/workout/${todayWorkout.id}/log`)}
                accessibilityRole="button"
                accessibilityLabel={`Start ${todayWorkout.name}`}
              >
                <Ionicons name="play" size={18} color={colors.primary} />
                <Text style={styles.startButtonText}>Start</Text>
              </Pressable>
            </Pressable>
          </View>
        )}
        {!loading && recommendationReady && !todayWorkout && (
          <Text style={styles.note}>No workouts yet. Seed workoutTemplates in Firestore to see them here.</Text>
        )}

        {/* The week, Monday to Sunday. */}
        <View
          ref={quickStartsRef}
          style={styles.weekCard}
          accessible
          accessibilityLabel={`This week: ${week.count} of ${week.goal} workouts. ${week.streak} week streak.`}
        >
          <View style={styles.weekHeader}>
            <Text style={styles.weekTitle}>{week.goalHit ? 'Weekly goal hit' : 'This week'}</Text>
            <View style={styles.weekStreak}>
              <FlameIcon size={16} color={week.streak > 0 ? colors.accentFlame : colors.divider} />
              <Text style={styles.weekStreakText}>
                {week.streak} {week.streak === 1 ? 'week' : 'weeks'}
              </Text>
            </View>
          </View>
          <View style={styles.weekDays}>
            {weekDays.map((d) => (
              <View key={d.date} style={styles.weekDay}>
                <View
                  style={[
                    styles.dayDot,
                    d.trained && styles.dayDotDone,
                    d.isToday && !d.trained && styles.dayDotToday,
                    d.future && styles.dayDotFuture,
                  ]}
                >
                  {d.trained && <Ionicons name="checkmark" size={14} color={colors.textOnDark} />}
                </View>
                <Text style={[styles.dayLabel, d.isToday && styles.dayLabelToday]}>{d.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.weekNote}>
            {week.goalHit
              ? `${week.count} workouts this week. Rest up or keep going.`
              : `${week.count} of ${week.goal} workouts · ${week.goal - week.count} to go · ${week.daysLeft} ${week.daysLeft === 1 ? 'day' : 'days'} left`}
          </Text>
        </View>

        {recentPr && (
          <View style={styles.prLine}>
            <Ionicons name="trophy" size={16} color={colors.accentFlameText} />
            <Text style={styles.prText}>{recentPr}</Text>
          </View>
        )}

        {friendsToday.length > 0 && (
          <Pressable
            style={styles.friendsRow}
            onPress={() => router.push('/social')}
            accessibilityRole="button"
            accessibilityLabel={`${friendsToday.join(', ')} trained today. Open Social`}
          >
            <View style={styles.friendInitials}>
              {friendsToday.slice(0, 4).map((n, i) => (
                <View key={n} style={[styles.friendInitial, { marginLeft: i === 0 ? 0 : -8 }]}>
                  <Text style={styles.friendInitialText}>{n.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.friendsText} numberOfLines={1}>
              {friendsToday.length === 1
                ? `${friendsToday[0]} trained today`
                : `${friendsToday[0]} and ${friendsToday.length - 1} more trained today`}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}

        {/* Everything else, smaller. */}
        <View style={styles.section} ref={myWorkoutsRef}>
          <Text style={styles.sectionLabel}>Other workouts</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.otherRow}>
            {program && recommended && (
              <Pressable
                style={styles.otherCard}
                onPress={() => router.push(`/workout/${recommended.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Something different: ${recommended.name}`}
              >
                <Text style={styles.otherKicker}>SOMETHING DIFFERENT</Text>
                <Text style={styles.otherTitle} numberOfLines={2}>{recommended.name}</Text>
                <Text style={styles.otherMeta}>{recommended.durationMinutes} min</Text>
              </Pressable>
            )}
            {recentWorkouts.map((log) => (
              <Pressable
                key={log.id}
                style={styles.otherCard}
                accessibilityRole="button"
                accessibilityLabel={`${log.workoutName}, last done ${formatShortDate(log.completedAt)}`}
                accessibilityHint="Long press for options"
                onPress={() =>
                  log.workoutSource === 'outdoor' && log.activityType
                    ? router.push({ pathname: '/workout/outdoor/intro', params: { activityType: log.activityType } })
                    : router.push(`/workout/${log.workoutId}`)
                }
                onLongPress={() => setRecentMenuLog(log)}
              >
                <Text style={styles.otherKicker}>RECENT</Text>
                <Text style={styles.otherTitle} numberOfLines={2}>{log.workoutName}</Text>
                <Text style={styles.otherMeta}>{formatShortDate(log.completedAt)}</Text>
              </Pressable>
            ))}
            {quickStarts.map((w) => (
              <Pressable
                key={w.id}
                style={styles.otherCard}
                onPress={() => router.push(`/workout/${w.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Quick start: ${w.name}, ${w.durationMinutes} minutes`}
              >
                <Text style={styles.otherKicker}>QUICK</Text>
                <Text style={styles.otherTitle} numberOfLines={2}>{w.name}</Text>
                <Text style={styles.otherMeta}>{w.durationMinutes} min</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={[styles.quickRow, { marginTop: spacing.md }]}>
            {OUTDOOR_ACTIVITY_TYPES.map((activityType) => (
              <OutdoorActivityCard key={activityType} activityType={activityType} />
            ))}
            {customWorkouts.map((w) => (
              <QuickStartCard key={w.id} workout={w} editable atCustomLimit={atCustomLimit} />
            ))}
            <Pressable
              style={styles.createCard}
              onPress={() => router.push('/workout/new')}
              accessibilityRole="button"
              accessibilityLabel="Create your own workout"
            >
              <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
              <Text style={styles.createCardTitle}>Create Your Own</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <ActionSheet
        visible={!!recentMenuLog}
        title={recentMenuLog?.workoutName}
        onClose={() => setRecentMenuLog(null)}
        actions={
          recentMenuLog
            ? [
                {
                  label: 'Hide from Recent',
                  icon: 'eye-off-outline',
                  onPress: async () => {
                    if (user) setHiddenRecents(await hideRecent(user.uid, recentMenuLog));
                  },
                },
                {
                  label: 'Delete workout',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => confirmDeleteLog(recentMenuLog),
                },
              ]
            : []
        }
      />

      <AppTour visible={tourVisible} steps={tourSteps} onFinish={finishTour} />
    </SafeAreaView>
  );
}

function OutdoorActivityCard({ activityType }: { activityType: OutdoorActivityType }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  // Goes to a pre-activity screen first (like every other workout's detail
  // screen) — GPS tracking and the location prompt only start from there.
  const handlePress = () =>
    router.push({ pathname: '/workout/outdoor/intro', params: { activityType } });

  return (
    <Pressable
      style={styles.quickCard}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Start an outdoor ${OUTDOOR_ACTIVITY_LABELS[activityType]}`}
    >
      <View style={styles.quickCardHeader}>
        <Ionicons
          name={activityType === 'bike' ? 'bicycle' : 'walk'}
          size={16}
          color={colors.primary}
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
  atCustomLimit = false,
}: {
  workout: WorkoutTemplate | CustomWorkout;
  editable?: boolean;
  atCustomLimit?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const confirmDelete = () => {
    appAlert('Delete workout', `Delete "${workout.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await deleteCustomWorkout(user.uid, workout.id);
          } catch (e) {
            appAlert('Could not delete', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  const handleDuplicate = async () => {
    if (!user) return;
    if (atCustomLimit) {
      appAlert(
        'Custom workout limit reached',
        `Free accounts can save up to ${FREE_CUSTOM_WORKOUT_LIMIT} custom workouts. Upgrade to Pro for unlimited.`,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'See Pro', onPress: () => router.push('/paywall') },
        ]
      );
      return;
    }
    try {
      await duplicateCustomWorkout(user.uid, workout as CustomWorkout);
    } catch (e) {
      appAlert('Could not duplicate', e instanceof Error ? e.message : 'Try again.');
    }
  };

  return (
    <Pressable
      style={styles.quickCard}
      onPress={() => router.push(`/workout/${workout.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${workout.name}, ${workout.durationMinutes} minutes`}
    >
      <View style={styles.quickCardHeader}>
        <Text style={styles.quickCardTitle} numberOfLines={2}>
          {workout.name}
        </Text>
        {editable && (
          <Pressable
            hitSlop={8}
            onPress={() => setMenuOpen(true)}
            style={styles.kebab}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${workout.name}`}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
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

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.xl },
  note: { color: colors.textMuted, marginBottom: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionLabel: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  sectionSubLabel: { color: colors.textMuted, marginBottom: spacing.md },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  rankText: { flex: 1, gap: spacing.xs },
  rankRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  rankName: { fontWeight: '800', color: colors.text, fontSize: typography.sizes.body },
  rankToGo: { color: colors.textMuted, fontSize: typography.sizes.small },
  todayCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  todayTitle: { color: colors.textOnDark, fontSize: typography.sizes.lg, fontWeight: '800' },
  todayMeta: { color: colors.textOnDark, opacity: 0.85, fontSize: typography.sizes.small },
  thumbRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  lastTime: { color: colors.textOnDark, fontSize: typography.sizes.small, fontWeight: '600' },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.textOnDark,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  startButtonText: { color: colors.primary, fontWeight: '800', fontSize: typography.sizes.body },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.md },
  weekDay: { alignItems: 'center', gap: 4 },
  dayDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotDone: { backgroundColor: colors.primary },
  dayDotToday: { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.primary },
  dayDotFuture: { opacity: 0.5 },
  dayLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  dayLabelToday: { color: colors.primary, fontWeight: '800' },
  prLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  prText: { flex: 1, color: colors.text, fontWeight: '600', fontSize: typography.sizes.small },
  friendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  friendInitials: { flexDirection: 'row' },
  friendInitial: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendInitialText: { color: colors.textOnDark, fontWeight: '800', fontSize: 12 },
  friendsText: { flex: 1, color: colors.text, fontWeight: '600', fontSize: typography.sizes.small },
  otherRow: { gap: spacing.md, paddingRight: spacing.lg },
  otherCard: {
    width: 140,
    minHeight: 96,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'space-between',
  },
  otherKicker: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  otherTitle: { color: colors.text, fontWeight: '700', fontSize: typography.sizes.small },
  otherMeta: { color: colors.textMuted, fontSize: 12 },
  weekCard: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  weekHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  weekTitle: { fontWeight: '700', color: colors.primary },
  weekStreak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weekStreakText: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.small },
  weekDots: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  weekDot: { flex: 1, height: 10, borderRadius: radii.pill, backgroundColor: colors.divider },
  weekDotDone: { backgroundColor: colors.primary },
  weekNote: { color: colors.textMuted, fontSize: typography.sizes.small },
  programLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  changeLink: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  programDayKicker: {
    color: colors.textOnDark,
    opacity: 0.8,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  pickProgram: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  pickProgramTitle: { fontWeight: '700', color: colors.primary, marginBottom: 2 },
  pickProgramBody: { color: colors.text, fontSize: typography.sizes.small, lineHeight: 18 },
  recommendedCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  recentRow: { gap: spacing.md, paddingRight: spacing.lg },
  recentCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    flexGrow: 1,
    flexBasis: '30%',
    maxWidth: '48%',
    minHeight: 64,
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
    color: colors.text,
    fontWeight: '700',
    fontSize: typography.sizes.small,
  },
  kebab: { marginRight: -4, marginTop: -2, padding: 2 },
  quickCardMeta: { color: colors.textMuted, fontSize: typography.sizes.small },
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
