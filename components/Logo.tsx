import { Image, StyleSheet } from 'react-native';

const ASPECT_RATIO = 788 / 299;

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const height = size === 'lg' ? 40 : 24;
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
