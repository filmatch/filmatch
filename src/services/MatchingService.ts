import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit,
  QueryConstraint 
} from 'firebase/firestore';
import type { UserProfile } from '../types';

export class MatchingService {
  private static db = getFirestore();

  static async getPotentialMatches(
    currentUserId: string,
    currentUserGender: string,
    genderPreferences: string[],
    currentUserIntent: string[], 
    currentUserProfile: UserProfile,
    userCity?: string,
    maxResults: number = 20
  ): Promise<UserProfile[]> {
    try {
      // --- SAFEGUARDS ---
      let safeIntent: string[] = Array.isArray(currentUserIntent) ? currentUserIntent : [];
      if (!safeIntent || safeIntent.length === 0) {
        safeIntent = ['friends', 'romance'];
      }

      let safePrefs = genderPreferences;
      if (!safePrefs || safePrefs.length === 0) {
        safePrefs = currentUserGender === 'male' ? ['female'] : ['male'];
      }

      const usersRef = collection(this.db, 'users');
      
      // Basic DB Constraints (optimizes the fetch)
      // We still filter strictly in memory, but this reduces data over the wire
      const baseConstraints: QueryConstraint[] = [
        where('hasProfile', '==', true),
        where('hasPreferences', '==', true),
        where('gender', 'in', safePrefs) // Rule 1a: They must be a gender I want
      ];

      let allCandidates: UserProfile[] = [];

      // --- FETCHING STRATEGY ---
      
      // 1. Try city-based query first
      if (userCity) {
        try {
          const cityQuery = query(
            usersRef,
            ...baseConstraints,
            where('city', '==', userCity),
            limit(100)
          );
          const citySnapshot = await getDocs(cityQuery);
          allCandidates = citySnapshot.docs.map(doc => doc.data() as UserProfile);
        } catch (e) {
          console.warn('City query failed:', e);
        }
      }

      // 2. If not enough city matches, get global results
      if (allCandidates.length < 30) {
        try {
          const globalQuery = query(usersRef, ...baseConstraints, limit(100));
          const globalSnapshot = await getDocs(globalQuery);
          const globalCandidates = globalSnapshot.docs.map(doc => doc.data() as UserProfile);
          
          const existingIds = new Set(allCandidates.map(u => u.uid));
          globalCandidates.forEach(candidate => {
            if (!existingIds.has(candidate.uid)) {
              allCandidates.push(candidate);
            }
          });
        } catch (e) {
          console.error('Global query failed:', e);
        }
      }

      // 3. Get already swiped users to exclude them
      const alreadySwipedIds = await this.getSwipedUserIds(currentUserId);
      
      // --- LAYER 1: ABSOLUTE FILTERING ---
      const filteredAndScored = allCandidates
        .filter(user => {
          // Rule 3: Self & Swipe Filter
          if (user.uid === currentUserId) return false;
          if (alreadySwipedIds.includes(user.uid)) return false;
          
          // Rule 1b: Bidirectional Gender Check
          // (Database checked if they match MY prefs. Now check if I match THEIR prefs.)
          const theirPrefs = user.genderPreferences || [];
          if (theirPrefs.length > 0 && !theirPrefs.includes(currentUserGender)) {
            return false;
          }

          // Rule 2: Relationship Intent Overlap
          // Must share at least one intent
          const userIntents = user.relationshipIntent || [];
          const hasSharedIntent = safeIntent.some(intent => userIntents.includes(intent));
          if (!hasSharedIntent) return false;

          return true;
        })
        .map(user => {
          // --- LAYER 3: COMPATIBILITY SCORING ---
          const score = this.calculateCompatibility(currentUserProfile, user);
          
          return {
            user,
            compatibility: score,
            isSameCity: userCity && user.city === userCity
          };
        });

      // --- LAYER 2: SORTING ---
      // 1) Same-city users FIRST
      // 2) Then sort by highest compatibility score
      filteredAndScored.sort((a, b) => {
        // Priority 1: City
        if (a.isSameCity && !b.isSameCity) return -1;
        if (!a.isSameCity && b.isSameCity) return 1;
        
        // Priority 2: Score (Highest first)
        return b.compatibility - a.compatibility;
      });

      // Return final list
      return filteredAndScored.slice(0, maxResults).map(item => ({
        ...item.user,
        compatibility: item.compatibility
      }));

    } catch (error) {
      console.error('Matching error:', error);
      return [];
    }
  }

