import { Image, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

// Figma lockup proportions (assets/Iron Pillar assets/Asset 7@2x.png) at 900px tall.
const ASPECT_RATIO = 2373 / 900;

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' | 'xl' }) {
  const { colors } = useTheme();
  const height = size === 'xl' ? 110 : size === 'lg' ? 88 : 32;
  return (
    <Image
      source={require('../assets/logo.png')}
      style={[styles.logo, { height, width: height * ASPECT_RATIO, tintColor: colors.text }]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Iron Pillar"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: 'center',
  },
});
