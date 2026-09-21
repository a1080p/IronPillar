import { Ionicons } from '@expo/vector-icons';

// Icon shapes a user can build a preset avatar from. Colors are chosen
// separately (see AVATAR_COLORS) so any icon can pair with any color.
export interface AvatarIconOption {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const AVATAR_ICONS: AvatarIconOption[] = [
  { key: 'barbell', icon: 'barbell' },
  { key: 'flame', icon: 'flame' },
  { key: 'flash', icon: 'flash' },
  { key: 'fitness', icon: 'fitness' },
  { key: 'trophy', icon: 'trophy' },
  { key: 'rocket', icon: 'rocket' },
  { key: 'heart', icon: 'heart' },
  { key: 'leaf', icon: 'leaf' },
  { key: 'planet', icon: 'planet' },
  { key: 'paw', icon: 'paw' },
  { key: 'skull', icon: 'skull' },
  { key: 'star', icon: 'star' },
];

export const AVATAR_COLORS: string[] = [
  '#3D4FEA', // blue
  '#FF8A00', // orange
  '#F5B301', // yellow
  '#E5484D', // red
  '#0EA5A5', // teal
  '#7C3AED', // purple
  '#EC4899', // pink
  '#16A34A', // green
  '#2563EB', // royal blue
  '#B45309', // brown
  '#334155', // slate
  '#D97706', // amber
];

export const DEFAULT_AVATAR_ICON = AVATAR_ICONS[0].key;
export const DEFAULT_AVATAR_COLOR = AVATAR_COLORS[0];

// Fixed icon+color pairs shown as the picker's grid — one distinct color per
// icon, so choosing an icon and choosing a color is a single tap instead of
// two separate steps. Also resolves legacy avatarKey values saved before
// icon/color were ever split into separate pickers (a bare key like
// "rocket") to the same look.
export interface AvatarPreset {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'barbell', icon: 'barbell', color: '#3D4FEA' },
  { key: 'flame', icon: 'flame', color: '#FF8A00' },
  { key: 'flash', icon: 'flash', color: '#F5B301' },
  { key: 'fitness', icon: 'fitness', color: '#E5484D' },
  { key: 'trophy', icon: 'trophy', color: '#0EA5A5' },
  { key: 'rocket', icon: 'rocket', color: '#7C3AED' },
  { key: 'heart', icon: 'heart', color: '#EC4899' },
  { key: 'leaf', icon: 'leaf', color: '#16A34A' },
  { key: 'planet', icon: 'planet', color: '#2563EB' },
  { key: 'paw', icon: 'paw', color: '#B45309' },
  { key: 'skull', icon: 'skull', color: '#334155' },
  { key: 'star', icon: 'star', color: '#D97706' },
];

// avatarKey is stored as "<iconKey>:<colorHex>" going forward. Parses either
// that format or a legacy bare icon key.
export function parseAvatarKey(
  key: string | null | undefined
): { iconKey: string; icon: keyof typeof Ionicons.glyphMap; color: string } | undefined {
  if (!key) return undefined;

  if (key.includes(':')) {
    const [iconKey, color] = key.split(':');
    const iconOption = AVATAR_ICONS.find((i) => i.key === iconKey);
    if (!iconOption) return undefined;
    return { iconKey, icon: iconOption.icon, color: color || DEFAULT_AVATAR_COLOR };
  }

  const legacy = AVATAR_PRESETS.find((p) => p.key === key);
  if (legacy) return { iconKey: legacy.key, icon: legacy.icon, color: legacy.color };

  return undefined;
}

export function buildAvatarKey(iconKey: string, color: string): string {
  return `${iconKey}:${color}`;
}
