import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Logo } from './Logo';
import { useTheme } from '../contexts/ThemeContext';

const MIN_VISIBLE_MS = 900;

// Logo splash shown over the app while it starts. The logo eases in, holds
// until the app is `ready` (and a short minimum, so it never just flickers),
// then the whole thing fades away.
export function AnimatedSplash({ ready }: { ready: boolean }) {
  const { colors } = useTheme();
  const intro = useRef(new Animated.Value(0)).current;
  const outro = useRef(new Animated.Value(1)).current;
  const [minElapsed, setMinElapsed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    Animated.timing(intro, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(outro, {
      toValue: 0,
      duration: 350,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => setGone(true));
  }, [ready, minElapsed, outro]);

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready && minElapsed ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.splash, { backgroundColor: colors.background, opacity: outro }]}
    >
      <Animated.View
        style={{
          opacity: intro,
          transform: [
            { scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
            { translateY: intro.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
          ],
        }}
      >
        <Logo size="lg" />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  splash: { alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
