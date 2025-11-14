// src/services/FirestoreService.ts
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '../types';

export class FirestoreService {
  static db = getFirestore();

  static userRef(uid: string) {
    return doc(this.db, 'users', uid);
  }

  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const ref = this.userRef(uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  }

  static async saveUserProfile(uid: string, profile: Partial<UserProfile>) {
    const ref = this.userRef(uid);
    await setDoc(
      ref,
      {
        uid,
        ...profile,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }

  static async updateUserProfile(uid: string, patch: Partial<UserProfile>) {
    const ref = this.userRef(uid);
    await setDoc(
      ref,
      {
        ...patch,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }
static async createUserProfileIfMissing(uid: string) {
  try {
    const ref = this.userRef(uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        hasProfile: false,
        hasPreferences: false,
        favorites: [],
        recentWatches: [],
        genreRatings: [],
        genderPreferences: [], // Add this
      } as UserProfile);
      console.log('Created new user profile for:', uid);
    } else {
      console.log('User profile already exists for:', uid);
    }
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error; // Re-throw so we can handle it in AuthNavigator
  }
}

  static async hasCompletedOnboarding(uid: string): Promise<boolean> {
    const prof = await this.getUserProfile(uid);
    if (!prof) return false;

    const hasProfile =
      prof.hasProfile ||
      typeof prof.age === 'number' ||
      !!prof.city ||
      (Array.isArray(prof.gender) && prof.gender.length > 0);

    const hasPrefs =
      prof.hasPreferences ||
      (Array.isArray(prof.genreRatings) && prof.genreRatings.length > 0) ||
      (Array.isArray(prof.favorites) && prof.favorites.length > 0);

    return !!(hasProfile && hasPrefs);
  }
}
