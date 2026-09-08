import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/theme';

// Placeholder wordmark until the real Iron Pillar logo asset is exported from Figma.
export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.text, size === 'lg' && styles.textLg]}>IRON PILLAR</Text>
      <Text style={[styles.icon, size === 'lg' && styles.iconLg]}>🏋️</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: colors.text,
  },
  textLg: {
    fontSize: 32,
  },
  icon: {
    fontSize: 20,
  },
  iconLg: {
    fontSize: 32,
  },
});
