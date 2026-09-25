import { useMemo, useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { FlameIcon, GymIcon } from '../../../components/icons/BrandIcons';
import { WorkoutHeader } from '../../../components/WorkoutHeader';
import { radii, spacing, typography } from '../../../constants/theme';
import { useTheme, type ThemeColors } from '../../../contexts/ThemeContext';
import { useWorkout } from '../../../hooks/useWorkout';
import { useAuth } from '../../../contexts/AuthContext';
import type { InfoSection } from '../../../types/models';

type Tab = 'overview' | 'tips' | 'equipment';

export default function WorkoutDetailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { id, generated } = useLocalSearchParams<{ id: string; generated?: string }>();
  const { user } = useAuth();
  const { workout: template, loading } = useWorkout(id, user?.uid);
  const [tab, setTab] = useState<Tab>('overview');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const isOwnCustom =
    !!template && template.category === 'custom' && template.createdBy === user?.uid;
  const showBanner = !bannerDismissed && (generated === '1' || generated === 'failed');
  // Flattened, deduped list of equipment items so what's needed is visible up
  // front, not just in the Equipment tab. Prefers "Essential Equipment"-style
  // sections over alternates/troubleshooting bullets, which read oddly out of
  // context (e.g. "No Barbell? Replace with...").
  const equipmentSummary = template
    ? Array.from(
        new Set(
          (template.equipment.filter((s) => /essential/i.test(s.heading)).length > 0
            ? template.equipment.filter((s) => /essential/i.test(s.heading))
            : template.equipment
          )
            .flatMap((section) => section.bullets)
            .map((b) => b.split(' - ')[0].split(' (')[0].trim())
        )
      )
    : [];

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

        {showBanner && (
          <View style={[styles.banner, generated === 'failed' && styles.bannerWarn]}>
            <Text style={styles.bannerText}>
              {generated === 'failed'
                ? "Couldn't auto-generate details this time. Add them with Edit Details."
                : 'Overview, time, calories, equipment and tips were filled in by AI. Tap Edit Details to tweak them.'}
            </Text>
            <Pressable onPress={() => setBannerDismissed(true)} hitSlop={12}>
              <Ionicons name="close" size={18} color={colors.primary} />
            </Pressable>
          </View>
        )}

        <View style={styles.statsRow}>
          <Stat icon={<Ionicons name="alarm" size={16} color={colors.primary} />} label={`${template.durationMinutes} Minutes`} />
          {template.equipmentRequired && (
            <Stat icon={<GymIcon size={16} color={colors.primary} />} label="Equipment Required" />
          )}
          <Stat icon={<FlameIcon size={16} color={colors.primary} />} label={template.caloriesRangeLabel} />
        </View>

        {equipmentSummary.length > 0 && (
          <View style={styles.equipmentSummary}>
            <Text style={styles.equipmentSummaryHeading}>Equipment Needed</Text>
            <Text style={styles.equipmentSummaryText}>{equipmentSummary.join(' • ')}</Text>
          </View>
        )}

        {isOwnCustom && (
          <Pressable
            style={styles.editLink}
            onPress={() => router.push(`/workout/${template.id}/edit`)}
          >
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={styles.editLinkText}>Edit Details</Text>
          </Pressable>
        )}

        <View style={styles.tabs}>
          <TabButton label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
          <TabButton label="Workout Tips" active={tab === 'tips'} onPress={() => setTab('tips')} />
          <TabButton label="Equipment" active={tab === 'equipment'} onPress={() => setTab('equipment')} />
        </View>

        {tab === 'overview' && (
          <>
            <Text style={styles.overview}>
              {template.overview ??
                `Complete all ${template.exercises.length} exercises below in order, resting between sets as needed.`}
            </Text>
            {template.exercises.map((ex, i) => (
              <View key={ex.id} style={styles.exerciseRow}>
                <Text style={styles.exerciseTitle}>
                  {i + 1}: {ex.name}
                </Text>
                <Text style={styles.exerciseDetail}>Sets: {ex.targetSets}</Text>
                <Text style={styles.exerciseDetail}>
                  {ex.logType === 'duration' ? 'Target: ' : 'Reps: '}
                  {ex.targetRepsLabel}
                </Text>
                {ex.tips ? <Text style={styles.exerciseTip}>{ex.tips}</Text> : null}
              </View>
            ))}
          </>
        )}

        {tab === 'tips' &&
          (template.workoutTips.length > 0 ? (
            template.workoutTips.map((section) => <InfoBlock key={section.heading} section={section} />)
          ) : (
            <Text style={styles.emptyTab}>No workout tips yet.</Text>
          ))}

        {tab === 'equipment' &&
          (template.equipment.length > 0 ? (
            template.equipment.map((section) => <InfoBlock key={section.heading} section={section} />)
          ) : (
            <Text style={styles.emptyTab}>No equipment details yet.</Text>
          ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Get Started" onPress={() => router.push(`/workout/${template.id}/log`)} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ icon, label }: { icon: ReactNode; label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  return (
    <Text onPress={onPress} style={[styles.tabLabel, active && styles.tabLabelActive]}>
      {label} {'>'}
    </Text>
  );
}

function InfoBlock({ section }: { section: InfoSection }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
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

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { textAlign: 'center', marginTop: spacing.xl, color: colors.textMuted },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  title: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerWarn: { backgroundColor: '#FFF1E0' },
  bannerText: { flex: 1, color: colors.text, fontSize: typography.sizes.small, lineHeight: 18 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginBottom: spacing.md },
  equipmentSummary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  equipmentSummaryHeading: {
    fontWeight: '700',
    color: colors.primary,
    fontSize: typography.sizes.small,
    marginBottom: spacing.xs,
  },
  equipmentSummaryText: { color: colors.text, fontSize: typography.sizes.small, lineHeight: 18 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.lg },
  editLinkText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small },
  overview: { color: colors.text, lineHeight: 21, marginBottom: spacing.lg },
  exerciseTip: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: 4 },
  emptyTab: { color: colors.textMuted },
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
