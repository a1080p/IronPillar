import { RankEmblem } from '../components/RankEmblem';
import { rankForXp } from '../constants/rank';
import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { Button } from '../components/Button';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useFriends } from '../hooks/useFriends';

// Everyone you're friends with. Opened from the friend count on your
// profile and on the Social tab.
export default function FriendsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user } = useAuth();
  const { friends, loading } = useFriends(user?.uid);

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading} accessibilityRole="header">
          Friends{friends.length > 0 ? ` (${friends.length})` : ''}
        </Text>
        {!loading && friends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No friends yet. Add someone by username on the Social tab.
            </Text>
            <Button label="Find Friends" onPress={() => router.replace('/social' as Href)} />
          </View>
        ) : (
          friends.map((friend) => (
            <Pressable
              key={friend.uid}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => router.push(`/friend/${friend.uid}` as Href)}
              accessibilityRole="button"
              accessibilityLabel={`View ${friend.name}'s profile`}
            >
              <Ionicons name="person-circle" size={40} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{friend.name}</Text>
                <Text style={styles.handle}>@{friend.username}</Text>
              </View>
              {friend.xp != null && <RankEmblem rank={rankForXp(friend.xp)} size={24} framed={friend.pro === true} />}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  rowPressed: { opacity: 0.7 },
  name: { fontWeight: '700', color: colors.text, fontSize: typography.sizes.body },
  handle: { color: colors.textMuted, fontSize: typography.sizes.small },
  empty: { gap: spacing.md, alignItems: 'stretch' },
  emptyText: { color: colors.textMuted, textAlign: 'center' },
});
