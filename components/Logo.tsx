import { Image, StyleSheet } from 'react-native';

const ASPECT_RATIO = 3199 / 900;

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' | 'xl' }) {
  const height = size === 'xl' ? 72 : size === 'lg' ? 56 : 32;
  return (
    <Image
      source={require('../assets/logo.png')}
      style={[styles.logo, { height, width: height * ASPECT_RATIO }]}
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
