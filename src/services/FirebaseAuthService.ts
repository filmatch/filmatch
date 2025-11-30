// src/services/FirebaseAuthService.ts
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
  reload 
} from 'firebase/auth';

// 👇 FIXED: Changed 'config/firebase' to the correct relative path
import { auth, firebaseConfig } from '../../config/firebase';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const db = getFirestore();

const actionCodeSettings = {
  url: 'https://www.google.com',
  handleCodeInApp: false,
};

const Service = {
  // --- CORE AUTH METHODS ---
  getAuth(): Auth {
    return auth;
  },

  getCurrentUser(): User | null {
    return auth.currentUser;
  },

  onAuthStateChanged(listener: (user: User | null) => void): Unsubscribe {
    return auth.onAuthStateChanged(listener);
  },

  onIdTokenChanged(listener: (user: User | null) => void): Unsubscribe {
    const a = auth as Auth & { onIdTokenChanged?: (l: (u: User | null) => void) => Unsubscribe };
    if (typeof a.onIdTokenChanged === 'function') return a.onIdTokenChanged(listener);
    return onIdTokenChangedWeb(auth, listener);
  },

  // --- ACTIONS ---

  async signIn(email: string, password: string): Promise<User> {
    const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
    return user;
  },

  async signUp(email: string, password: string, displayName?: string): Promise<void> {
    // 1. Create the user in Authentication
    const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
    
    // 2. Update the Display Name immediately
    if (displayName) {
      try { 
        await updateProfile(user, { displayName }); 
      } catch (e) {
        console.warn('Failed to update display name', e);
      }
    }

    // 3. Create the minimal Profile in Firestore
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

    // 4. Send Verification Email
    try { 
      await sendEmailVerification(user, actionCodeSettings); 
    } catch (e) {
      console.error('Error sending verification email:', e);
    }

    // 5. Sign Out immediately so they cannot enter the app without verifying
    await fbSignOut(auth);
  },

  async resendVerification(user: User): Promise<void> {
    await reload(user);
    if (!user.emailVerified) {
      await sendEmailVerification(user, actionCodeSettings);
    }
  },

  async reloadCurrentUser(): Promise<void> {
    const u = auth.currentUser;
    if (u) await reload(u);
  },

  async signOut(): Promise<void> {
    await fbSignOut(auth);
  },

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
  },
};

export const FirebaseAuthService = Service;
export default Service;