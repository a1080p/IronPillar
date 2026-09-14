import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, View } from 'react-native';
import { parseAvatarKey } from '../constants/avatars';
import { colors, radii } from '../constants/theme';

// Renders a user's avatar: an uploaded photo if present, otherwise a chosen
// icon+color combo, otherwise the neutral person placeholder.
export function Avatar({
  url,
  presetKey,
  size = 120,
}: {
  url?: string | null;
  presetKey?: string | null;
  size?: number;
}) {
  const parsed = parseAvatarKey(presetKey);
  const iconSize = Math.round(size * 0.5);

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.base, { width: size, height: size, borderRadius: radii.pill }]}
      />
    );
  }

  if (parsed) {
    return (
      <View
        style={[
          styles.base,
          styles.centered,
          { width: size, height: size, borderRadius: radii.pill, backgroundColor: parsed.color, borderColor: parsed.color },
        ]}
      >
        <Ionicons name={parsed.icon} size={iconSize} color={colors.textOnDark} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.base,
        styles.centered,
        { width: size, height: size, borderRadius: radii.pill },
      ]}
    >
      <Ionicons name="person" size={iconSize} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  centered: { alignItems: 'center', justifyContent: 'center' },
});
