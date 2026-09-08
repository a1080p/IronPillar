import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase/config';
import type { UserProfile } from '../types/models';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  hasOnboarded: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createProfile: (
    data: Pick<
      UserProfile,
      | 'name'
      | 'birthday'
      | 'goals'
      | 'experienceLevel'
      | 'sex'
      | 'heightInches'
      | 'startingWeightLb'
    >
  ) => Promise<void>;
  updateProfile: (
    data: Partial<
      Pick<
        UserProfile,
        'name' | 'birthday' | 'goals' | 'experienceLevel' | 'sex' | 'heightInches' | 'startingWeightLb'
      >
    >
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setInitializing(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
        setInitializing(false);
      },
      () => setInitializing(false)
    );
    return unsubscribe;
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      initializing,
      hasOnboarded: !!profile,
      async signUp(email, password) {
        await createUserWithEmailAndPassword(auth, email, password);
      },
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signOut() {
        await firebaseSignOut(auth);
      },
      async createProfile({
        name,
        birthday,
        goals,
        experienceLevel,
        sex,
        heightInches,
        startingWeightLb,
      }) {
        if (!user) throw new Error('Must be signed in to create a profile');
        const ref = doc(db, 'users', user.uid);
        const existing = await getDoc(ref);
        if (existing.exists()) return;

        const base =
          user.email
            ?.split('@')[0]
            .toLowerCase()
            .replace(/[^a-z0-9_.]/g, '') || `user${user.uid.slice(0, 6)}`;

        await runTransaction(db, async (tx) => {
          let username = base;
          for (let attempt = 0; attempt < 5; attempt++) {
            const candidateRef = doc(db, 'usernames', username);
            const candidateSnap = await tx.get(candidateRef);
            if (!candidateSnap.exists()) break;
            username = `${base}${Math.floor(100 + Math.random() * 900)}`;
          }

          const newProfile: UserProfile = {
            uid: user.uid,
            username,
            name,
            birthday,
            goals,
            experienceLevel,
            sex,
            heightInches,
            startingWeightLb,
            level: 1,
            xp: 0,
            streakCount: 0,
            lastWorkoutDate: null,
            friendCount: 0,
            createdAt: new Date().toISOString(),
          };
          tx.set(ref, newProfile);
          tx.set(doc(db, 'usernames', username), { uid: user.uid });
        });
      },
      async updateProfile(data) {
        if (!user) throw new Error('Must be signed in to update a profile');
        await updateDoc(doc(db, 'users', user.uid), data);
      },
    }),
    [user, profile, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
