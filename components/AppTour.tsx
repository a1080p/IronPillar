import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourStep {
  key: string;
  title: string;
  description: string;
  /** Resolves the highlighted rect right before this step is shown (e.g. via measureInWindow). */
  getRect: () => Promise<TourRect | null> | TourRect | null;
}

interface AppTourProps {
  visible: boolean;
  steps: TourStep[];
  onFinish: () => void;
}

const PADDING = 8;
const GAP = spacing.md;
// Used only for the very first frame, before the tooltip has actually
// rendered once and reported its real height via onLayout — close to a
// typical tooltip's height so that first frame doesn't visibly jump once the
// real measurement lands.
const FALLBACK_TOOLTIP_HEIGHT = 180;

export function AppTour({ visible, steps, onFinish }: AppTourProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<TourRect | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState(FALLBACK_TOOLTIP_HEIGHT);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setStepIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setRect(null);
    (async () => {
      const step = steps[stepIndex];
      if (!step) return;
      const result = await step.getRect();
      if (!cancelled) setRect(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, stepIndex, steps]);

  // Fades the highlight + tooltip out while the next step is being measured
  // (rect briefly goes null above), then back in once it's ready — a plain
  // instant swap read as jarring, especially for the nav-bar step which jumps
  // from the top of the screen to the very bottom.
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: rect ? 1 : 0,
      duration: rect ? 220 : 120,
      useNativeDriver: true,
    }).start();
  }, [rect, fadeAnim]);

  if (!visible) return null;

  const step = steps[stepIndex];
  if (!step) return null;

  const isLast = stepIndex === steps.length - 1;
  const screen = Dimensions.get('window');

  const highlight: TourRect = rect
    ? {
        x: Math.max(rect.x - PADDING, 0),
        y: Math.max(rect.y - PADDING, 0),
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      }
    : { x: 0, y: 0, width: 0, height: 0 };

  // Prefers placing the tooltip below the highlighted element (reads more
  // naturally, top-to-bottom) but only when the real measured tooltip height
  // actually fits there without spilling past the safe-area bottom edge —
  // otherwise it places above, using that same real height, so the box can
  // never overlap the very thing it's pointing at (this was the nav-bar bug:
  // a fixed 190px "above" offset didn't account for how tall the box really
  // rendered, so it spilled down onto the highlighted bar).
  const spaceBelow = screen.height - insets.bottom - (highlight.y + highlight.height) - GAP;
  const spaceAbove = highlight.y - insets.top - GAP;
  const placeBelow = spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove;

  const tooltipTop = placeBelow
    ? Math.min(
        highlight.y + highlight.height + GAP,
        screen.height - insets.bottom - tooltipHeight - GAP
      )
    : Math.max(highlight.y - GAP - tooltipHeight, insets.top + GAP);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFinish}>
      <View style={StyleSheet.absoluteFill}>
        {/* Always-present base dim, so the loading gap between steps reads as
            a plain dim screen rather than a flash of full black. */}
        <View style={styles.mask} />

        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="box-none">
          {rect && (
            <>
              <View style={[styles.mask, { top: 0, left: 0, right: 0, height: highlight.y }]} />
              <View
                style={[
                  styles.mask,
                  { top: highlight.y, left: 0, width: highlight.x, height: highlight.height },
                ]}
              />
              <View
                style={[
                  styles.mask,
                  {
                    top: highlight.y,
                    left: highlight.x + highlight.width,
                    right: 0,
                    height: highlight.height,
                  },
                ]}
              />
              <View
                style={[
                  styles.mask,
                  { top: highlight.y + highlight.height, left: 0, right: 0, bottom: 0 },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.highlightRing,
                  {
                    top: highlight.y,
                    left: highlight.x,
                    width: highlight.width,
                    height: highlight.height,
                  },
                ]}
              />
            </>
          )}

          <View
            style={[styles.tooltip, { top: tooltipTop }]}
            onLayout={(e) => setTooltipHeight(e.nativeEvent.layout.height)}
          >
            <Text style={styles.stepCount}>
              {stepIndex + 1} of {steps.length}
            </Text>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>

            <View style={styles.actions}>
              <Pressable
                onPress={onFinish}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Skip the tour"
              >
                <Text style={styles.skip}>Skip</Text>
              </Pressable>
              <Pressable
                style={styles.nextButton}
                accessibilityRole="button"
                onPress={() => (isLast ? onFinish() : setStepIndex((i) => i + 1))}
              >
                <Text style={styles.nextLabel}>{isLast ? 'Done' : 'Next'}</Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  highlightRing: {
    position: 'absolute',
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.accentFlame,
  },
  tooltip: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  stepCount: {
    color: colors.textMuted,
    fontSize: typography.sizes.small,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  title: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  description: {
    color: colors.text,
    fontSize: typography.sizes.body,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: {
    color: colors.textMuted,
    fontSize: typography.sizes.body,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  nextLabel: {
    color: colors.textOnDark,
    fontSize: typography.sizes.body,
    fontWeight: '700',
  },
});
