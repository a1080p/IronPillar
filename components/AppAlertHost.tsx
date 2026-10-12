// Draws the app's own pop-ups for lib/appAlert: dialogs (with buttons) one at
// a time, and toasts (plain messages) that clear themselves. Mounted once at
// the root so any screen can call appAlert().
import { Ionicons } from '@expo/vector-icons';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing, typography } from '../constants/theme';
import { useTheme, type ThemeColors } from '../contexts/ThemeContext';
import { subscribeAppAlerts, type AppAlertButton, type QueuedAlert } from '../lib/appAlert';

const TOAST_MS = 3200;
// Longer messages (usually errors) stay up a little longer to be read.
const TOAST_LONG_MS = 5000;

// iOS draws native modal screens (the paywall) and Modal sheets above the
// root view; a full-window overlay keeps pop-ups on top of all of them, and
// only blocks taps where it draws something.
function Overlay({ children }: { children: ReactNode }) {
  return Platform.OS === 'ios' ? <FullWindowOverlay>{children}</FullWindowOverlay> : <>{children}</>;
}

export function AppAlertHost() {
  const [dialogs, setDialogs] = useState<QueuedAlert[]>([]);
  const [toast, setToast] = useState<QueuedAlert | null>(null);

  useEffect(
    () =>
      subscribeAppAlerts((alert) => {
        if (alert.buttons && alert.buttons.length > 0) setDialogs((q) => [...q, alert]);
        else setToast(alert);
      }),
    []
  );

  const current = dialogs[0] ?? null;
  const close = (button?: AppAlertButton) => {
    setDialogs((q) => q.slice(1));
    // After this dialog is gone, so a follow-up appAlert queues cleanly.
    if (button?.onPress) setTimeout(button.onPress, 0);
  };

  // Both live in the full-window overlay rather than a Modal: iOS won't
  // present a Modal over another one (the check-in or report sheets), and
  // these must show from anywhere, as the system alert did.
  if (!current && !toast) return null;
  return (
    <Overlay>
      <Toast alert={toast} onDone={() => setToast(null)} />
      <Dialog alert={current} onClose={close} />
    </Overlay>
  );
}

function Dialog({
  alert,
  onClose,
}: {
  alert: QueuedAlert | null;
  onClose: (button?: AppAlertButton) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const buttons = alert?.buttons ?? [];
  const cancel = buttons.find((b) => b.style === 'cancel');
  // Cancel first, like iOS, then the rest in the order given.
  const ordered = cancel ? [cancel, ...buttons.filter((b) => b !== cancel)] : buttons;
  const stacked = ordered.length > 2 || ordered.some((b) => (b.text ?? '').length > 14);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!alert) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [alert?.id]);

  if (!alert) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]} accessibilityViewIsModal>
      <Pressable style={styles.backdrop} onPress={() => cancel && onClose(cancel)}>
        {alert && (
          <Pressable style={styles.card} onPress={() => {}} accessibilityRole="alert">
            <Text style={styles.title}>{alert.title}</Text>
            {alert.message ? <Text style={styles.message}>{alert.message}</Text> : null}
            <View style={stacked ? styles.buttonsStacked : styles.buttonsRow}>
              {ordered.map((button, i) => {
                const isCancel = button.style === 'cancel';
                const isDestructive = button.style === 'destructive';
                const isPrimary = !isCancel && !isDestructive && i === ordered.length - 1;
                return (
                  <Fragment key={`${button.text}-${i}`}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.button,
                        !stacked && { flex: 1 },
                        isPrimary && styles.buttonPrimary,
                        isDestructive && styles.buttonDestructive,
                        isCancel && styles.buttonCancel,
                        !isPrimary && !isDestructive && !isCancel && styles.buttonOutline,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={() => onClose(button)}
                      accessibilityRole="button"
                      accessibilityLabel={button.text ?? 'OK'}
                    >
                      <Text
                        style={[
                          styles.buttonText,
                          (isPrimary || isDestructive) && styles.buttonTextOnFill,
                          isCancel && styles.buttonTextCancel,
                        ]}
                      >
                        {button.text ?? 'OK'}
                      </Text>
                    </Pressable>
                  </Fragment>
                );
              })}
            </View>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

function Toast({ alert, onDone }: { alert: QueuedAlert | null; onDone: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(120)).current;

  const hide = () =>
    Animated.timing(translateY, { toValue: 160, duration: 180, useNativeDriver: true }).start(onDone);

  useEffect(() => {
    if (!alert) return;
    translateY.setValue(120);
    Animated.spring(translateY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
    const long = (alert.message?.length ?? 0) > 60;
    const timer = setTimeout(hide, long ? TOAST_LONG_MS : TOAST_MS);
    return () => clearTimeout(timer);
  }, [alert?.id]);

  if (!alert) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.toastLayer]} pointerEvents="box-none">
      <Animated.View
        style={[styles.toastWrap, { bottom: insets.bottom + 96, transform: [{ translateY }] }]}
      >
        <Pressable
          style={styles.toast}
          onPress={hide}
          accessibilityRole="alert"
          accessibilityLabel={`${alert.title}${alert.message ? `. ${alert.message}` : ''}`}
        >
          <Ionicons name="information-circle" size={22} color={colors.textOnDark} />
          <View style={{ flex: 1 }}>
            <Text style={styles.toastTitle}>{alert.title}</Text>
            {alert.message ? <Text style={styles.toastMessage}>{alert.message}</Text> : null}
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
  },
  message: { color: colors.text, textAlign: 'center', fontSize: typography.sizes.body },
  buttonsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  buttonsStacked: { gap: spacing.sm, marginTop: spacing.md },
  button: {
    borderRadius: radii.pill,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonDestructive: { backgroundColor: colors.danger },
  buttonOutline: { borderWidth: 1.5, borderColor: colors.primary },
  buttonCancel: { backgroundColor: colors.surfaceMuted },
  buttonText: { fontWeight: '700', color: colors.primary, fontSize: typography.sizes.body },
  buttonTextOnFill: { color: colors.textOnDark },
  buttonTextCancel: { color: colors.text },
  toastLayer: { alignItems: 'center' },
  toastWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: 420,
    width: '100%',
  },
  toastTitle: { color: colors.textOnDark, fontWeight: '800' },
  toastMessage: { color: colors.textOnDark, fontSize: typography.sizes.small, marginTop: 2 },
});
