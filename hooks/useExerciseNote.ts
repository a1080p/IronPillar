import { useCallback, useEffect, useState } from 'react';
import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase/config';

export const EXERCISE_NOTE_MAX_LENGTH = 2000;

// Notes follow the exercise, not the workout it appears in: a note on Leg
// Extension shows wherever Leg Extension comes up. The doc id is the exercise
// name reduced to lowercase letters, digits and dashes.
export function exerciseNoteId(exerciseName: string | undefined) {
  return (exerciseName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

// A user's own free-text note for one exercise (e.g. "seat at 4, feet high"),
// stored at users/{uid}/exerciseNotes/{exerciseNoteId}.
export function useExerciseNote(uid: string | undefined, exerciseName: string | undefined) {
  const noteId = exerciseNoteId(exerciseName);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setNote('');
    if (!uid || !noteId) return;
    const unsubscribe = onSnapshot(
      doc(db, 'users', uid, 'exerciseNotes', noteId),
      (snap) => {
        setNote((snap.data()?.text as string | undefined) ?? '');
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid, noteId]);

  const saveNote = useCallback(
    async (text: string) => {
      if (!uid || !noteId) return;
      const ref = doc(db, 'users', uid, 'exerciseNotes', noteId);
      const trimmed = text.trim().slice(0, EXERCISE_NOTE_MAX_LENGTH);
      if (trimmed) {
        await setDoc(ref, {
          text: trimmed,
          exerciseName: (exerciseName ?? '').slice(0, 200),
          updatedAt: new Date().toISOString(),
        });
      } else {
        await deleteDoc(ref);
      }
    },
    [uid, noteId, exerciseName]
  );

  return { note, loading, saveNote };
}