  // --- LAYER 3: COMPATIBILITY SCORE (MOVIE DATA ONLY) ---
  static calculateCompatibility(user1: UserProfile, user2: UserProfile): number {
    
    // Helper to normalize movie lists (handles objects with IDs or titles, and plain strings)
    const getMovieIds = (list: any[]): Set<number | string> => {
      const ids = new Set<number | string>();
      if (!Array.isArray(list)) return ids;
      
      list.forEach(item => {
        if (!item) return;
        if (item.id) {
          ids.add(item.id);
        } else if (item.title) {
          ids.add(String(item.title).trim().toLowerCase());
        } else if (typeof item === 'string') {
          ids.add(item.trim().toLowerCase());
        }
      });
      return ids;
    };

    // ------------------------------------------
    // A) GENRE RATING SIMILARITY (0–40 points)
    // ------------------------------------------
    let genreScore = 0;
    
    const u1Ratings = Array.isArray(user1.genreRatings) ? user1.genreRatings : [];
    const u2Ratings = Array.isArray(user2.genreRatings) ? user2.genreRatings : [];

    if (u1Ratings.length > 0 && u2Ratings.length > 0) {
      // Map User 2's ratings for O(1) lookup
      const u2Map = new Map<string, number>();
      u2Ratings.forEach(r => {
        if (r.genre && typeof r.rating === 'number') {
          u2Map.set(r.genre, r.rating);
        }
      });

      let totalDiff = 0;
      let sharedCount = 0;

      for (const r1 of u1Ratings) {
        if (r1.genre && typeof r1.rating === 'number' && u2Map.has(r1.genre)) {
          const r2Val = u2Map.get(r1.genre) as number;
          // diff = |rating1 - rating2| / 4  (0 to 1)
          const diff = Math.abs(r1.rating - r2Val) / 4;
          totalDiff += diff;
          sharedCount++;
        }
      }

      if (sharedCount > 0) {
        const avgDiff = totalDiff / sharedCount;
        // similarity = 1 - avgDiff
        genreScore = Math.round((1 - avgDiff) * 40);
      }
    }

    // ------------------------------------------
    // B) FILM OVERLAP (0–40 points)
    // ------------------------------------------
    let filmScore = 0;

    const u1Favs = getMovieIds(user1.favorites);
    const u1Recents = getMovieIds(user1.recentWatches);
    const u2Favs = getMovieIds(user2.favorites);
    const u2Recents = getMovieIds(user2.recentWatches);

    // All movies User 1 has interacted with
    const allU1Movies = new Set([...u1Favs, ...u1Recents]);
    
    // Find movies that appear in User 2's lists
    const sharedMovies = [...allU1Movies].filter(m => u2Favs.has(m) || u2Recents.has(m));

    let totalOverlapPoints = 0;

    for (const movieId of sharedMovies) {
      let points = 0;
      const inU1Fav = u1Favs.has(movieId);
      const inU1Rec = u1Recents.has(movieId);
      const inU2Fav = u2Favs.has(movieId);
      const inU2Rec = u2Recents.has(movieId);

      // Scoring hierarchy
      if (inU1Fav && inU2Fav) {
        points = 8; // favorite–favorite
      } else if (inU1Fav && inU2Rec) {
        points = 5; // favorite–recent
      } else if (inU1Rec && inU2Fav) {
        points = 4; // recent–favorite
      } else if (inU1Rec && inU2Rec) {
        points = 2; // recent–recent
      }
      
      totalOverlapPoints += points;
    }

    // Cap Overlap at 40
    filmScore = Math.min(totalOverlapPoints, 40);

    // ------------------------------------------
    // C) DISCOVERY VIBE (0–20 points)
    // ------------------------------------------
    let discoveryScore = 0;

    // 1. My recents in their favorites? (+10)
    let u1RecInU2Fav = false;
    for (const m of u1Recents) {
      if (u2Favs.has(m)) {
        u1RecInU2Fav = true;
        break;
      }
    }
    if (u1RecInU2Fav) discoveryScore += 10;

    // 2. Their recents in my favorites? (+10)
    let u2RecInU1Fav = false;
    for (const m of u2Recents) {
      if (u1Favs.has(m)) {
        u2RecInU1Fav = true;
        break;
      }
    }
    if (u2RecInU1Fav) discoveryScore += 10;

    // ------------------------------------------
    // FINAL CALCULATION
    // ------------------------------------------
    const totalScore = genreScore + filmScore + discoveryScore;
    
    // Clamp between 10 and 99
    return Math.max(10, Math.min(99, Math.round(totalScore)));
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
}