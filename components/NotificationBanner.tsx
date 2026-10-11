// The in-app banner that slides down from the top when a notification
// arrives while the app is open. Tap to open it, swipe up or wait to dismiss.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useNotifications, type NotificationKind } from '../contexts/NotificationsContext';

const VISIBLE_MS = 4500;

export const NOTIFICATION_ICONS: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  friend_request: 'person-add',
  friend_request_accepted: 'people',
  reaction: 'heart',
  comment: 'chatbubble',
  badge_earned: 'ribbon',
  streak_milestone: 'flame',
  streak_at_risk: 'flame',
};

export function NotificationBanner() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { banner, dismissBanner } = useNotifications();
  const translateY = useRef(new Animated.Value(-200)).current;

  const hide = () =>
    Animated.timing(translateY, { toValue: -200, duration: 200, useNativeDriver: true }).start(
      () => dismissBanner()
    );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -8,
      onPanResponderRelease: (_, g) => {
        if (g.dy < -20) hide();
      },
    })
  ).current;

  useEffect(() => {
    if (!banner) return;
    translateY.setValue(-200);
    Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    const timer = setTimeout(hide, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [banner?.id]);

  if (!banner) return null;
  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + spacing.xs, transform: [{ translateY }] }]}
      {...pan.panHandlers}
    >
      <Pressable
        style={styles.card}
        onPress={() => {
          hide();
          router.push(banner.href);
        }}
        accessibilityRole="alert"
        accessibilityLabel={`${banner.title}. ${banner.body}`}
      >
        <View style={styles.iconWrap}>
          <Ionicons name={NOTIFICATION_ICONS[banner.kind]} size={20} color={colors.textOnDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {banner.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 1000 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surfaceMuted,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', color: colors.text, fontSize: typography.sizes.body },
  body: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
});
