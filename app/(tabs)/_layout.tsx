import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ColorValue, Image } from 'react-native';
import { FloatingTabBar } from '../../components/FloatingTabBar';
import { colors } from '../../constants/theme';

// Branded tab icons (Home/Analytics/Social/Profile) come from Figma exports.
// Browse still uses an Ionicon pending a matching brand icon for it.
function TabIcon({ source, color, size }: { source: number; color: ColorValue; size: number }) {
  return (
    <Image source={source} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.textOnDark,
        tabBarInactiveTintColor: 'rgba(255,255,255,0.6)',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon source={require('../../assets/tab-icons/home.png')} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => (
            <TabIcon source={require('../../assets/tab-icons/analytics.png')} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color, size }) => (
            <TabIcon source={require('../../assets/tab-icons/social.png')} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon source={require('../../assets/tab-icons/profile.png')} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
