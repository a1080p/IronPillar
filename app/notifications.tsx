import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { NOTIFICATION_ICONS } from '../components/NotificationBanner';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useNotifications } from '../contexts/NotificationsContext';

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { notifications, isUnread, markAllSeen } = useNotifications();
  // Unread dots are worked out from the read time as it was when the screen
  // opened, then everything is marked read when leaving.
  const unreadIds = useMemo(
    () => new Set(notifications.filter(isUnread).map((n) => n.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(() => () => markAllSeen(), []);

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Notifications
        </Text>
        {notifications.length === 0 ? (
          <Text style={styles.empty}>
            Nothing yet. Friend requests, reactions, comments and streak alerts show up here.
          </Text>
        ) : (
          notifications.map((n) => {
            const unread = unreadIds.has(n.id);
            return (
              <Pressable
                key={n.id}
                style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(n.href)}
                accessibilityRole="button"
                accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.title}. ${n.body}`}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name={NOTIFICATION_ICONS[n.kind]} size={18} color={colors.textOnDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{n.title}</Text>
                  <Text style={styles.body}>{n.body}</Text>
                  <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                </View>
                {unread && <View style={styles.dot} />}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 120, gap: spacing.sm },
  heading: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  rowUnread: { backgroundColor: colors.surfaceMuted },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', color: colors.text },
  body: { color: colors.text, fontSize: typography.sizes.small, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accentFlame },
});
