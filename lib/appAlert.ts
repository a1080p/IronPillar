// In-app replacement for React Native's Alert.alert, with the same arguments,
// so screens show Iron Pillar-styled pop-ups instead of the system box.
// Rendered by components/AppAlertHost (mounted once in app/_layout).
//
// - With buttons: a dialog. Cancel-style buttons are outlined, destructive
//   ones red; tapping outside counts as Cancel when there is one.
// - Without buttons (a plain message): a toast that clears itself.

export interface AppAlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface QueuedAlert {
  id: number;
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
}

type Listener = (alert: QueuedAlert) => void;

let nextId = 1;
const listeners = new Set<Listener>();

export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]) {
  const alert: QueuedAlert = { id: nextId++, title, message, buttons };
  listeners.forEach((listener) => listener(alert));
}

export function subscribeAppAlerts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
