// The quick celebration that pops in after each finished exercise. It sits
// over the next exercise without blocking it and clears itself.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import type { Cheer } from '../lib/cheers';

const VISIBLE_MS = 2000;

export function ExerciseCheer({ cheer, onDone }: { cheer: Cheer | null; onDone: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!cheer) return;
    scale.setValue(0.6);
    opacity.setValue(0);
    const pop = Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]);
    const fade = Animated.timing(opacity, {
      toValue: 0,
      duration: 260,
      delay: VISIBLE_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    const run = Animated.sequence([pop, fade]);
    run.start(({ finished }) => finished && onDone());
    return () => run.stop();
  }, [cheer]);

  if (!cheer) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Animated.View style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}>
        <Pressable
          style={styles.card}
          onPress={onDone}
          accessibilityRole="alert"
          accessibilityLabel={`${cheer.title} ${cheer.body}`}
        >
          <Text style={styles.emoji}>{cheer.emoji}</Text>
          <View style={styles.textWrap}>
            <Text style={styles.title}>{cheer.title}</Text>
            <Text style={styles.body}>{cheer.body}</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    paddingTop: 110,
    paddingHorizontal: spacing.lg,
  },
  cardWrap: { width: '100%', maxWidth: 420 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  emoji: { fontSize: 34 },
  textWrap: { flex: 1 },
  title: { color: colors.textOnDark, fontWeight: '800', fontSize: typography.sizes.md },
  body: { color: colors.textOnDark, fontSize: typography.sizes.body, marginTop: 2 },
});
