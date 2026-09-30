import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { Badge, BadgeTier } from '../types/models';

// Ring colour per tier, each at least 3:1 against both the light and dark
// backgrounds. Platinum uses the brand colour so the top tier reads
// as "Iron Pillar's own" rather than a fourth metal.
const TIER_COLORS: Record<BadgeTier, string> = {
  bronze: '#B8733A',
  silver: '#6F7C8D',
  gold: '#A87B00',
  platinum: '#3D4FEA',
};

export function tierColor(tier: BadgeTier) {
  return TIER_COLORS[tier];
}

// A badge drawn as a medal: tier-coloured ring around the badge's own icon.
// Locked badges are drawn in muted grey.
export function BadgeMedal({
  badge,
  size = 64,
  locked = false,
}: {
  badge: Badge;
  size?: number;
  locked?: boolean;
}) {
  const { colors } = useTheme();
  const ring = locked ? colors.divider : TIER_COLORS[badge.tier];
  const iconName = (badge.iconKey in Ionicons.glyphMap ? badge.iconKey : 'ribbon') as keyof typeof Ionicons.glyphMap;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${badge.name} badge, ${locked ? 'locked' : badge.tier}`}
      style={[
        styles.medal,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: Math.max(2, Math.round(size / 18)),
          borderColor: ring,
          backgroundColor: locked ? colors.surfaceMuted : colors.background,
        },
      ]}
    >
      <Ionicons
        name={locked ? 'lock-closed' : iconName}
        size={Math.round(size * (locked ? 0.34 : 0.46))}
        color={locked ? colors.textMuted : ring}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  medal: { alignItems: 'center', justifyContent: 'center' },
});
