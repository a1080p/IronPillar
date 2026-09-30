// The celebrations shown after a workout: a pop-up trophy for personal
// records, a level-up screen, and the badges the workout unlocked. Used by
// both the strength completion screen and the outdoor summary.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BadgeMedal } from './BadgeMedal';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { levelProgress } from '../constants/gamification';
import { radii, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { badges as badgeCatalog } from '../data/badges';
import { useUnits } from '../hooks/useUnits';
import { formatWeight } from '../lib/units';
import type { CompletionResult, PersonalRecordResult } from '../lib/workoutCompletion';
import type { Badge } from '../types/models';

const TROPHY_GOLD = '#D9A514';

function earnedBadges(result: CompletionResult): Badge[] {
  const ids = result.badgesEarned ?? (result.badgeEarnedId ? [result.badgeEarnedId] : []);
  return ids.map((id) => badgeCatalog[id]).filter((b): b is Badge => !!b);
}

function leveledUp(result: CompletionResult) {
  return result.levelAfter != null && result.levelBefore != null && result.levelAfter > result.levelBefore;
}

type Step = 'level' | 'badges';

function stepsFor(result: CompletionResult): Step[] {
  const steps: Step[] = [];
  if (leveledUp(result)) steps.push('level');
  // A level badge is shown on the level-up screen itself.
  const others = earnedBadges(result).filter((b) => !(leveledUp(result) && b.category === 'levels'));
  if (others.length > 0) steps.push('badges');
  return steps;
}

// True when finishing should go through CelebrationFlow before leaving.
export function hasCelebrations(result: CompletionResult) {
  return stepsFor(result).length > 0;
}

// Full-screen level-up and badge screens, shown one after the other. Calls
// onDone after the last one.
export function CelebrationFlow({
  result,
  visible,
  onDone,
}: {
  result: CompletionResult;
  visible: boolean;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const steps = useMemo(() => stepsFor(result), [result]);
  const [index, setIndex] = useState(0);
  const step = steps[index];

  const next = () => {
    if (index + 1 < steps.length) setIndex(index + 1);
    else onDone();
  };

  if (!visible || !step) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={next}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {step === 'level' ? (
          <LevelUp key="level" result={result} onContinue={next} />
        ) : (
          <BadgesEarned
            key="badges"
            badges={earnedBadges(result).filter((b) => !(leveledUp(result) && b.category === 'levels'))}
            onContinue={next}
            isLast={index + 1 >= steps.length}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const SPARK_COUNT = 10;
const SPARK_DISTANCE = 130;

function LevelUp({ result, onContinue }: { result: CompletionResult; onContinue: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { profile } = useAuth();
  const level = result.levelAfter ?? 1;
  const levelBadge = earnedBadges(result).find((b) => b.category === 'levels');
  // The profile listener has the new XP by now; fall back to an empty bar.
  const progress = profile ? levelProgress(profile.xp) : null;
  const showProgress = !!progress && progress.level === level;

  const pop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Vibration.vibrate(60);
    Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.timing(burst, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        { iterations: 3 }
      ),
      Animated.timing(text, { toValue: 1, duration: 500, delay: 350, useNativeDriver: true }),
    ]).start();
  }, [pop, burst, pulse, text]);

  const textStyle = {
    opacity: text,
    transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  return (
    <View style={styles.screen}>
      <View style={styles.centered}>
        <View style={styles.levelStage}>
          <Animated.View
            style={[
              styles.pulseRing,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
              },
            ]}
          />
          {Array.from({ length: SPARK_COUNT }, (_, i) => {
            const angle = (i / SPARK_COUNT) * Math.PI * 2;
            return (
              <Animated.View
                key={i}
                style={[
                  styles.spark,
                  {
                    opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      {
                        translateX: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, Math.cos(angle) * SPARK_DISTANCE],
                        }),
                      },
                      {
                        translateY: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, Math.sin(angle) * SPARK_DISTANCE],
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
          <Animated.View
            style={[
              styles.levelCircle,
              {
                transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
                opacity: pop.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
              },
            ]}
          >
            <Text style={styles.levelCaption}>LEVEL</Text>
            <Text style={styles.levelNumber}>{level}</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.levelTextWrap, textStyle]}>
          <Text style={styles.kicker}>LEVEL UP</Text>
          <Text style={styles.title}>You reached Level {level}</Text>
          <Text style={styles.body}>Every rep got you here. Keep building.</Text>

          {showProgress && progress && (
            <View style={styles.progressWrap}>
              <ProgressBar progress={progress.xpInto / progress.xpNeeded} />
              <Text style={styles.progressLabel}>
                {progress.xpInto}/{progress.xpNeeded} XP to Level {level + 1}
              </Text>
            </View>
          )}

          {levelBadge && (
            <View style={styles.levelBadgeRow}>
              <BadgeMedal badge={levelBadge} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.levelBadgeKicker}>New badge for your collection</Text>
                <Text style={styles.levelBadgeName}>{levelBadge.name}</Text>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
      <View style={styles.footer}>
        <Button label="Continue" onPress={onContinue} />
      </View>
    </View>
  );
}

function BadgesEarned({
  badges,
  onContinue,
  isLast,
}: {
  badges: Badge[];
  onContinue: () => void;
  isLast: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const single = badges.length === 1;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.badgesScroll}>
        <Text style={styles.kicker}>{single ? 'BADGE EARNED' : `${badges.length} BADGES EARNED`}</Text>
        <Text style={styles.title}>{single ? badges[0].name : 'Added to your collection'}</Text>
        {single ? (
          <>
            <PopIn delay={150} style={{ marginVertical: spacing.xl }}>
              <BadgeMedal badge={badges[0]} size={148} />
            </PopIn>
            <Text style={styles.body}>{badges[0].description}</Text>
          </>
        ) : (
          <View style={styles.badgeList}>
            {badges.map((badge, i) => (
              <PopIn key={badge.id} delay={150 + i * 110} style={styles.badgeListRow}>
                <BadgeMedal badge={badge} size={56} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.badgeListName}>{badge.name}</Text>
                  <Text style={styles.badgeListDescription}>{badge.description}</Text>
                </View>
              </PopIn>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label={isLast ? 'Done' : 'Continue'} onPress={onContinue} />
      </View>
    </View>
  );
}

// Scales and fades its children in once, after `delay`.
function PopIn({
  delay = 0,
  style,
  children,
}: {
  delay?: number;
  style?: object;
  children: React.ReactNode;
}) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(value, { toValue: 1, friction: 6, tension: 80, delay, useNativeDriver: true }).start();
  }, [value, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
          transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Pop-up trophy for personal records. Shows itself shortly after the summary
// screen appears; nothing renders when the workout set no records.
export function PersonalRecordPopup({ records }: { records: PersonalRecordResult[] | undefined }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const units = useUnits();
  const [visible, setVisible] = useState(false);
  const trophy = useRef(new Animated.Value(0)).current;
  const count = records?.length ?? 0;

  useEffect(() => {
    if (count === 0) return;
    const timer = setTimeout(() => setVisible(true), 500);
    return () => clearTimeout(timer);
  }, [count]);

  useEffect(() => {
    if (!visible) return;
    Vibration.vibrate(40);
    trophy.setValue(0);
    Animated.spring(trophy, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start();
  }, [visible, trophy]);

  if (!records || count === 0) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.popupBackdrop}>
        <View style={styles.popupCard}>
          <Animated.View
            style={{
              transform: [
                { scale: trophy.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                { rotate: trophy.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '0deg'] }) },
              ],
            }}
          >
            <View style={styles.trophyCircle}>
              <Ionicons name="trophy" size={44} color={TROPHY_GOLD} />
            </View>
          </Animated.View>
          <Text style={styles.popupTitle}>
            {count === 1 ? 'New Personal Record' : `${count} New Personal Records`}
          </Text>
          <View style={styles.recordList}>
            {records.map((record) => (
              <View key={record.exerciseName} style={styles.recordRow}>
                <Text style={styles.recordName} numberOfLines={1}>
                  {record.exerciseName}
                </Text>
                <Text style={styles.recordValue}>
                  {formatWeight(record.weight, units)} × {record.reps}
                </Text>
                <Text style={styles.recordDetail}>
                  Est. 1-rep max {formatWeight(record.estimatedOneRepMax, units)}, up from{' '}
                  {formatWeight(record.previousOneRepMax, units)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.popupButton}>
            <Button label="Nice" onPress={() => setVisible(false)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    footer: { padding: spacing.lg },
    levelStage: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center' },
    pulseRing: {
      position: 'absolute',
      width: 168,
      height: 168,
      borderRadius: 84,
      borderWidth: 3,
      borderColor: colors.primary,
    },
    spark: {
      position: 'absolute',
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accentFlame,
    },
    levelCircle: {
      width: 168,
      height: 168,
      borderRadius: 84,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    levelCaption: { color: colors.textOnDark, fontWeight: '700', letterSpacing: 3, fontSize: typography.sizes.small },
    levelNumber: { color: colors.textOnDark, fontWeight: '800', fontSize: 76, lineHeight: 84 },
    levelTextWrap: { alignItems: 'center', alignSelf: 'stretch', marginTop: spacing.md },
    kicker: {
      color: colors.accentFlame,
      fontWeight: '800',
      letterSpacing: 3,
      fontSize: typography.sizes.small,
      textAlign: 'center',
    },
    title: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: typography.sizes.lg,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    body: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
    progressWrap: { alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.xs },
    progressLabel: { color: colors.textMuted, fontSize: typography.sizes.small, textAlign: 'center' },
    levelBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'stretch',
      gap: spacing.md,
      backgroundColor: colors.surfaceMuted,
      borderRadius: radii.md,
      padding: spacing.md,
      marginTop: spacing.lg,
    },
    levelBadgeKicker: { color: colors.textMuted, fontSize: typography.sizes.small },
    levelBadgeName: { color: colors.text, fontWeight: '700', fontSize: typography.sizes.body },
    badgesScroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    badgeList: { alignSelf: 'stretch', marginTop: spacing.lg, gap: spacing.md },
    badgeListRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    badgeListName: { color: colors.text, fontWeight: '700', fontSize: typography.sizes.body },
    badgeListDescription: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
    popupBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    popupCard: {
      alignSelf: 'stretch',
      backgroundColor: colors.background,
      borderRadius: radii.lg,
      padding: spacing.lg,
      alignItems: 'center',
    },
    trophyCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 3,
      borderColor: TROPHY_GOLD,
      alignItems: 'center',
      justifyContent: 'center',
    },
    popupTitle: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: typography.sizes.md,
      marginTop: spacing.md,
      textAlign: 'center',
    },
    recordList: { alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.md },
    recordRow: { alignItems: 'center' },
    recordName: { color: colors.text, fontWeight: '700' },
    recordValue: { color: colors.accentFlame, fontWeight: '800', fontSize: typography.sizes.lg },
    recordDetail: { color: colors.textMuted, fontSize: typography.sizes.small, textAlign: 'center' },
    popupButton: { alignSelf: 'stretch', marginTop: spacing.lg },
  });
