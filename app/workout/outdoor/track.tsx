import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Button } from '../../../components/Button';
import { MapRoute } from '../../../components/MapRoute';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import {
  formatElapsed,
  routeDistanceMeters,
} from '../../../lib/geo';
import {
  getPauseState,
  pauseTracking,
  requestTrackingPermissions,
  restoreBufferedPoints,
  resumeTracking,
  startTracking,
  stopTracking,
  subscribe,
} from '../../../lib/outdoorTracking';
import { completeOutdoorActivity, type CompletionResult } from '../../../lib/workoutCompletion';
import { noteWorkoutStarted } from '../../../lib/gymReminders';
import type { OutdoorActivityType, RoutePoint } from '../../../types/models';
import { useAuth } from '../../../contexts/AuthContext';
import { XpBreakdown } from '../../../components/XpBreakdown';
import { CelebrationFlow, hasCelebrations } from '../../../components/Celebrations';
import { MoreMenu } from '../../../components/MoreMenu';
import { Confetti } from '../../../components/Confetti';
import { completionMessages, pickMessage } from '../../../constants/motivation';
import { formatDistance, formatPace } from '../../../lib/units';
import { useUnits } from '../../../hooks/useUnits';
import { usePurchases } from '../../../contexts/PurchasesContext';
import { syncCompletedWorkoutToHealth } from '../../../hooks/useAppleHealth';

const ACTIVITY_LABELS: Record<OutdoorActivityType, string> = {
  walk: 'Walk',
  run: 'Run',
  bike: 'Bike Ride',
};

const ACTIVITY_ICONS: Record<OutdoorActivityType, keyof typeof Ionicons.glyphMap> = {
  walk: 'walk',
  run: 'walk', // Ionicons has no distinct "run" glyph
  bike: 'bicycle',
};

