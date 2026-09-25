import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BugReportButton } from '../components/BugReportButton';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

function RootNavigation() {
  const { user, hasOnboarded, initializing } = useAuth();
  const segments = useSegments() as unknown as string[];
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = inAuthGroup && segments[1] === 'onboarding';
    const inVerifyEmail = inAuthGroup && segments[1] === 'verify-email';
    // Only new (not-yet-onboarded) sign-ups are gated on a verified email —
    // this is a one-time step in the sign-up flow, not something retroactively
    // enforced on accounts that already exist and completed onboarding.
    const needsEmailVerification = !!user && !user.emailVerified && !hasOnboarded;

    if (!user && !inAuthGroup) {
      router.replace('/welcome');
    } else if (needsEmailVerification && !inVerifyEmail) {
      router.replace('/verify-email');
    } else if (user && !needsEmailVerification && !hasOnboarded && !inOnboarding) {
      router.replace('/onboarding/name-birthday');
    } else if (user && hasOnboarded && inAuthGroup) {
      router.replace('/');
    }
  }, [user, hasOnboarded, initializing, segments]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Only once fully onboarded — a pre-account user has no uid to attach
          a report to, and won't hit real app screens yet anyway. */}
      {user && hasOnboarded ? <BugReportButton uid={user.uid} /> : null}
    </>
  );
}

function RootStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigation />
          <RootStatusBar />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
