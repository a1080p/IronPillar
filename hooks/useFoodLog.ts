import { useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import type { FoodEntry, Meal } from '../types/models';

// One day's food log (Pro calorie tracking), live.
export function useFoodLog(uid: string | undefined, date: string) {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    // Equality only, sorted here, so no composite index is needed.
    const q = query(collection(db, 'users', uid, 'foodEntries'), where('date', '==', date));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as FoodEntry)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsubscribe;
  }, [uid, date]);

  async function addEntry(entry: { meal: Meal; name: string; calories: number; proteinG?: number }) {
    if (!uid) return;
    await addDoc(collection(db, 'users', uid, 'foodEntries'), {
      date,
      meal: entry.meal,
      name: entry.name,
      calories: entry.calories,
      ...(entry.proteinG != null ? { proteinG: entry.proteinG } : {}),
      createdAt: new Date().toISOString(),
    });
  }

  async function deleteEntry(id: string) {
    if (!uid) return;
    await deleteDoc(doc(db, 'users', uid, 'foodEntries', id));
  }

  return { entries, loading, addEntry, deleteEntry };
}
