// Approximated from the Iron Pillar Figma style guide screenshot.
// TODO: replace with exact hex values once Figma dev-mode/inspect access is available.
export const lightColors: Record<
  | 'background'
  | 'backgroundDark'
  | 'text'
  | 'textMuted'
  | 'textOnDark'
  | 'primary'
  | 'primaryPressed'
  | 'accentFlame'
  | 'border'
  | 'surfaceMuted'
  | 'divider'
  | 'success'
  | 'danger',
  string
> = {
  background: '#FFFFFF',
  backgroundDark: '#1E1E1E',
  text: '#1A1A1A',
  textMuted: '#6B6B6B',
  textOnDark: '#FFFFFF',
  primary: '#3D4FEA',
  primaryPressed: '#2E3DBE',
  accentFlame: '#FF8A00',
  border: '#3D4FEA',
  surfaceMuted: '#F2F2F2',
  divider: '#E4E4E4',
  success: '#FF8A00',
  danger: '#E5484D',
};

// Dark-mode counterpart — same brand hues, re-balanced for a dark surface
// (brighter primary/flame for contrast, neutral dark surfaces/dividers).
export const darkColors: typeof lightColors = {
  background: '#121218',
  backgroundDark: '#000000',
  text: '#F5F5F7',
  textMuted: '#9B9BA5',
  textOnDark: '#FFFFFF',
  primary: '#5B6AF0',
  primaryPressed: '#4650C4',
  accentFlame: '#FF9C33',
  border: '#5B6AF0',
  surfaceMuted: '#1E1E26',
  divider: '#2C2C36',
  success: '#FF9C33',
  danger: '#FF6B6F',
};

export type ThemeColors = typeof lightColors;

export const typography = {
  heading: { fontFamily: 'SFProSemiBold', fontWeight: '700' as const },
  body: { fontFamily: 'SFProRegular', fontWeight: '400' as const },
  sizes: {
    xl: 32,
    lg: 24,
    md: 18,
    body: 16,
    small: 13,
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 24,
  pill: 999,
} as const;
