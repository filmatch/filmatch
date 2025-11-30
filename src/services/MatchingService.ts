// src/services/MatchingService.ts
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { UserProfile } from '../types';
import TMDbService from './TMDbService';

export class MatchingService {
  private static db = getFirestore();

  static async getPotentialMatches(
    currentUserId: string,
    currentUserGender: string,
    genderPreferences: string[],
    currentUserIntent: string[], 
    userCity?: string,
    maxResults: number = 20
  ): Promise<UserProfile[]> {
    try {
      // --- 1. ARGUMENT SAFETY CHECK (Fixes the crash) ---
      // If the caller hasn't been updated, 'currentUserIntent' might be the city string.
      let safeIntent: string[] = [];
      let safeCity = userCity;

      if (Array.isArray(currentUserIntent)) {
        safeIntent = currentUserIntent;
      } else if (typeof currentUserIntent === 'string') {
        // Argument mismatch detected: intent slot received a string (likely the city)
        console.warn("MatchingService: Arguments mismatched. Fixing automatically.");
        safeCity = currentUserIntent; // Move the string to city
        safeIntent = []; // Reset intent
      }

      // Default fallback if empty
      if (!safeIntent || safeIntent.length === 0) {
        // If no intent is found, default to both so we show SOMETHING
        safeIntent = ['friends', 'romance'];
      }

      // Safety fallback for gender prefs
      let safePrefs = genderPreferences;
      if (!safePrefs || safePrefs.length === 0) {
        safePrefs = currentUserGender === 'male' ? ['female'] : ['male'];
      }

      console.log(`Finding matches for ${currentUserId}. Intent: ${safeIntent}, City: ${safeCity}`);
      // ---------------------------------------------------

      const usersRef = collection(this.db, 'users');
      let snapshot;
      
      const constraints = [
        where('hasProfile', '==', true),
        where('gender', 'in', safePrefs),
        where('relationshipIntent', 'array-contains-any', safeIntent) 
      ];

      // Try to find people in the same city first
      if (safeCity) {
        try {
          const qCity = query(
            usersRef,
            ...constraints,
            where('city', '==', safeCity),
            limit(50)
          );
          snapshot = await getDocs(qCity);
        } catch (e) {
          console.warn('City query failed or returned empty, falling back to global.');
        }
      }

      // Global fallback if city found no one
      if (!snapshot || snapshot.empty || snapshot.size < 2) {
        const qGlobal = query(usersRef, ...constraints, limit(50));
        snapshot = await getDocs(qGlobal);
      }

      const alreadySwipedIds = await this.getSwipedUserIds(currentUserId);
      
      const matches = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(user => {
          if (user.uid === currentUserId) return false;
          if (alreadySwipedIds.includes(user.uid)) return false;
          return true;
        })
        .slice(0, maxResults);

      return matches;

    } catch (error) {
      console.error('Matching error:', error);
      return [];
    }
  }

  private static async getSwipedUserIds(currentUserId: string): Promise<string[]> {
    try {
      const swipesRef = collection(this.db, 'swipes');
      const q = query(swipesRef, where('fromUserId', '==', currentUserId)); 
      
      const snapshot = await getDocs(q);
      const swipedIds: string[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.toUserId) {
          swipedIds.push(data.toUserId);
        }
      });
      
      return swipedIds;
    } catch (error) { 
      console.error("Error fetching swipe history:", error);
      return []; 
    }
  }

  static calculateCompatibility(user1: UserProfile, user2: UserProfile): number {
    let score = 0;
    let totalWeight = 0;

    if (user1.genreRatings?.length && user2.genreRatings?.length) {
      const u1High = user1.genreRatings.filter(g => g.rating >= 4).map(g => g.genre);
      const u2High = user2.genreRatings.filter(g => g.rating >= 4).map(g => g.genre);
      
      const intersection = u1High.filter(g => u2High.includes(g)).length;
      const union = new Set([...u1High, ...u2High]).size;
      
      const genreScore = union === 0 ? 0 : (intersection / union);
      score += genreScore * 50;
      totalWeight += 50;
    }

    if (user1.favorites?.length && user2.favorites?.length) {
      const u1Ids = user1.favorites.map(f => String(f.id).replace('fav_', '').split('_')[0]);
      const u2Ids = user2.favorites.map(f => String(f.id).replace('fav_', '').split('_')[0]);
      
      const favMatch = u1Ids.filter(id => u2Ids.includes(id)).length;
      const favScore = Math.min(favMatch * 0.5, 1); 
      score += favScore * 20;
      totalWeight += 20;
    }

    if (user1.age && user2.age) {
      const diff = Math.abs(user1.age - user2.age);
      let ageScore = 0;
      if (diff <= 2) ageScore = 1;
      else if (diff <= 5) ageScore = 0.8;
      else if (diff <= 10) ageScore = 0.5;
      
      score += ageScore * 30;
      totalWeight += 30;
    }

    if (totalWeight === 0) return 60; 
    return Math.max(10, Math.min(99, Math.round(score)));
  }
}