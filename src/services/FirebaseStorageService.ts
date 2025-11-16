// src/services/FirebaseStorageService.ts
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../config/firebase';

export class FirebaseStorageService {
  private static storage = storage;

  /**
   * Upload a profile photo to Firebase Storage
   * @param uri - Local file URI from the image picker
   * @param userId - User ID for organizing photos
   * @param photoIndex - Index of the photo in the user's photo array
   * @returns Download URL of the uploaded photo
   */
  static async uploadProfilePhoto(uri: string, userId: string, photoIndex: number): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const timestamp = Date.now();
      const filename = `profile_photos/${userId}/photo_${photoIndex}_${timestamp}.jpg`;
      const storageRef = ref(this.storage, filename);
      await uploadBytes(storageRef, blob);
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
      const photoRef = ref(this.storage, photoUrl);
      await deleteObject(photoRef);
      console.log('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting photo:', error);
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