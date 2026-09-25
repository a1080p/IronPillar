import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <View style={styles.content}>
        <Text style={styles.heading}>Settings</Text>

        <View style={styles.rowGroup}>
          <Pressable style={styles.row} onPress={() => router.push('/edit-profile')}>
            <Text style={styles.rowLabel}>Edit Profile</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/account-details')}>
            <Text style={styles.rowLabel}>Account Details</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={() => router.push('/history')}>
            <Text style={styles.rowLabel}>History</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={signOut}>
            <Text style={styles.rowLabel}>Sign Out</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, padding: spacing.lg, gap: spacing.lg },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  rowGroup: { gap: spacing.lg },
  row: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted },
  rowLabel: { fontSize: typography.sizes.body, color: colors.primary, fontWeight: '600' },
});
