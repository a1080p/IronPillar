import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const PIECES = 44;
const GOLD = '#D9A514';

// A one-shot burst of confetti falling down the screen. Sits on top of
// whatever it's placed in and never blocks touches.
export function Confetti({ delay = 0 }: { delay?: number }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;

  // Each piece gets its own lane, size, colour, spin and start time, fixed
  // for the life of the component.
  const pieces = useMemo(() => {
    const palette = [colors.primary, colors.accentFlame, GOLD, '#8FA0FF'];
    return Array.from({ length: PIECES }, (_, i) => {
      const start = Math.random() * 0.35;
      return {
        key: i,
        left: Math.random() * width,
        drift: (Math.random() - 0.5) * 120,
        size: 6 + Math.random() * 6,
        tall: Math.random() > 0.5,
        color: palette[i % palette.length],
        spins: 2 + Math.random() * 4,
        start,
        end: Math.min(1, start + 0.55 + Math.random() * 0.1),
      };
    });
  }, [colors.primary, colors.accentFlame, width]);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 3200,
      delay,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [progress, delay]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            top: -20,
            left: p.left,
            width: p.size,
            height: p.tall ? p.size * 1.8 : p.size,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: progress.interpolate({
              inputRange: [0, p.start, p.start + 0.01, p.end - 0.08, p.end, 1],
              outputRange: [0, 0, 1, 1, 0, 0],
            }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [p.start, p.end],
                  outputRange: [0, height * 0.9],
                  extrapolate: 'clamp',
                }),
              },
              {
                translateX: progress.interpolate({
                  inputRange: [p.start, p.end],
                  outputRange: [0, p.drift],
                  extrapolate: 'clamp',
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [p.start, p.end],
                  outputRange: ['0deg', `${Math.round(p.spins * 360)}deg`],
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
