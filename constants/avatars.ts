import { Ionicons } from '@expo/vector-icons';

// Built-in avatars a user can pick without uploading a photo. Each is an
// Ionicons glyph on a solid tint; `avatarKey` on the profile stores `key`.
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

export function avatarPresetByKey(key: string | null | undefined): AvatarPreset | undefined {
  if (!key) return undefined;
  return AVATAR_PRESETS.find((p) => p.key === key);
}
