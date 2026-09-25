import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Button } from '../../../components/Button';
import { MapRoute } from '../../../components/MapRoute';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { badges } from '../../../data/badges';
import {
  formatDistanceMiles,
  formatElapsed,
  formatPacePerMile,
  routeDistanceMeters,
} from '../../../lib/geo';
import {
  requestTrackingPermissions,
  restoreBufferedPoints,
  startTracking,
  stopTracking,
  subscribe,
} from '../../../lib/outdoorTracking';
import { completeOutdoorActivity, type CompletionResult } from '../../../lib/workoutCompletion';
import type { OutdoorActivityType, RoutePoint } from '../../../types/models';

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
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<CompletionResult | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const navigation = useNavigation();
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
      startedAtRef.current = await startTracking();
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      setTracking(true);
    })();

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!tracking) return;
    const interval = setInterval(() => {
      if (startedAtRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [tracking]);

  const distanceMeters = routeDistanceMeters(route);

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
    } catch (e) {
      Alert.alert(
        'Could not save your activity',
        e instanceof Error ? e.message : 'Try again.'
      );
      setFinishing(false);
    }
  };

  if (result) {
    const badge = result.badgeEarnedId ? badges[result.badgeEarnedId] : null;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.summaryMapWrap}>
          <MapRoute route={route} style={StyleSheet.absoluteFill} />
        </View>
        <View style={styles.summaryBody}>
          <Text style={styles.heading}>{ACTIVITY_LABELS[activityType]} Complete!</Text>
          <View style={styles.statsRow}>
            <Stat label="Distance" value={formatDistanceMiles(distanceMeters)} />
            <Stat label="Time" value={formatElapsed(elapsedSeconds)} />
            <Stat label="Pace" value={formatPacePerMile(distanceMeters, elapsedSeconds)} />
          </View>
          <Text style={styles.xpLine}>
            +{result.xpEarned}
            <Text style={styles.xpUnit}> xp</Text>
          </Text>
          {badge && (
            <View style={styles.badgeRow}>
              <Ionicons name="ribbon" size={22} color={colors.primary} />
              <Text style={styles.badgeText}>Earned: {badge.name}</Text>
            </View>
          )}
        </View>
        <View style={styles.footer}>
          <Button label="Done" onPress={() => router.replace('/')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapRoute route={route} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Ionicons name={ACTIVITY_ICONS[activityType]} size={22} color={colors.primary} />
          <Text style={styles.heading}>{ACTIVITY_LABELS[activityType]}</Text>
        </View>
        <View style={styles.statsRow}>
          <Stat label="Distance" value={formatDistanceMiles(distanceMeters)} />
          <Stat label="Time" value={formatElapsed(elapsedSeconds)} />
          <Stat label="Pace" value={formatPacePerMile(distanceMeters, elapsedSeconds)} />
        </View>
      </View>
      <View style={styles.footer}>
        <Button
          label={finishing ? 'Saving...' : 'Finish'}
          onPress={handleFinish}
          loading={finishing}
          disabled={!tracking && !finishing}
        />
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
  body: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryBody: {
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: typography.sizes.lg, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: typography.sizes.small, color: colors.textMuted },
  xpLine: { fontSize: typography.sizes.xl, fontWeight: '800', color: colors.accentFlame },
  xpUnit: { fontSize: typography.sizes.body, fontWeight: '600' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeText: { color: colors.primary, fontWeight: '700' },
  footer: {
    padding: spacing.lg,
  },
});
