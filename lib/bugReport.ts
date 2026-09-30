// Lets any header or menu open the bug-report form, which lives once at the
// app root (components/BugReportButton.tsx).
type Listener = () => void;
let listeners: Listener[] = [];

export function openBugReport() {
  listeners.forEach((listener) => listener());
}

export function onOpenBugReport(listener: Listener) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}
