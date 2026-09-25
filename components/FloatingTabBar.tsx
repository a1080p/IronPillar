// expo-router v57 vendors react-navigation internally rather than shipping
// @react-navigation/bottom-tabs as a separate dependency.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';

const BAR_HEIGHT = 64;
const ICON_SIZE = 24;

// Custom tab bar: a floating pill that lines up with the app's 24pt screen
// gutter (spacing.lg) on the left/right, sits a grid step off the bottom, and
// centers each icon in its cell. React Navigation's own tabBarStyle wouldn't
// respect the position/height overrides cleanly here.
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const bottom = Math.max(spacing.lg, insets.bottom);

  return (
    <View style={[styles.bar, { bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const color = focused ? colors.textOnDark : 'rgba(255,255,255,0.6)';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            style={styles.item}
          >
            {options.tabBarIcon?.({ focused, color, size: ICON_SIZE })}
          </Pressable>
        );
      })}
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
  },
  item: {
    flex: 1,
    height: BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