export default function OutdoorTrackScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { activityType: rawType } = useLocalSearchParams<{ activityType: string }>();
  const activityType: OutdoorActivityType =
    rawType === 'walk' || rawType === 'bike' ? rawType : 'run';

  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const totalPausedMsRef = useRef(0);
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isPro } = usePurchases();
  const units = useUnits();
  // Skips the confirm dialog when there's nothing to lose yet — e.g. leaving
  // because location permission was denied, before tracking ever started.
  const skipConfirmRef = useRef(false);

  useEffect(() => {
    // Once the activity is finished (result is set), tracking has already
    // stopped and there's nothing left to lose — let navigation through.
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (result || skipConfirmRef.current) return;
      e.preventDefault();
      Alert.alert('Quit workout?', 'All progress will be lost if you quit now.', [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Quit',
          style: 'destructive',
          onPress: () => {
            stopTracking().catch(() => {});
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, result]);

  useEffect(() => {
    const unsubscribe = subscribe(setRoute);
    (async () => {
      const restored = await restoreBufferedPoints();
      if (restored.length > 0) setRoute(restored);

      const granted = await requestTrackingPermissions();
      if (!granted) {
        Alert.alert(
          'Location access needed',
          'Enable location access (Always, so it keeps working with your screen locked) for Iron Pillar in Settings to track an outdoor workout.',
          [
            {
              text: 'OK',
              onPress: () => {
                skipConfirmRef.current = true;
                router.back();
              },
            },
          ]
        );
        return;
      }
      startedAtRef.current = await startTracking({ activityType, units });
      noteWorkoutStarted();
      const pauseState = await getPauseState();
      totalPausedMsRef.current = pauseState.totalPausedMs;
      if (pauseState.pausedAt) {
        // App was killed/backgrounded mid-pause — come back up still paused
        // rather than silently resuming without the user asking to.
        setPaused(true);
      }
      setElapsedSeconds(
        Math.floor((Date.now() - startedAtRef.current - totalPausedMsRef.current) / 1000)
      );
      setTracking(true);
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!tracking || paused) return;
    const interval = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSeconds(
          Math.floor((Date.now() - startedAtRef.current - totalPausedMsRef.current) / 1000)
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tracking, paused]);

  const distanceMeters = routeDistanceMeters(route);

  const handlePause = async () => {
    setPausing(true);
    try {
      await pauseTracking();
      setPaused(true);
    } finally {
      setPausing(false);
    }
  };

  const handleResume = async () => {
    setPausing(true);
    try {
      await resumeTracking();
      const pauseState = await getPauseState();
      totalPausedMsRef.current = pauseState.totalPausedMs;
      setPaused(false);
    } finally {
      setPausing(false);
    }
  };

  const handleFinish = async () => {
    setFinishing(true);
    try {
      const finalRoute = await stopTracking();
      setTracking(false);
      const finalDistance = routeDistanceMeters(finalRoute.length > 0 ? finalRoute : route);
      const activityId = `outdoor-${activityType}-${Date.now()}`;
      const completion = await completeOutdoorActivity(
        activityId,
        activityType,
        elapsedSeconds,
        finalDistance,
        finalRoute.length > 0 ? finalRoute : route
      );
      setResult(completion);
      if (user) {
        // Fire-and-forget: Pro + opt-in only; lands in Apple Fitness with distance.
        syncCompletedWorkoutToHealth(user.uid, isPro, {
          startDate: new Date(startedAtRef.current ?? Date.now() - elapsedSeconds * 1000),
          endDate: new Date(),
          activityType,
          distanceMeters: finalDistance,
        });
      }
    } catch (e) {
      Alert.alert(
        'Could not save your activity',
        e instanceof Error ? e.message : 'Try again.'
      );
      setFinishing(false);
    }
  };

  if (result) {
    const celebrations = hasCelebrations(result);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.summaryMapWrap}>
          <MapRoute route={route} style={StyleSheet.absoluteFill} />
        </View>
        <ScrollView contentContainerStyle={styles.summaryBody}>
          <View style={styles.summaryMore}>
            <MoreMenu />
          </View>
          <Text style={styles.heading}>{ACTIVITY_LABELS[activityType]} Complete</Text>
          <Text style={styles.summarySub}>
            {pickMessage(completionMessages, result.xpEarned + result.streakCountAfter).sub}.
          </Text>
          <View style={styles.statsRow}>
            <Stat label="Distance" value={formatDistance(distanceMeters, units)} />
            <Stat label="Time" value={formatElapsed(elapsedSeconds)} />
            <Stat label="Avg Pace" value={formatPace(distanceMeters, elapsedSeconds, units)} />
          </View>
          <XpBreakdown result={result} />
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={celebrations ? 'Next' : 'Done'}
            onPress={() => (celebrations ? setCelebrating(true) : router.replace('/'))}
          />
        </View>
        <Confetti />
        <CelebrationFlow result={result} visible={celebrating} onDone={() => router.replace('/')} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapRoute route={route} style={StyleSheet.absoluteFill} />
      </View>

      <View style={styles.panel}>
        <View style={styles.panelMore}>
          <MoreMenu />
        </View>
        <View style={styles.titleRow}>
          <Ionicons name={ACTIVITY_ICONS[activityType]} size={18} color={colors.primary} />
          <Text style={styles.activityLabel}>{ACTIVITY_LABELS[activityType]}</Text>
        </View>

        <Text style={styles.bigTimer}>{formatElapsed(elapsedSeconds)}</Text>
        <Text style={styles.timerCaption}>{paused ? 'PAUSED' : 'TIME'}</Text>

        <View style={styles.secondaryStatsRow}>
          <Stat label="Distance" value={formatDistance(distanceMeters, units)} />
          <Stat label="Avg Pace" value={formatPace(distanceMeters, elapsedSeconds, units)} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <Button
              label={paused ? 'Resume' : 'Pause'}
              variant="outline"
              onPress={paused ? handleResume : handlePause}
              loading={pausing}
              disabled={!tracking || finishing}
            />
          </View>
          <View style={styles.buttonHalf}>
            <Button
              label={finishing ? 'Saving...' : 'Stop'}
              onPress={handleFinish}
              loading={finishing}
              disabled={!tracking && !finishing}
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  summaryMapWrap: { height: '35%' },
  panel: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryBody: {
    padding: spacing.lg,
    gap: spacing.lg,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  activityLabel: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  summaryMore: { alignSelf: 'flex-end', marginBottom: -spacing.lg },
  panelMore: { position: 'absolute', top: spacing.md, right: spacing.lg, zIndex: 1 },
  summarySub: { color: colors.textMuted, textAlign: 'center', marginTop: -spacing.sm },
  bigTimer: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  timerCaption: {
    fontSize: typography.sizes.small,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 2,
    marginTop: -spacing.xs,
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  stat: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: typography.sizes.lg, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: typography.sizes.small, color: colors.textMuted },
  xpLine: { fontSize: typography.sizes.xl, fontWeight: '800', color: colors.accentFlameText },
  xpUnit: { fontSize: typography.sizes.body, fontWeight: '600' },
  proXp: { color: colors.accentFlameText, fontWeight: '700', fontSize: typography.sizes.small },
  footer: {
    padding: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  buttonHalf: {
    flex: 1,
  },
});
