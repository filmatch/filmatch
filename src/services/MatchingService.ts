// src/services/MatchingService.ts
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { UserProfile } from '../types';
import TMDbService from './TMDbService';

export class MatchingService {
  private static db = getFirestore();

  // 1. FIXED: Gender & City Filter
  static async getPotentialMatches(
    currentUserId: string,
    currentUserGender: string,
    genderPreferences: string[],
    userCity?: string,
    maxResults: number = 20
  ): Promise<UserProfile[]> {
    try {
      // Safety fallback: If no preference, default to opposite
      let safePrefs = genderPreferences;
      if (!safePrefs || safePrefs.length === 0) {
        safePrefs = currentUserGender === 'Male' ? ['Female'] : ['Male'];
      }

      console.log(`Finding matches for ${currentUserId} (${currentUserGender}) looking for:`, safePrefs);

      const usersRef = collection(this.db, 'users');
      let snapshot;
      
      const constraints = [
        where('hasProfile', '==', true),
        where('gender', 'in', safePrefs), // CRITICAL FIX: Actually filters by gender
      ];

      // Try to find people in the same city first
      if (userCity) {
        try {
          const qCity = query(
            usersRef,
            ...constraints,
            where('city', '==', userCity),
            limit(50)
          );
          snapshot = await getDocs(qCity);
        } catch (e) {
          console.warn('City query failed, falling back to global.');
        }
      }

      // Global fallback if city found no one
      if (!snapshot || snapshot.empty || snapshot.size < 2) {
        const qGlobal = query(usersRef, ...constraints, limit(50));
        snapshot = await getDocs(qGlobal);
      }

      // Filter out people you've ALREADY swiped on
      const alreadySwipedIds = await this.getSwipedUserIds(currentUserId);
      
      const matches = snapshot.docs
        .map(doc => doc.data() as UserProfile)
        .filter(user => {
          if (user.uid === currentUserId) return false; // Don't match self
          if (alreadySwipedIds.includes(user.uid)) return false; // Don't show again
          return true;
        })
        .slice(0, maxResults);

      return matches;

    } catch (error) {
      console.error('Matching error:', error);
      return [];
    }
  }

  // 2. FIXED: Swipe History Check
  private static async getSwipedUserIds(currentUserId: string): Promise<string[]> {
    try {
      const swipesRef = collection(this.db, 'swipes');
      // Look for docs where YOU are the "fromUserId"
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

  // 3. RESTORED: Compatibility Calculation (This was missing!)
  static calculateCompatibility(user1: UserProfile, user2: UserProfile): number {
    let score = 0;
    let totalWeight = 0;

    // A. Genre Overlap (Weight: 50)
    if (user1.genreRatings?.length && user2.genreRatings?.length) {
      const u1High = user1.genreRatings.filter(g => g.rating >= 4).map(g => g.genre);
      const u2High = user2.genreRatings.filter(g => g.rating >= 4).map(g => g.genre);
      
      const intersection = u1High.filter(g => u2High.includes(g)).length;
      const union = new Set([...u1High, ...u2High]).size;
      
      const genreScore = union === 0 ? 0 : (intersection / union);
      score += genreScore * 50;
      totalWeight += 50;
    }

    // B. Favorites Overlap (Weight: 20)
    if (user1.favorites?.length && user2.favorites?.length) {
      const u1Ids = user1.favorites.map(f => String(f.id).replace('fav_', '').split('_')[0]);
      const u2Ids = user2.favorites.map(f => String(f.id).replace('fav_', '').split('_')[0]);
      
      const favMatch = u1Ids.filter(id => u2Ids.includes(id)).length;
      const favScore = Math.min(favMatch * 0.5, 1); 
      score += favScore * 20;
      totalWeight += 20;
    }

    // C. Age Proximity (Weight: 30)
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