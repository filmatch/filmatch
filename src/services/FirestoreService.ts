// src/services/FirestoreService.ts
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { getApp } from 'firebase/app';
import type { UserProfile } from '../types';

export class FirestoreService {
  /**
   * Get the Firestore database instance
   */
  static getDb() {
    try {
      return getFirestore(getApp());
    } catch (error) {
      console.error('Error getting Firestore instance:', error);
      throw new Error('Firebase not initialized properly');
    }
  }

  /**
   * Get a reference to a user document
   */
  static userRef(uid: string) {
    return doc(this.getDb(), 'users', uid);
  }

  /**
   * Get a user's profile from Firestore
   */
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const ref = this.userRef(uid);
      const snap = await getDoc(ref);
      
      if (!snap.exists()) {
        console.log('No profile found for user:', uid);
        return null;
      }
      
      const data = snap.data() as UserProfile;
      console.log('Profile loaded for user:', uid);
      return data;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Save or update a user's profile
   */
  static async saveUserProfile(uid: string, profile: Partial<UserProfile>) {
    try {
      const ref = this.userRef(uid);
      
      // 1. Retrieve existing document
      const snap = await getDoc(ref);
      const exists = snap.exists();
      
      // Get existing data to merge, if available. This ensures we don't lose fields like 'age' or 'photos'
      // when updating preferences (which only passes favorites, recents, genres).
      const existingData: Partial<UserProfile> = exists ? snap.data() as UserProfile : {};
      
      // 2. Prepare data to save by merging existing data with new partial profile data
      const dataToSave: any = {
        uid,
        ...existingData, // Preserve existing fields
        ...profile,      // Overwrite/add new fields
        updatedAt: Date.now(),
      };
      
      // Add createdAt only for new documents
      if (!exists) {
        dataToSave.createdAt = Date.now();
      }
      
      console.log('Saving to Firestore (Merged):', {
        uid,
        exists,
        hasPreferences: dataToSave.hasPreferences,
        favoritesCount: dataToSave.favorites?.length,
        recentWatchesCount: dataToSave.recentWatches?.length,
        genreRatingsCount: dataToSave.genreRatings?.length,
      });
      
      // 3. Perform the save/update
      if (exists) {
        // Use updateDoc for existing documents (now updating with the merged data)
        await updateDoc(ref, dataToSave);
        console.log('✓ Updated existing profile (Merged)');
      } else {
        // Use setDoc for new documents
        await setDoc(ref, dataToSave);
        console.log('✓ Created new profile');
      }
      
      // Verify the save
      const verification = await getDoc(ref);
      if (!verification.exists()) {
        throw new Error('Verification failed: document not found after save');
      }
      
      const savedData = verification.data();
      console.log('✓ Verification passed:', {
        hasPreferences: savedData.hasPreferences,
        favoritesCount: savedData.favorites?.length,
        recentWatchesCount: savedData.recentWatches?.length,
        genreRatingsCount: savedData.genreRatings?.length,
      });
      
      return savedData as UserProfile;
    } catch (error: any) {
      console.error('Error saving user profile:', error);
      
      // Check for permission errors
      if (error.code === 'permission-denied' || 
          error.message?.includes('PERMISSION_DENIED') ||
          error.message?.includes('Missing or insufficient permissions')) {
        throw new Error('PERMISSION_DENIED: Check your Firestore security rules');
      }
      
      throw error;
    }
  }

  /**
   * Create a new user profile if it doesn't exist
   */
  static async createUserProfileIfMissing(uid: string) {
    try {
      const ref = this.userRef(uid);
      const snap = await getDoc(ref);
      
      if (!snap.exists()) {
        const initialProfile: UserProfile = {
          uid,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          hasProfile: false,
          hasPreferences: false,
          favorites: [],
          recentWatches: [],
          genreRatings: [],
          genderPreferences: [],
        };
        
        await setDoc(ref, initialProfile);
        console.log('✓ Created new user profile for:', uid);
        return initialProfile;
      } else {
        console.log('User profile already exists for:', uid);
        return snap.data() as UserProfile;
      }
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  /**
   * Check if a user has completed onboarding
   */
  static async hasCompletedOnboarding(uid: string): Promise<boolean> {
    try {
      const prof = await this.getUserProfile(uid);
      if (!prof) {
        console.log('No profile found, onboarding not complete');
        return false;
      }

      // Check if user has profile information
      const hasProfile =
        prof.hasProfile ||
        typeof prof.age === 'number' ||
        !!prof.city ||
        (Array.isArray(prof.gender) && prof.gender.length > 0);

      // Check if user has preferences
      const hasPrefs =
        prof.hasPreferences ||
        (Array.isArray(prof.genreRatings) && prof.genreRatings.length > 0) ||
        (Array.isArray(prof.favorites) && prof.favorites.length > 0);

      const completed = !!(hasProfile && hasPrefs);
      
      console.log('Onboarding status:', {
        hasProfile,
        hasPrefs,
        completed,
      });

      return completed;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  /**
   * Update only specific fields (partial update)
   */
  static async updateUserFields(uid: string, fields: Partial<UserProfile>) {
    try {
      const ref = this.userRef(uid);
      
      // Ensure document exists
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        throw new Error('Cannot update: user profile does not exist');
      }
      
      const dataToUpdate = {
        ...fields,
        updatedAt: Date.now(),
      };
      
      await updateDoc(ref, dataToUpdate);
      console.log('✓ Updated user fields:', Object.keys(fields));
      
      return await this.getUserProfile(uid);
    } catch (error) {
      console.error('Error updating user fields:', error);
      throw error;
    }
  }

  /**
   * Delete a user's profile (use with caution)
   */
  static async deleteUserProfile(uid: string) {
    try {
      const ref = this.userRef(uid);
      await setDoc(ref, { deleted: true, deletedAt: Date.now() }, { merge: true });
      console.log('✓ Marked user profile as deleted:', uid);
    } catch (error) {
      console.error('Error deleting user profile:', error);
      throw error;
    }
  }
}