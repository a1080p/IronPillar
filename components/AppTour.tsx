import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';

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

export function AppTour({ visible, steps, onFinish }: AppTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<TourRect | null>(null);

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

  const tooltipBelow = highlight.y + highlight.height < screen.height * 0.6;
  const tooltipTop = tooltipBelow
    ? Math.min(highlight.y + highlight.height + spacing.md, screen.height - 220)
    : Math.max(highlight.y - 190, 60);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onFinish}>
      <View style={StyleSheet.absoluteFill}>
        {rect ? (
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
        ) : (
          <View style={styles.mask} />
        )}

        <View style={[styles.tooltip, { top: tooltipTop }]}>
          <Text style={styles.stepCount}>
            {stepIndex + 1} of {steps.length}
          </Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>

          <View style={styles.actions}>
            <Pressable onPress={onFinish} hitSlop={8}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
            <Pressable
              style={styles.nextButton}
              onPress={() => (isLast ? onFinish() : setStepIndex((i) => i + 1))}
            >
              <Text style={styles.nextLabel}>{isLast ? 'Done' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  mask: {
    position: 'absolute',
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
