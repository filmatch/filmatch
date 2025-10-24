// src/services/FirebaseAuthService.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  type User,
  type Unsubscribe,
  onIdTokenChanged as onIdTokenChangedWeb,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification,
  reload,
} from 'firebase/auth';
import { firebaseConfig } from '../../config/firebase';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

function ensureFirebaseApp() {
  if (!getApps().length) initializeApp(firebaseConfig);
}

// Singleton Auth
let authInstance: Auth | undefined;
function auth(): Auth {
  ensureFirebaseApp();
  if (!authInstance) authInstance = getAuth(getApp());
  return authInstance!;
}

const db = getFirestore(getApp());

// Build a safe verification URL from .env (no deep linking in-app)
const AUTH_DOMAIN =
  (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
const actionCodeSettings = {
  url: `https://${AUTH_DOMAIN}/verify-complete`,
  handleCodeInApp: false,
};

const Service = {
  // Core
  getAuth(): Auth {
    return auth();
  },
  getCurrentUser(): User | null {
    return auth().currentUser;
  },
  onAuthStateChanged(listener: (user: User | null) => void): Unsubscribe {
    return auth().onAuthStateChanged(listener);
  },
  onIdTokenChanged(listener: (user: User | null) => void): Unsubscribe {
    // Works in both web & RN bundles
    const a = auth() as Auth & { onIdTokenChanged?: (l: (u: User | null) => void) => Unsubscribe };
    if (typeof a.onIdTokenChanged === 'function') return a.onIdTokenChanged(listener);
    return onIdTokenChangedWeb(auth(), listener);
  },

  // Email/password helpers
  async signIn(email: string, password: string): Promise<User> {
    const { user } = await signInWithEmailAndPassword(auth(), email.trim(), password);
    return user;
  },

  async signUp(email: string, password: string, displayName?: string): Promise<void> {
    const { user } = await createUserWithEmailAndPassword(auth(), email.trim(), password);
    if (displayName) try { await updateProfile(user, { displayName }); } catch {}

    // create minimal profile so ProfileScreen can read later
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName ?? '',
          hasCompletedOnboarding: false,
          favorites: [],
          recentWatches: [],
          watchedMovies: 0,
          watchlistMovies: 0,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {}

    // send the verification email using explicit actionCodeSettings
    try { await sendEmailVerification(user, actionCodeSettings as any); } catch {}

    // IMPORTANT: sign out so they cannot enter the app before verifying
    await fbSignOut(auth());
  },

  async resendVerification(user: User): Promise<void> {
    await reload(user);
    if (!user.emailVerified) {
      await sendEmailVerification(user, actionCodeSettings as any);
    }
  },

  async reloadCurrentUser(): Promise<void> {
    const u = auth().currentUser;
    if (u) await reload(u);
  },

  async signOut(): Promise<void> {
    await fbSignOut(auth());
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth(), email.trim());
  },
};

export const FirebaseAuthService = Service;
export default Service;
