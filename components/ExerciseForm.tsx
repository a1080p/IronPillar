import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { MUSCLE_LABELS, formPhotoUrls, type CatalogExercise } from '../data/exercises';

// How long each of the two photos (start and end position) stays up before
// fading to the other, so the pair reads as the movement.
const FLIP_MS = 1300;
const FADE_MS = 250;

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

// The exercise's start and end photos crossfading in a loop; tap to see both
// full size. Renders nothing for exercises without photos, or if they fail to
// load (e.g. offline before they were ever cached).
export function ExerciseFormPhotos({ exercise, height = 170 }: { exercise?: CatalogExercise; height?: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const urls = formPhotoUrls(exercise);
  const reduceMotion = useReduceMotion();
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const endOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setFailed(false);
    endOpacity.setValue(0);
  }, [exercise?.id]);

  useEffect(() => {
    if (urls.length < 2 || reduceMotion || failed) return;
    let showingEnd = false;
    const timer = setInterval(() => {
      showingEnd = !showingEnd;
      Animated.timing(endOpacity, {
        toValue: showingEnd ? 1 : 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start();
    }, FLIP_MS);
    return () => clearInterval(timer);
  }, [exercise?.id, reduceMotion, failed, urls.length]);

  if (!exercise || urls.length < 2 || failed) return null;

  return (
    <>
      <Pressable
        onPress={() => setViewerOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Form photos for ${exercise.name}`}
        accessibilityHint="Opens the start and finish positions full size"
      >
        {reduceMotion ? (
          // No looping animation: both positions side by side instead.
          <View style={[styles.sideBySide, { height }]}>
            {urls.map((url) => (
              <Image
                key={url}
                source={{ uri: url }}
                style={styles.half}
                resizeMode="cover"
                onError={() => setFailed(true)}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.frame, { height }]}>
            <Image
              source={{ uri: urls[0] }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
            <Animated.Image
              source={{ uri: urls[1] }}
              style={[StyleSheet.absoluteFill, { opacity: endOpacity }]}
              resizeMode="cover"
              onError={() => setFailed(true)}
            />
          </View>
        )}
        <View style={styles.badge} pointerEvents="none">
          <Ionicons name="expand" size={12} color="#FFFFFF" />
          <Text style={styles.badgeText}>Form</Text>
        </View>
      </Pressable>
      <FormViewer exercise={exercise} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
    </>
  );
}

// A small start-position photo for exercise lists; tap for full size.
export function ExerciseFormThumb({ exercise }: { exercise?: CatalogExercise }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const urls = formPhotoUrls(exercise);
  const [failed, setFailed] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  if (!exercise || urls.length === 0 || failed) return null;
  return (
    <>
      <Pressable
        onPress={() => setViewerOpen(true)}
        hitSlop={6}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Form photos for ${exercise.name}`}
      >
        <Image
          source={{ uri: urls[0] }}
          style={styles.thumb}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      </Pressable>
      <FormViewer exercise={exercise} visible={viewerOpen} onClose={() => setViewerOpen(false)} />
    </>
  );
}

function FormViewer({
  exercise,
  visible,
  onClose,
}: {
  exercise: CatalogExercise;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const urls = formPhotoUrls(exercise);
  const muscles = exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ');
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.viewer} edges={['top', 'bottom']}>
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerTitle} accessibilityRole="header" numberOfLines={2}>
            {exercise.name}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.primary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.viewerScroll}>
          <Text style={styles.viewerMeta}>
            Works: {muscles}
            {exercise.equipment !== 'bodyweight' ? ` · ${capitalize(exercise.equipment)}` : ' · Bodyweight'}
          </Text>
          {urls.map((url, i) => (
            <View key={url} style={styles.viewerPhotoWrap}>
              <Text style={styles.viewerLabel}>{i === 0 ? 'Start' : 'Finish'}</Text>
              <Image
                source={{ uri: url }}
                style={styles.viewerPhoto}
                resizeMode="contain"
                accessibilityLabel={`${exercise.name}, ${i === 0 ? 'start' : 'finish'} position`}
              />
            </View>
          ))}
          <Text style={styles.credit}>Photos: free-exercise-db (public domain)</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    frame: {
      width: '100%',
      borderRadius: radii.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    sideBySide: {
      flexDirection: 'row',
      gap: 2,
      borderRadius: radii.md,
      overflow: 'hidden',
      backgroundColor: colors.surfaceMuted,
    },
    half: { flex: 1, height: '100%' },
    badge: {
      position: 'absolute',
      right: spacing.sm,
      bottom: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: radii.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
    thumb: {
      width: 64,
      height: 43,
      borderRadius: radii.sm,
      backgroundColor: colors.surfaceMuted,
    },
    viewer: { flex: 1, backgroundColor: colors.background },
    viewerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    viewerTitle: { flex: 1, fontSize: typography.sizes.md, fontWeight: '700', color: colors.primary },
    viewerScroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
    viewerMeta: { color: colors.textMuted, marginBottom: spacing.lg },
    viewerPhotoWrap: { marginBottom: spacing.lg },
    viewerLabel: { fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    viewerPhoto: {
      width: '100%',
      aspectRatio: 3 / 2,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
    },
    credit: { color: colors.textMuted, fontSize: typography.sizes.small, textAlign: 'center' },
  });
