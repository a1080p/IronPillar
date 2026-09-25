import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlameIcon } from './icons/BrandIcons';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Logo } from './Logo';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const MENU_ITEMS = [
  { label: 'Settings', route: '/settings' as const },
  { label: 'History', route: '/history' as const },
  { label: 'Account Details', route: '/account-details' as const },
];

export function TopBar() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <View style={styles.bar}>
      <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
        <Ionicons name="menu" size={26} color={colors.text} />
      </Pressable>
      <Logo />
      <View style={styles.streak}>
        <Text style={styles.streakCount}>{profile?.streakCount ?? 0}</Text>
        <FlameIcon size={20} color={colors.accentFlame} />
      </View>

      <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={close}>
        {/* Re-provide safe-area context — a Modal renders outside the app's provider. */}
        <SafeAreaProvider>
          <Pressable style={styles.backdrop} onPress={close}>
            {/* Inner Pressable swallows taps so touching the drawer doesn't close it. */}
            <Pressable style={styles.drawer} onPress={() => {}}>
              <SafeAreaView edges={['top', 'bottom']} style={styles.drawerInner}>
              <Text style={styles.drawerHeading}>Menu</Text>

              <View style={styles.list}>
                {MENU_ITEMS.map((item) => (
                  <Pressable
                    key={item.label}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => {
                      close();
                      router.push(item.route);
                    }}
                  >
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>

              <View style={{ flex: 1 }} />

              <View style={[styles.row, styles.darkModeRow]}>
                <Text style={styles.rowLabel}>Dark Mode</Text>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: colors.divider, true: colors.primary }}
                  thumbColor={colors.background}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.row, styles.signOutRow, pressed && styles.rowPressed]}
                onPress={async () => {
                  close();
                  await signOut();
                }}
              >
                <Text style={styles.signOutLabel}>Sign out</Text>
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              </Pressable>
              </SafeAreaView>
            </Pressable>
          </Pressable>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakCount: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: colors.primary,
  },
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    width: '74%',
    backgroundColor: colors.background,
    borderTopRightRadius: radii.lg,
    borderBottomRightRadius: radii.lg,
  },
  drawerInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  drawerHeading: {
    fontSize: typography.sizes.small,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingVertical: spacing.sm,
  },
  list: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowLabel: {
    fontSize: typography.sizes.body,
    fontWeight: '600',
    color: colors.primary,
  },
  darkModeRow: {
    borderBottomWidth: 0,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  signOutRow: {
    borderBottomWidth: 0,
  },
  signOutLabel: {
    fontSize: typography.sizes.body,
    fontWeight: '700',
    color: colors.danger,
  },
});
