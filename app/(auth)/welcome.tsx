import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { TextField } from '../../components/TextField';
import { colors, spacing, typography } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

export default function WelcomeScreen() {
  const { signUp, signIn, sendPasswordReset, isAppleSignInAvailable, signInWithApple } =
    useAuth();
  const [mode, setMode] = useState<'sign_up' | 'log_in'>('sign_up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, [isAppleSignInAvailable]);

  const socialComingSoon = (provider: string) =>
    Alert.alert(
      `${provider} sign-in coming soon`,
      'Email sign-up works now — social login needs OAuth set up in the Firebase console first.'
    );

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Enter an email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'sign_up') {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithApple();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      setError('Enter your email above first, then tap "Forgot password?".');
      return;
    }
    Alert.alert('Reset password', `Send a password reset link to ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          try {
            await sendPasswordReset(email);
            Alert.alert('Check your email', `A password reset link was sent to ${email}.`);
          } catch (e) {
            Alert.alert('Could not send reset email', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.tagline}>Are you ready to forge your</Text>
          <Logo size="lg" />
          <Text style={styles.subtitle}>
            Your fitness journey begins with a single step. Take it with confidence, knowing you
            have the tools and support to reach any goal.
          </Text>

          <Text style={styles.sectionLabel}>{mode === 'sign_up' ? 'Sign-up' : 'Log in'}</Text>

          <View style={styles.socialGroup}>
            <Button label="Continue with Facebook" onPress={() => socialComingSoon('Facebook')} />
            <Button
              label="Continue with Google"
              variant="outline"
              onPress={() => socialComingSoon('Google')}
            />
            {appleAvailable ? (
              <Button label="Continue with Apple" variant="outline" onPress={handleApple} />
            ) : (
              <Button
                label="Continue with Apple"
                variant="outline"
                onPress={() => socialComingSoon('Apple')}
              />
            )}
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.fieldGroup}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="At least 6 characters"
            />
          </View>

          {mode === 'log_in' && (
            <Text style={styles.forgotPasswordLink} onPress={handleForgotPassword}>
              Forgot password?
            </Text>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.submitGroup}>
            <Button
              label={mode === 'sign_up' ? 'Sign up' : 'Log in'}
              onPress={handleSubmit}
              loading={loading}
            />

            <Text
              style={styles.switchModeLink}
              onPress={() => setMode(mode === 'sign_up' ? 'log_in' : 'sign_up')}
            >
              {mode === 'sign_up' ? 'Already have an account? Log in' : "Don't have an account? Sign up"}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  tagline: {
    textAlign: 'center',
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.primary,
  },
  sectionLabel: {
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '700',
  },
  socialGroup: {
    gap: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.surfaceMuted,
  },
  dividerText: {
    marginHorizontal: spacing.sm,
    color: colors.textMuted,
  },
  fieldGroup: {
    gap: spacing.md,
  },
  forgotPasswordLink: {
    textAlign: 'right',
    color: colors.primary,
    fontSize: typography.sizes.small,
    marginTop: -spacing.sm,
  },
  error: {
    color: '#D33',
    textAlign: 'center',
  },
  submitGroup: {
    gap: spacing.lg,
  },
  switchModeLink: {
    textAlign: 'center',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
