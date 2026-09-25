import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../components/FloatingTabBar';
import { CompassIcon, GroupIcon, HomeIcon, StatsIcon, UserIcon } from '../../components/icons/BrandIcons';
import { useTheme } from '../../contexts/ThemeContext';

// FloatingTabBar always passes plain string colors at runtime; React
// Navigation's tabBarIcon type just declares the wider ColorValue.
const asString = (c: unknown) => c as string;

export default function TabsLayout() {
  const { colors } = useTheme();
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
          tabBarIcon: ({ color, size }) => <HomeIcon color={asString(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="browse"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color, size }) => <CompassIcon color={asString(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color, size }) => <StatsIcon color={asString(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color, size }) => <GroupIcon color={asString(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <UserIcon color={asString(color)} size={size} />,
        }}
      />
    </Tabs>
  );
}
