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

// Ensure Firebase is initialized
function ensureFirebaseApp() {
  if (!getApps().length) initializeApp(firebaseConfig);
}

// Singleton Auth Instance
let authInstance: Auth | undefined;
function auth(): Auth {
  ensureFirebaseApp();
  if (!authInstance) authInstance = getAuth(getApp());
  return authInstance!;
}

// Singleton Firestore Instance
const db = getFirestore(getApp());

const actionCodeSettings = {
url: 'https://www.google.com',
  handleCodeInApp: false, // Set to true only if you have configured Deep Linking
};

const Service = {
  // --- CORE AUTH METHODS ---
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
    // Robust check for React Native vs Web environment
    const a = auth() as Auth & { onIdTokenChanged?: (l: (u: User | null) => void) => Unsubscribe };
    if (typeof a.onIdTokenChanged === 'function') return a.onIdTokenChanged(listener);
    return onIdTokenChangedWeb(auth(), listener);
  },

  // --- ACTIONS ---

  async signIn(email: string, password: string): Promise<User> {
    const { user } = await signInWithEmailAndPassword(auth(), email.trim(), password);
    return user;
  },

  async signUp(email: string, password: string, displayName?: string): Promise<void> {
    // 1. Create the user in Authentication
    const { user } = await createUserWithEmailAndPassword(auth(), email.trim(), password);
    
    // 2. Update the Display Name immediately
    if (displayName) {
      try { 
        await updateProfile(user, { displayName }); 
      } catch (e) {
        console.warn('Failed to update display name', e);
      }
    }

    // 3. Create the minimal Profile in Firestore
    // This ensures ProfileScreen doesn't crash on first load
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName ?? displayName ?? '',
          hasCompletedOnboarding: false,
          favorites: [],
          recentWatches: [],
          watchedMovies: 0,
          watchlistMovies: 0,
          lastUpdated: serverTimestamp(),
          // Add default fields to prevent "undefined" checks later
          hasProfile: false,
          hasPreferences: false,
          genreRatings: [],
          photos: [],
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Error creating user profile doc:', e);
    }

    // 4. Send Verification Email with the FIXED settings
    try { 
      await sendEmailVerification(user, actionCodeSettings); 
    } catch (e) {
      console.error('Error sending verification email:', e);
    }

    // 5. Sign Out immediately so they cannot enter the app without verifying
    await fbSignOut(auth());
  },

  async resendVerification(user: User): Promise<void> {
    await reload(user);
    if (!user.emailVerified) {
      await sendEmailVerification(user, actionCodeSettings);
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
    // We trim the email to avoid errors with trailing spaces
    await sendPasswordResetEmail(auth(), email.trim());
  },
};

export const FirebaseAuthService = Service;
export default Service;