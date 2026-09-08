import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { colors, spacing, typography } from '../../../constants/theme';
import { useWorkout } from '../../../hooks/useWorkout';
import { useAuth } from '../../../contexts/AuthContext';
import type { InfoSection } from '../../../types/models';

type Tab = 'overview' | 'tips' | 'equipment';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { workout: template, loading } = useWorkout(id, user?.uid);
  const [tab, setTab] = useState<Tab>('overview');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.loading}>Loading workout...</Text>
      </SafeAreaView>
    );
  }

  if (!template) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <Text style={styles.loading}>Workout not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{template.name}</Text>

        <View style={styles.statsRow}>
          <Stat icon="alarm" label={`${template.durationMinutes} Minutes`} />
          {template.equipmentRequired && <Stat icon="barbell" label="Equipment Required" />}
          <Stat icon="flame" label={template.caloriesRangeLabel} />
        </View>

        <View style={styles.tabs}>
          <TabButton label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
          <TabButton label="Workout Tips" active={tab === 'tips'} onPress={() => setTab('tips')} />
          <TabButton label="Equipment" active={tab === 'equipment'} onPress={() => setTab('equipment')} />
        </View>

        {tab === 'overview' &&
          template.exercises.map((ex, i) => (
            <View key={ex.id} style={styles.exerciseRow}>
              <Text style={styles.exerciseTitle}>
                {i + 1}: {ex.name}
              </Text>
              <Text style={styles.exerciseDetail}>Sets: {ex.targetSets}</Text>
              <Text style={styles.exerciseDetail}>
                {ex.logType === 'duration' ? 'Target: ' : 'Reps: '}
                {ex.targetRepsLabel}
              </Text>
            </View>
          ))}

        {tab === 'tips' && template.workoutTips.map((section) => <InfoBlock key={section.heading} section={section} />)}

        {tab === 'equipment' && template.equipment.map((section) => <InfoBlock key={section.heading} section={section} />)}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Get Started" onPress={() => router.push(`/workout/${template.id}/log`)} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress} style={[styles.tabLabel, active && styles.tabLabelActive]}>
      {label} {'>'}
    </Text>
  );
}

function InfoBlock({ section }: { section: InfoSection }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoHeading}>{section.heading}</Text>
      {section.bullets.map((b) => (
        <Text key={b} style={styles.infoBullet}>
          {'•'} {b}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { textAlign: 'center', marginTop: spacing.xl, color: colors.textMuted },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  title: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.lg },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { color: colors.primary, fontWeight: '600', fontSize: typography.sizes.small },
  tabs: { gap: spacing.md, marginBottom: spacing.lg },
  tabLabel: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textMuted },
  tabLabelActive: { color: colors.primary },
  exerciseRow: { marginBottom: spacing.md },
  exerciseTitle: { fontWeight: '700', color: colors.primary, marginBottom: 2 },
  exerciseDetail: { color: colors.text },
  infoBlock: { marginBottom: spacing.lg },
  infoHeading: { fontWeight: '700', color: colors.primary, marginBottom: spacing.sm },
  infoBullet: { color: colors.text, marginBottom: 4 },
  footer: { padding: spacing.lg },
});
