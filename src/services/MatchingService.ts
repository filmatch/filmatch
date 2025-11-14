// src/services/MatchingService.ts
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { UserProfile } from '../types';
import TMDbService from './TMDbService';
import { SwipeService } from './SwipeService';

export class MatchingService {
  private static db = getFirestore();

  /**
   * Fetch potential matches based on the current user's gender preferences
   * Filters out users that have already been swiped on or matched with
   */
  static async getPotentialMatches(
    currentUserId: string,
    genderPreferences: string[],
    maxResults: number = 20
  ): Promise<UserProfile[]> {
    try {
      if (!genderPreferences || genderPreferences.length === 0) {
        console.log('No gender preferences set');
        return [];
      }

      const usersRef = collection(this.db, 'users');
      
      // Query with source from server to avoid cache
      const q = query(
        usersRef,
        where('hasProfile', '==', true),
        where('gender', 'in', genderPreferences),
        limit(maxResults * 2) // Fetch extra to account for filtering
      );

      const snapshot = await getDocs(q);
      
      // Get list of users this user has already swiped on
      const alreadySwipedIds = await this.getSwipedUserIds(currentUserId);
      
      // Filter out current user, already swiped users, and verify document exists
      const matches = snapshot.docs
        .filter(doc => {
          const data = doc.data() as UserProfile;
          return (
            doc.exists() && 
            data.uid !== currentUserId && 
            data.uid && 
            data.hasProfile &&
            !alreadySwipedIds.includes(data.uid) // NEW: Filter out already swiped
          );
        })
        .map(doc => doc.data() as UserProfile)
        .slice(0, maxResults); // Take only the requested amount

      // Enrich favorites with poster URLs from TMDb
      const enrichedMatches = await Promise.all(
        matches.map(async (profile) => {
          if (profile.favorites && profile.favorites.length > 0) {
            const enrichedFavorites = await Promise.all(
              profile.favorites.map(async (fav) => {
                try {
                  const movieId = typeof fav.id === 'number' ? fav.id : parseInt(String(fav.id), 10);
                  if (!isNaN(movieId)) {
                    const details = await TMDbService.getMovieDetails(movieId);
                    if (details) {
                      return {
                        ...fav,
                        poster: TMDbService.getPosterUrl(details.poster_path, 'w342')
                      };
                    }
                  }
                } catch (err) {
                  console.log(`Could not fetch poster for ${fav.title}`);
                }
                return fav;
              })
            );
            return { ...profile, favorites: enrichedFavorites };
          }
          return profile;
        })
      );

      console.log(`Found ${enrichedMatches.length} potential matches (filtered from ${snapshot.docs.length} results)`);
      return enrichedMatches;
    } catch (error) {
      console.error('Error fetching potential matches:', error);
      return [];
    }
  }

  /**
   * Get list of user IDs that current user has already swiped on (like or pass)
   */
  private static async getSwipedUserIds(currentUserId: string): Promise<string[]> {
    try {
      const swipesRef = collection(this.db, 'swipes');
      
      // Query all swipes where current user is the swiper
      // Document IDs are in format: {userId}_{targetUserId}
      const allSwipes = await getDocs(swipesRef);
      
      const swipedIds: string[] = [];
      
      allSwipes.forEach(doc => {
        const docId = doc.id;
        const parts = docId.split('_');
        
        // If this swipe was made by current user, add target to list
        if (parts[0] === currentUserId && parts[1]) {
          swipedIds.push(parts[1]);
        }
      });
      
      console.log(`User has already swiped on ${swipedIds.length} profiles`);
      return swipedIds;
    } catch (error) {
      console.error('Error fetching swiped users:', error);
      return [];
    }
  }

  /**
   * Calculate compatibility score between two users based on their movie preferences
   */
  static calculateCompatibility(user1: UserProfile, user2: UserProfile): number {
    let totalScore = 0;
    let totalWeight = 0;

    // Compare genre ratings (weight: 40)
    if (user1.genreRatings?.length && user2.genreRatings?.length) {
      const genreScore = this.compareGenreRatings(user1.genreRatings, user2.genreRatings);
      totalScore += genreScore * 40;
      totalWeight += 40;
    }

    // Compare favorite movies (weight: 30)
    if (user1.favorites?.length && user2.favorites?.length) {
      const favScore = this.compareFavorites(user1.favorites, user2.favorites);
      totalScore += favScore * 30;
      totalWeight += 30;
    }

    // Compare recent watches (weight: 30)
    if (user1.recentWatches?.length && user2.recentWatches?.length) {
      const recentScore = this.compareRecents(user1.recentWatches, user2.recentWatches);
      totalScore += recentScore * 30;
      totalWeight += 30;
    }

    // If no factors to compare, return base score
    if (totalWeight === 0) {
      return 60;
    }

    // Calculate normalized score (0-100)
    const normalizedScore = Math.round(totalScore / totalWeight * 100);
    
    // Return final score (clamped to 0-100)
    return Math.max(0, Math.min(100, normalizedScore));
  }

  private static compareGenreRatings(
    ratings1: Array<{ genre: string; rating: number }>,
    ratings2: Array<{ genre: string; rating: number }>
  ): number {
    const map1 = new Map(ratings1.map(r => [r.genre.toLowerCase(), r.rating]));
    const map2 = new Map(ratings2.map(r => [r.genre.toLowerCase(), r.rating]));
    
    let totalDiff = 0;
    let count = 0;

    map1.forEach((rating1, genre) => {
      const rating2 = map2.get(genre);
      if (rating2 !== undefined) {
        const diff = Math.abs(rating1 - rating2);
        totalDiff += (5 - diff) / 5;
        count++;
      }
    });

    return count > 0 ? totalDiff / count : 0;
  }

  private static compareFavorites(
    favs1: Array<{ id: string | number; title: string }>,
    favs2: Array<{ id: string | number; title: string }>
  ): number {
    const ids1 = new Set(favs1.map(f => String(f.id)));
    const ids2 = new Set(favs2.map(f => String(f.id)));
    
    let matches = 0;
    ids1.forEach(id => {
      if (ids2.has(id)) matches++;
    });

    const totalUnique = new Set([...ids1, ...ids2]).size;
    return totalUnique > 0 ? matches / totalUnique : 0;
  }

  private static compareRecents(
    recents1: Array<{ id: string | number; title: string }>,
    recents2: Array<{ id: string | number; title: string }>
  ): number {
    const ids1 = new Set(recents1.map(r => String(r.id)));
    const ids2 = new Set(recents2.map(r => String(r.id)));
    
    let matches = 0;
    ids1.forEach(id => {
      if (ids2.has(id)) matches++;
    });

    const totalUnique = new Set([...ids1, ...ids2]).size;
    return totalUnique > 0 ? matches / totalUnique : 0;
  }
}