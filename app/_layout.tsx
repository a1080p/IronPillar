import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

function RootNavigation() {
  const { user, hasOnboarded, initializing } = useAuth();
  const segments = useSegments() as unknown as string[];
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = inAuthGroup && segments[1] === 'onboarding';

    if (!user && !inAuthGroup) {
      router.replace('/welcome');
    } else if (user && !hasOnboarded && !inOnboarding) {
      router.replace('/onboarding/name-birthday');
    } else if (user && hasOnboarded && inAuthGroup) {
      router.replace('/');
    }
  }, [user, hasOnboarded, initializing, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigation />
        <StatusBar style="dark" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
