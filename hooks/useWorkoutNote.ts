import { useCallback, useEffect, useState } from 'react';
import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export const WORKOUT_NOTE_MAX_LENGTH = 2000;

// A user's own free-text note for one workout (e.g. "seat at 4 on the leg
// press"), stored at users/{uid}/workoutNotes/{workoutId}.
export function useWorkoutNote(uid: string | undefined, workoutId: string | undefined) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !workoutId) return;
    const unsubscribe = onSnapshot(
      doc(db, 'users', uid, 'workoutNotes', workoutId),
      (snap) => {
        setNote((snap.data()?.text as string | undefined) ?? '');
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid, workoutId]);

  const saveNote = useCallback(
    async (text: string) => {
      if (!uid || !workoutId) return;
      const ref = doc(db, 'users', uid, 'workoutNotes', workoutId);
      const trimmed = text.trim().slice(0, WORKOUT_NOTE_MAX_LENGTH);
      if (trimmed) {
        await setDoc(ref, { text: trimmed, updatedAt: new Date().toISOString() });
      } else {
        await deleteDoc(ref);
      }
    },
    [uid, workoutId]
  );

  return { note, loading, saveNote };
}
