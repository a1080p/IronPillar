import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { usePurchases } from '../../../contexts/PurchasesContext';
import type { OutdoorActivityType } from '../../../types/models';

const INFO: Record<
  OutdoorActivityType,
  { title: string; icon: keyof typeof Ionicons.glyphMap; overview: string; tips: string[] }
> = {
  walk: {
    title: 'Outdoor Walk',
    icon: 'walk',
    overview:
      'An easy-effort walk tracked with GPS. Great for active recovery, rest days, or building a daily habit.',
    tips: [
      'Walk at a pace where you can still hold a conversation.',
      'Swing your arms and keep your head up for a longer stride.',
    ],
  },
  run: {
    title: 'Outdoor Run',
    icon: 'walk',
    overview:
      'A GPS-tracked run with live distance and pace, plus your route drawn on the map when you finish.',
    tips: [
      'Start the first few minutes slower than feels necessary to warm up.',
      'Land under your hips with short, quick steps instead of overstriding.',
    ],
  },
  bike: {
    title: 'Bike Ride',
    icon: 'bicycle',
    overview: 'A GPS-tracked ride with live distance, average pace, and your route on the map.',
    tips: [
      'Wear a helmet and stay visible to traffic.',
      'Mount your phone or keep it in a zipped pocket.',
    ],
  },
};

// Pre-activity screen for GPS workouts, matching the detail screen every
// other workout has: nothing is tracked (and no location prompt appears)
// until the user taps Start.
export default function OutdoorIntroScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { isPro } = usePurchases();
  const { activityType: raw } = useLocalSearchParams<{ activityType: string }>();
  const activityType: OutdoorActivityType = raw === 'walk' || raw === 'bike' ? raw : 'run';
  const info = INFO[activityType];

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.iconCircle}>
          <Ionicons name={info.icon} size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>{info.title}</Text>
        <Text style={styles.overview}>{info.overview}</Text>

        <Text style={styles.sectionLabel}>What's tracked</Text>
        <View style={styles.panel}>
          <Row icon="map-outline" text="Your route on the map" />
          <Row icon="speedometer-outline" text="Live distance, time, and average pace" />
          <Row icon="flash-outline" text="40 XP per kilometer, plus your streak bonus" />
          <Row icon="flame-outline" text="Minutes count toward today's 30-minute streak day" />
          {isPro && <Row icon="heart-outline" text="Saved to Apple Health if you've connected it" />}
        </View>

        <Text style={styles.sectionLabel}>Tips</Text>
        <View style={styles.panel}>
          {info.tips.map((tip) => (
            <Row key={tip} icon="checkmark-circle-outline" text={tip} />
          ))}
          <Row
            icon="lock-closed-outline"
            text='Allow "Always" location so tracking keeps going with your screen locked.'
          />
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={`Start ${info.title}`}
          onPress={() =>
            router.replace({ pathname: '/workout/outdoor/track', params: { activityType } })
          }
        />
      </View>
    </SafeAreaView>
  );
}

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg, paddingBottom: 40 },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: typography.sizes.lg,
      fontWeight: '800',
      color: colors.primary,
      textAlign: 'center',
    },
    overview: {
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
      marginBottom: spacing.lg,
    },
    sectionLabel: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
    panel: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    rowText: { flex: 1, color: colors.text, fontSize: typography.sizes.small },
    footer: { padding: spacing.lg },
  });
