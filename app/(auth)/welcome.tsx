import { useEffect, useMemo, useState } from 'react';
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
import { spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

export default function WelcomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const {
    signUp,
    signIn,
    sendPasswordReset,
    isAppleSignInAvailable,
    signInWithApple,
    isGoogleSignInAvailable,
    signInWithGoogle,
  } = useAuth();
  const [mode, setMode] = useState<'sign_up' | 'log_in'>('sign_up');
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
    isGoogleSignInAvailable().then(setGoogleAvailable);
  }, [isAppleSignInAvailable, isGoogleSignInAvailable]);

  const socialComingSoon = (provider: string) =>
    Alert.alert(
      `${provider} sign-in coming soon`,
      'Email sign-up works now — social login needs OAuth set up in the Firebase console first.'
    );

  const openForm = (targetMode: 'sign_up' | 'log_in') => {
    setError(null);
    setMode(targetMode);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email || !password) {
      setError('Enter an email and password.');
      return;
    }
    if (mode === 'sign_up' && password !== confirmPassword) {
      setError('Passwords do not match.');
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

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
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
          <Logo size="lg" />
          <Text style={styles.sectionLabel}>{mode === 'sign_up' ? 'Sign up' : 'Log in'}</Text>

          <View style={styles.socialGroup}>
            {googleAvailable ? (
              <Button label="Continue with Google" variant="outline" onPress={handleGoogle} />
            ) : (
              <Button
                label="Continue with Google"
                variant="outline"
                onPress={() => socialComingSoon('Google')}
              />
            )}
            {appleAvailable ? (
              <Button label="Continue with Apple" variant="outline" onPress={handleApple} />
            ) : (
              <Button
                label="Continue with Apple"
                variant="outline"
                onPress={() => socialComingSoon('Apple')}
              />
            )}
            <Button
              label="Continue with Email"
              variant="primary"
              onPress={() => openForm('sign_up')}
            />
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Already have an account?</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button label="Log in" variant="primary" onPress={() => openForm('log_in')} />

          {showForm && (
            <>
              <Text style={styles.backLink} onPress={() => setShowForm(false)}>
                ‹ Back
              </Text>

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
                {mode === 'sign_up' && (
                  <TextField
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    placeholder="Re-enter your password"
                  />
                )}
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
                  onPress={() => {
                    setMode(mode === 'sign_up' ? 'log_in' : 'sign_up');
                    setError(null);
                    setConfirmPassword('');
                  }}
                >
                  {mode === 'sign_up'
                    ? 'Already have an account? Log in'
                    : "Don't have an account? Sign up"}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
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
  backLink: {
    color: colors.primary,
    fontWeight: '600',
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
