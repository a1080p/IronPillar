// Import with AI (Pro): bring workouts, body weights and meals in from notes,
// a CSV/text export, or screenshots of another app. Nothing is saved until
// the user reviews what was found. See lib/importData.ts.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { WorkoutHeader } from '../components/WorkoutHeader';
import { Button } from '../components/Button';
import { ProBadge, ProLockCard } from '../components/ProLock';
import { todayDateString } from '../constants/gamification';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { usePurchases } from '../contexts/PurchasesContext';
import { useUnits } from '../hooks/useUnits';
import { appAlert } from '../lib/appAlert';
import {
  IMPORT_MAX_IMAGES,
  IMPORT_MAX_TEXT,
  parseImport,
  saveImport,
  type ImportImage,
  type ImportPreview,
} from '../lib/importData';

const MAX_IMAGE_BASE64 = 6_000_000;

function shortDate(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export default function ImportScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { isPro } = usePurchases();
  const units = useUnits();
  const defaultWeightUnit = units === 'metric' ? 'kg' : 'lb';

  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState('');
  const [images, setImages] = useState<ImportImage[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  // Keys of items the user unticked, e.g. "w-3", "b-0", "m-12".
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  if (!isPro) {
    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Import with AI</Text>
          <ProLockCard
            title="Import with AI"
            description="Paste notes, pick a CSV, or add screenshots from another app. AI pulls out your workouts, weigh-ins and meals so everything is in one place."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const combinedText = [text.trim(), fileText.trim()].filter(Boolean).join('\n\n');
  const canRead = (combinedText.length > 0 || images.length > 0) && !reading;

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/*', 'text/csv', 'text/comma-separated-values', 'application/csv'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const contents = await new File(asset.uri).text();
      if (contents.length > IMPORT_MAX_TEXT) {
        appAlert('File too large', 'Pick a smaller file, or split it into a few imports.');
        return;
      }
      setFileName(asset.name);
      setFileText(contents);
    } catch (e) {
      appAlert('Could not open that file', e instanceof Error ? e.message : 'Try another file.');
    }
  };

  const pickImages = async () => {
    const room = IMPORT_MAX_IMAGES - images.length;
    if (room <= 0) {
      appAlert('That’s the limit', `You can add up to ${IMPORT_MAX_IMAGES} screenshots at a time.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      base64: true,
      quality: 0.6,
    });
    if (result.canceled) return;
    const picked: ImportImage[] = [];
    let tooBig = 0;
    for (const asset of result.assets.slice(0, room)) {
      if (!asset.base64) continue;
      if (asset.base64.length > MAX_IMAGE_BASE64) {
        tooBig++;
        continue;
      }
      const type = asset.mimeType;
      const mediaType: ImportImage['mediaType'] =
        type === 'image/png' || type === 'image/webp' || type === 'image/gif' ? type : 'image/jpeg';
      picked.push({ mediaType, data: asset.base64 });
    }
    if (tooBig > 0) {
      appAlert('Some screenshots were too large', `${plural(tooBig, 'image')} skipped. Try cropping them.`);
    }
    setImages((prev) => [...prev, ...picked].slice(0, IMPORT_MAX_IMAGES));
  };

  const read = async () => {
    setReading(true);
    try {
      const result = await parseImport({
        ...(combinedText ? { text: combinedText.slice(0, IMPORT_MAX_TEXT) } : {}),
        ...(images.length > 0 ? { images } : {}),
        referenceDate: todayDateString(),
        defaultWeightUnit,
      });
      setSkipped(new Set());
      setPreview(result);
    } catch (e) {
      appAlert('Could not read that', e instanceof Error ? e.message : 'Try again.', [{ text: 'OK' }]);
    } finally {
      setReading(false);
    }
  };

  const toggle = (key: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const renderRow = (id: string, title: string, sub: string) => {
    const on = !skipped.has(id);
    return (
      <Pressable
        key={id}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        onPress={() => toggle(id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${title}, ${sub}`}
      >
        <Ionicons
          name={on ? 'checkbox' : 'square-outline'}
          size={22}
          color={on ? colors.primary : colors.textMuted}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, !on && styles.rowOff]}>{title}</Text>
          <Text style={styles.rowSub}>{sub}</Text>
        </View>
      </Pressable>
    );
  };

  if (preview) {
    const workouts = preview.workouts.filter((_, i) => !skipped.has(`w-${i}`));
    const weights = preview.weights.filter((_, i) => !skipped.has(`b-${i}`));
    const meals = preview.meals.filter((_, i) => !skipped.has(`m-${i}`));
    const selected = workouts.length + weights.length + meals.length;
    const found = preview.workouts.length + preview.weights.length + preview.meals.length;

    const save = async () => {
      setSaving(true);
      try {
        const saved = await saveImport({ workouts, weights, meals, defaultWeightUnit });
        const parts = [
          saved.workouts ? plural(saved.workouts, 'workout') : null,
          saved.weights ? plural(saved.weights, 'weigh-in') : null,
          saved.meals ? plural(saved.meals, 'meal') : null,
        ].filter(Boolean);
        appAlert('Imported', `Added ${parts.join(', ')}.`);
        router.back();
      } catch (e) {
        appAlert('Could not save', e instanceof Error ? e.message : 'Try again.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <SafeAreaView style={styles.container}>
        <WorkoutHeader onBack={() => setPreview(null)} />
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.heading}>Review your import</Text>
          {preview.summary ? <Text style={styles.summary}>{preview.summary}</Text> : null}
          {found === 0 ? (
            <Text style={styles.empty}>
              Nothing to import was found. Try clearer screenshots or a different file.
            </Text>
          ) : (
            <Text style={styles.hint}>Untick anything that looks wrong before adding.</Text>
          )}

          {preview.workouts.length > 0 && <Text style={styles.section}>Workouts</Text>}
          {preview.workouts.map((w, i) => {
            const details = [
              shortDate(w.date),
              w.exercises.length ? plural(w.exercises.length, 'exercise') : null,
              w.distanceKm != null
                ? units === 'metric'
                  ? `${w.distanceKm.toFixed(1)} km`
                  : `${(w.distanceKm / 1.609).toFixed(1)} mi`
                : null,
              w.durationMinutes ? `${Math.round(w.durationMinutes)} min` : null,
            ].filter(Boolean);
            return renderRow(`w-${i}`, w.name, details.join(' · '));
          })}

          {preview.weights.length > 0 && <Text style={styles.section}>Body weight</Text>}
          {preview.weights.map((b, i) => renderRow(`b-${i}`, `${b.weight} ${b.unit}`, shortDate(b.date)))}

          {preview.meals.length > 0 && <Text style={styles.section}>Meals</Text>}
          {preview.meals.map((m, i) =>
            renderRow(
              `m-${i}`,
              m.name,
              [
                `${m.calories} cal`,
                m.proteinG != null ? `${m.proteinG} g protein` : null,
                `${m.meal[0].toUpperCase()}${m.meal.slice(1)} · ${shortDate(m.date)}`,
              ]
                .filter(Boolean)
                .join(' · ')
            )
          )}

          <Text style={styles.note}>
            Imported workouts appear in History and your stats. They don't earn XP or count toward
            your streak.
          </Text>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={selected > 0 ? `Add ${plural(selected, 'item')}` : 'Nothing selected'}
            onPress={save}
            disabled={selected === 0}
            loading={saving}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <WorkoutHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.titleRow}>
            <Text style={styles.heading}>Import with AI</Text>
            <ProBadge />
          </View>
          <Text style={styles.hint}>
            Bring in workouts, weigh-ins and meals from your notes, a spreadsheet, or screenshots of
            another app. You'll review everything before it's added.
          </Text>

          <Text style={styles.section}>Paste notes</Text>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={setText}
            placeholder={'e.g. Mon 10/6 bench 135x8, 155x6, 155x5\nSquat 185 3x5\nWeighed 182'}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={IMPORT_MAX_TEXT}
            accessibilityLabel="Paste notes to import"
          />

          <View style={styles.pickRow}>
            <Pressable
              style={({ pressed }) => [styles.pick, pressed && { opacity: 0.7 }]}
              onPress={pickFile}
              accessibilityRole="button"
              accessibilityLabel="Choose a CSV or text file"
            >
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
              <Text style={styles.pickText}>{fileName ?? 'CSV or text file'}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.pick, pressed && { opacity: 0.7 }]}
              onPress={pickImages}
              accessibilityRole="button"
              accessibilityLabel="Choose screenshots"
            >
              <Ionicons name="images-outline" size={22} color={colors.primary} />
              <Text style={styles.pickText}>
                {images.length > 0 ? plural(images.length, 'screenshot') : 'Screenshots'}
              </Text>
            </Pressable>
          </View>
          {(fileName || images.length > 0) && (
            <Text
              style={styles.clear}
              onPress={() => {
                setFileName(null);
                setFileText('');
                setImages([]);
              }}
              accessibilityRole="button"
            >
              Clear file and screenshots
            </Text>
          )}

          {reading && (
            <View style={styles.readingBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.hint}>Reading your data. This can take up to a minute.</Text>
            </View>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Read with AI" onPress={read} disabled={!canRead} loading={reading} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { fontSize: typography.sizes.lg, fontWeight: '700', color: colors.primary },
  hint: { color: colors.textMuted, fontSize: typography.sizes.small },
  summary: { color: colors.text },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  section: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.md, marginTop: spacing.sm },
  textArea: {
    minHeight: 140,
    borderWidth: 1.5,
    borderColor: colors.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.sizes.body,
    textAlignVertical: 'top',
  },
  pickRow: { flexDirection: 'row', gap: spacing.sm },
  pick: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  pickText: { color: colors.primary, fontWeight: '700', fontSize: typography.sizes.small, textAlign: 'center' },
  clear: { color: colors.textMuted, fontSize: typography.sizes.small, textDecorationLine: 'underline' },
  readingBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceMuted,
  },
  rowTitle: { color: colors.text, fontWeight: '600' },
  rowOff: { color: colors.textMuted, textDecorationLine: 'line-through' },
  rowSub: { color: colors.textMuted, fontSize: typography.sizes.small },
  note: { color: colors.textMuted, fontSize: typography.sizes.small, marginTop: spacing.md },
  footer: { padding: spacing.lg },
});
