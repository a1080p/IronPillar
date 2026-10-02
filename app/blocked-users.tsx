import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { spacing, typography } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useBlockedUsers } from '../hooks/useBlockedUsers';
import { unblockUser } from '../lib/friends';

// People you've blocked, with Unblock. Unblocking doesn't re-add them as a friend.
export default function BlockedUsersScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const { blocked, loading } = useBlockedUsers(user?.uid);

  const confirmUnblock = (uid: string, name: string) =>
    Alert.alert(`Unblock ${name}?`, 'They will be able to find and add you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: () =>
          unblockUser(uid).catch((e) =>
            Alert.alert('Could not unblock', e instanceof Error ? e.message : 'Try again.')
          ),
      },
    ]);

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Blocked Users
        </Text>
        <Text style={styles.note}>
          Blocked people can't find you, add you, or see your profile and activity.
        </Text>
        {!loading && blocked.length === 0 && <Text style={styles.empty}>You haven't blocked anyone.</Text>}
        {blocked.map((b) => (
          <View key={b.uid} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{b.name}</Text>
              {b.username ? <Text style={styles.handle}>@{b.username}</Text> : null}
            </View>
            <Pressable
              onPress={() => confirmUnblock(b.uid, b.name)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${b.name}`}
            >
              <Text style={styles.unblock}>Unblock</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.lg },
    heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
    note: { color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
    empty: { color: colors.textMuted },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    name: { color: colors.text, fontWeight: '700' },
    handle: { color: colors.textMuted, fontSize: typography.sizes.small },
    unblock: { color: colors.primary, fontWeight: '700' },
  });
