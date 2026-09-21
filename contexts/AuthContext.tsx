import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import {
  AuthErrorCodes,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase/config';
import type { UserProfile } from '../types/models';

// Google Sign-In needs a native module Expo Go doesn't have. Its package
// calls TurboModuleRegistry.getEnforcing() at the package's own top level,
// so even importing it (not just calling it) crashes Expo Go instantly --
// which would break the shared Expo Go preview for every tester the moment
// this file loads. We check availability with plain JS/env values only, and
// dynamically `import()` the package itself, deferred until a real sign-in
// attempt on a build that actually has the native module.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleSignInReady = !isExpoGo && !!googleWebClientId;
let googleSignInConfigured = false;

async function ensureGoogleSignInConfigured() {
  if (!googleSignInReady) return false;
  if (!googleSignInConfigured) {
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: googleWebClientId });
    googleSignInConfigured = true;
  }
  return true;
}

// Maps common Firebase Auth error codes to copy a user can actually act on,
// instead of surfacing "Firebase: Error (auth/email-already-in-use)." raw.
function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string } | undefined)?.code;
  switch (code) {
    case AuthErrorCodes.EMAIL_EXISTS:
      return 'An account already exists with that email. Try logging in instead.';
    case AuthErrorCodes.INVALID_EMAIL:
      return "That email address doesn't look right.";
    case AuthErrorCodes.WEAK_PASSWORD:
      return 'Password must be at least 6 characters.';
    case AuthErrorCodes.INVALID_PASSWORD:
    case AuthErrorCodes.USER_DELETED:
    case 'auth/invalid-credential':
      return 'Incorrect email or password.';
    case AuthErrorCodes.NETWORK_REQUEST_FAILED:
      return 'Network error — check your connection and try again.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong.';
  }
}

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initializing: boolean;
  hasOnboarded: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  isAppleSignInAvailable: () => Promise<boolean>;
  signInWithApple: () => Promise<void>;
  isGoogleSignInAvailable: () => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
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
    > &
      Partial<Pick<UserProfile, 'avatarKey' | 'avatarUrl'>>
  ) => Promise<void>;
  updateProfile: (
    data: Partial<
      Pick<
        UserProfile,
        | 'name'
        | 'avatarUrl'
        | 'avatarKey'
        | 'birthday'
        | 'goals'
        | 'experienceLevel'
        | 'sex'
        | 'heightInches'
        | 'startingWeightLb'
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
        try {
          const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
          // Best-effort — a failed verification email shouldn't block signup.
          sendEmailVerification(credential.user).catch(() => {});
        } catch (e) {
          throw new Error(friendlyAuthError(e));
        }
      },
      async signIn(email, password) {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (e) {
          throw new Error(friendlyAuthError(e));
        }
      },
      async signOut() {
        await firebaseSignOut(auth);
      },
      async sendPasswordReset(email) {
        try {
          await sendPasswordResetEmail(auth, email.trim());
        } catch (e) {
          throw new Error(friendlyAuthError(e));
        }
      },
      async isAppleSignInAvailable() {
        if (Platform.OS !== 'ios') return false;
        return AppleAuthentication.isAvailableAsync();
      },
      // Sign in with Apple, Firebase-side: generates a nonce (Apple gets its
      // SHA-256 hash, Firebase gets the raw value back) so the identity token
      // Apple returns can't be replayed against a different sign-in attempt.
      async signInWithApple() {
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce
        );

        let appleCredential: AppleAuthentication.AppleAuthenticationCredential;
        try {
          appleCredential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
          });
        } catch (e) {
          if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
            return; // user dismissed the Apple sheet — not an error to surface
          }
          throw new Error('Apple sign-in failed. Please try again.');
        }

        if (!appleCredential.identityToken) {
          throw new Error('Apple sign-in did not return an identity token.');
        }

        try {
          const provider = new OAuthProvider('apple.com');
          const firebaseCredential = provider.credential({
            idToken: appleCredential.identityToken,
            rawNonce,
          });
          await signInWithCredential(auth, firebaseCredential);
        } catch (e) {
          throw new Error(friendlyAuthError(e));
        }
      },
      async isGoogleSignInAvailable() {
        return googleSignInReady;
      },
      async signInWithGoogle() {
        const ready = await ensureGoogleSignInConfigured();
        if (!ready) {
          throw new Error('Google sign-in is not set up on this build yet.');
        }
        const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = await import(
          '@react-native-google-signin/google-signin'
        );
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();
          if (!isSuccessResponse(response)) {
            return; // user cancelled the Google sheet — not an error to surface
          }
          if (!response.data.idToken) {
            throw new Error('Google sign-in did not return an identity token.');
          }
          const credential = GoogleAuthProvider.credential(response.data.idToken);
          await signInWithCredential(auth, credential);
        } catch (e) {
          if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) {
            return;
          }
          throw new Error(friendlyAuthError(e));
        }
      },
      async createProfile({
        name,
        birthday,
        goals,
        experienceLevel,
        sex,
        heightInches,
        startingWeightLb,
        avatarKey,
        avatarUrl,
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
          if (avatarUrl) newProfile.avatarUrl = avatarUrl;
          else if (avatarKey) newProfile.avatarKey = avatarKey;
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
