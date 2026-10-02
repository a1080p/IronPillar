import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { Confetti } from '../components/Confetti';
import { Logo } from '../components/Logo';
import { PRO_FEATURES } from '../constants/pro';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

// Shown once, right after someone subscribes: a short celebration and what
// Pro just unlocked. "Let's Go" returns to wherever they opened the paywall.
export default function ProWelcomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const badge = useRef(new Animated.Value(0)).current;
  const rows = useRef(PRO_FEATURES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Vibration.vibrate(60);
    Animated.sequence([
      Animated.spring(badge, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.stagger(
        90,
        rows.map((v) =>
          Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true })
        )
      ),
    ]).start();
  }, [badge, rows]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Logo />
        <Animated.View
          style={[
            styles.badge,
            {
              opacity: badge,
              transform: [{ scale: badge.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
            },
          ]}
        >
          <Ionicons name="star" size={56} color={colors.textOnDark} />
        </Animated.View>
        <Text style={styles.kicker}>YOU'RE PRO</Text>
        <Text style={styles.title} accessibilityRole="header">
          Welcome to Iron Pillar Pro
        </Text>
        <Text style={styles.subtitle}>Thanks for backing Iron Pillar. Here's what you just unlocked.</Text>

        <View style={styles.list}>
          {PRO_FEATURES.map((f, i) => (
            <Animated.View
              key={f.title}
              style={[
                styles.row,
                {
                  opacity: rows[i],
                  transform: [{ translateY: rows[i].interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
                },
              ]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={f.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{f.title}</Text>
                <Text style={styles.rowText}>{f.description}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Let's Go" onPress={() => router.back()} />
      </View>
      <Confetti delay={300} />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
    badge: {
      width: 112,
      height: 112,
      borderRadius: 56,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xl,
    },
    kicker: {
      color: colors.accentFlameText,
      fontWeight: '800',
      letterSpacing: 3,
      fontSize: typography.sizes.small,
      marginTop: spacing.lg,
    },
    title: {
      color: colors.primary,
      fontWeight: '800',
      fontSize: typography.sizes.lg,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    subtitle: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
    list: { alignSelf: 'stretch', marginTop: spacing.xl, gap: spacing.md },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: { color: colors.text, fontWeight: '700', fontSize: typography.sizes.body },
    rowText: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
    footer: { padding: spacing.lg },
  });
