import { initializeApp } from 'firebase/app';
// @ts-ignore: known firebase bug, this function exists but types are missing
import { initializeAuth, getReactNativePersistence, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

// Initialize Auth with React Native Persistence (AsyncStorage)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, firebaseConfig };

// --- Restored Storage Service ---

export class FirebaseStorageService {
  /**
   * Upload a profile photo to Firebase Storage
   * @param uri - Local file URI from the image picker
   * @param userId - User ID for organizing photos
   * @param photoIndex - Index of the photo in the user's photo array
   * @returns Download URL of the uploaded photo
   */
  static async uploadProfilePhoto(uri: string, userId: string, photoIndex: number): Promise<string> {
    try {
      console.log('Starting upload for userId:', userId);
      
      const response = await fetch(uri);
      const blob = await response.blob();
      const timestamp = Date.now();
      const filename = `profile_photos/${userId}/photo_${photoIndex}_${timestamp}.jpg`;
      console.log('Uploading to path:', filename);
      
      // Use the 'storage' instance exported above
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      console.log('Upload successful');

      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error('Failed to upload photo. Please try again.');
    }
  }

  /**
   * Delete a profile photo from Firebase Storage
   * @param photoUrl - Full download URL of the photo to delete
   */
  static async deleteProfilePhoto(photoUrl: string): Promise<void> {
    try {
      // Extract the storage path from the URL
      const photoRef = ref(storage, photoUrl);
      await deleteObject(photoRef);
      console.log('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting photo:', error);
      // Don't throw - photo might already be deleted or URL might be invalid
      // This prevents blocking the user if deletion fails
    }
  }

  /**
   * Delete all photos for a user
   * @param userId - User ID
   * @param photoUrls - Array of photo URLs to delete
   */
  static async deleteAllUserPhotos(userId: string, photoUrls: string[]): Promise<void> {
    try {
      const deletePromises = photoUrls.map(url => this.deleteProfilePhoto(url));
      await Promise.all(deletePromises);
      console.log('All user photos deleted successfully');
    } catch (error) {
      console.error('Error deleting user photos:', error);
    }
  }
}