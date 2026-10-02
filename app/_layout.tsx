// Imported first, for its side effect: registers the gym geofence background
// task at module load so a headless relaunch can deliver arrival events.
import '../lib/gymReminders';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { BugReportButton } from '../components/BugReportButton';
import { ReminderSync } from '../components/ReminderSync';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { PurchasesProvider } from '../contexts/PurchasesContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { endWorkoutActivity } from '../lib/liveActivity';
import { LOCATION_TASK_NAME } from '../lib/outdoorTracking';
import { stopOutdoorWatchdog, stopStrengthWatchdog } from '../lib/workoutWatchdog';

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

  // A fresh launch can't be mid-way through a strength workout (its state
  // lives in memory), so clear any lock-screen activity or "still working
  // out?" reminder a killed session left behind. An outdoor session survives
  // a relaunch, so leave everything alone while one is running.
  useEffect(() => {
    Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
      .catch(() => false)
      .then((trackingOutdoors) => {
        stopStrengthWatchdog();
        if (!trackingOutdoors) {
          endWorkoutActivity();
          stopOutdoorWatchdog();
        }
      });
  }, []);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Slides up as a sheet over whatever screen opened it. */}
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pro-welcome" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
      {/* Only once fully onboarded — a pre-account user has no uid to attach
          a report to, and won't hit real app screens yet anyway. */}
      {user && hasOnboarded ? <BugReportButton uid={user.uid} /> : null}
      {user && hasOnboarded ? <ReminderSync uid={user.uid} /> : null}
      <AnimatedSplash ready={!initializing} />
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
          <PurchasesProvider>
            <RootNavigation />
            <RootStatusBar />
          </PurchasesProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
