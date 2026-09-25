import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { TextField } from '../../components/TextField';
import { spacing, typography } from '../../constants/theme';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { user, sendVerificationCode, verifyEmailCode, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const sentOnMount = useRef(false);

  useEffect(() => {
    if (sentOnMount.current) return;
    sentOnMount.current = true;
    sendVerificationCode()
      .then(() => setCooldown(RESEND_COOLDOWN_SECONDS))
      .catch(() => {});
  }, [sendVerificationCode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleVerify = async () => {
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setVerifying(true);
    try {
      await verifyEmailCode(code);
      // Root layout's auth guard moves on to onboarding once
      // user.emailVerified is true.
    } catch (e) {
      setError(e instanceof Error ? e.message : "That code doesn't match.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      await sendVerificationCode();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend the code.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Logo size="lg" />
          <Text style={styles.heading}>Verify Your Email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{user?.email ? ` ${user.email}` : ' your email'}. Enter it
            below to continue.
          </Text>

          <TextField
            label="Verification Code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button label="Verify" onPress={handleVerify} loading={verifying} />

          <Text
            style={[styles.resendLink, cooldown > 0 && styles.resendLinkDisabled]}
            onPress={cooldown > 0 ? undefined : handleResend}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Text>

          <Text style={styles.signOutLink} onPress={() => signOut()}>
            Sign out
          </Text>
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
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.lg,
  },
  heading: {
    textAlign: 'center',
    fontSize: typography.sizes.lg,
    fontWeight: '700',
    color: colors.primary,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.primary,
  },
  error: {
    color: '#D33',
    textAlign: 'center',
  },
  resendLink: {
    textAlign: 'center',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  resendLinkDisabled: {
    color: colors.textMuted,
    textDecorationLine: 'none',
  },
  signOutLink: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});
