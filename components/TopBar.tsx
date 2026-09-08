import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Logo } from './Logo';
import { colors, spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

export function TopBar() {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View style={styles.bar}>
      <Pressable onPress={() => setMenuOpen(true)} hitSlop={12}>
        <Ionicons name="menu" size={26} color={colors.text} />
      </Pressable>
      <Logo />
      <View style={styles.streak}>
        <Text style={styles.streakCount}>{profile?.streakCount ?? 0}</Text>
        <Ionicons name="flame" size={20} color={colors.accentFlame} />
      </View>

      <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <SafeAreaView style={styles.drawer}>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push('/settings');
              }}
            >
              <Text style={styles.link}>Settings</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push('/history');
              }}
            >
              <Text style={styles.link}>History</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                router.push('/account-details');
              }}
            >
              <Text style={styles.link}>Account Details</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={async () => {
                setMenuOpen(false);
                await signOut();
              }}
            >
              <Text style={styles.signOut}>Sign out</Text>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  drawer: {
    width: '65%',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.lg,
  },
  link: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    marginBottom: spacing.lg,
  },
  signOut: {
    fontSize: typography.sizes.body,
    color: colors.primary,
  },
});
