import { useEffect, useState } from 'react';
import type { CompletionResult } from './workoutCompletion';

// Lets the workout summary open the moment Finish is tapped. The logging
// screen starts saving, hands the promise here, and navigates straight away;
// the summary shows what it already knows (time, volume, sets) and fills in
// the XP once the server answers.
type State =
  | { status: 'saving' }
  | { status: 'saved'; result: CompletionResult }
  | { status: 'failed'; message: string };

let current: { id: number; state: State; retry: () => void } | null = null;
let nextId = 1;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

// Starts saving and returns an id the summary screen uses to follow it.
export function startPendingCompletion(save: () => Promise<CompletionResult>): number {
  const id = nextId++;
  const run = () => {
    current = { id, state: { status: 'saving' }, retry: run };
    notify();
    save().then(
      (result) => {
        if (current?.id !== id) return;
        current = { id, state: { status: 'saved', result }, retry: run };
        notify();
      },
      (e) => {
        if (current?.id !== id) return;
        current = {
          id,
          state: { status: 'failed', message: e instanceof Error ? e.message : 'Could not save your workout.' },
          retry: run,
        };
        notify();
      }
    );
  };
  run();
  return id;
}

export function usePendingCompletion(id: number | undefined) {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  if (!id || current?.id !== id) return null;
  return { state: current.state, retry: current.retry };
}
