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
    userCity?: string,
    maxResults: number = 20
  ): Promise<UserProfile[]> {
    try {
      if (!genderPreferences || genderPreferences.length === 0) return [];

      const usersRef = collection(this.db, 'users');
      let snapshot;

      // 1. Şehir Filtresi (Varsa önce bunu dene)
      if (userCity) {
        try {
          const qCity = query(
            usersRef,
            where('hasProfile', '==', true),
            where('city', '==', userCity),
            where('gender', 'in', genderPreferences),
            limit(50)
          );
          snapshot = await getDocs(qCity);
        } catch (e) {
          console.log('Şehir sorgusu hata verdi (Index gerekebilir), genele geçiliyor.');
        }
      }

      // 2. Genel Arama (Yedek Plan)
      // Eğer şehirde kimse yoksa veya hata aldıysa burası çalışır
      if (!snapshot || snapshot.size < 2) {
        const qGlobal = query(
          usersRef,
          where('hasProfile', '==', true),
          where('gender', 'in', genderPreferences),
          limit(50)
        );
        snapshot = await getDocs(qGlobal);
      }

      const alreadySwipedIds = await this.getSwipedUserIds(currentUserId);
      
      const matches = snapshot.docs
        .filter(doc => {
          const data = doc.data() as UserProfile;
          
          // Temel kontroller
          if (data.uid === currentUserId) return false;
          if (alreadySwipedIds.includes(data.uid)) return false;
          
          // NOT: Filtreleri test için kapattık. Geri açmak istersen yorumu kaldır:
          // const theyLookingForMe = data.genderPreferences?.includes(currentUserGender);
          // if (!theyLookingForMe) return false;

          return true;
        })
        .map(doc => doc.data() as UserProfile)
        .slice(0, maxResults);

      console.log(`Posterler işleniyor... Bulunan kişi: ${matches.length}`);

      // --- ID TEMİZLEME VE POSTER ÇEKME ---
      const enrichedMatches = await Promise.all(
        matches.map(async (profile) => {
          if (profile.favorites && profile.favorites.length > 0) {
            const enrichedFavorites = await Promise.all(
              profile.favorites.map(async (fav) => {
                // URL zaten varsa dokunma
                if (fav.poster && fav.poster.startsWith('http')) return fav;

                try {
                  // ID TEMİZLİKÇİSİ 🧹
                  let cleanId = fav.id;

                  // "fav_38_12345" formatını "38"e çevir
                  if (typeof cleanId === 'string' && cleanId.includes('fav_')) {
                    const parts = cleanId.split('_');
                    if (parts[1]) {
                      cleanId = parts[1]; 
                    }
                  }

                  const movieId = Number(cleanId);
                  
                  if (!isNaN(movieId) && movieId > 0) {
                    const details = await TMDbService.getMovieDetails(movieId);
                    if (details && details.poster_path) {
                      const posterUrl = TMDbService.getPosterUrl(details.poster_path, 'w342');
                      if (posterUrl) {
                        return { ...fav, poster: posterUrl };
                      }
                    }
                  }
                } catch (err) {
                  // Hata olursa sessizce devam et
                }
                return fav;
              })
            );
            return { ...profile, favorites: enrichedFavorites };
          }
          return profile;
        })
      );

      return enrichedMatches;

    } catch (error) {
      console.error('Matching error:', error);
      return [];
    }
  }

  private static async getSwipedUserIds(currentUserId: string): Promise<string[]> {
    try {
      const swipesRef = collection(this.db, 'swipes');
      const allSwipes = await getDocs(swipesRef);
      const swipedIds: string[] = [];
      allSwipes.forEach(doc => {
        const [swiperId, targetId] = doc.id.split('_');
        if (swiperId === currentUserId && targetId) swipedIds.push(targetId);
      });
      return swipedIds;
    } catch (error) { return []; }
  }

  static calculateCompatibility(user1: UserProfile, user2: UserProfile): number {
    let totalScore = 0; let totalWeight = 0;
    // Basitleştirilmiş puanlama
    if (user1.genreRatings?.length && user2.genreRatings?.length) {
      totalScore += this.compareGenreRatings(user1.genreRatings, user2.genreRatings) * 40; totalWeight += 40;
    }
    if (user1.favorites?.length && user2.favorites?.length) {
      // Basit eşleşme (şimdilik %50 varsayalım)
      totalScore += 0.5 * 30; totalWeight += 30;
    }
    if (user1.recentWatches?.length && user2.recentWatches?.length) {
      totalScore += 0.5 * 30; totalWeight += 30;
    }
    if (totalWeight === 0) return 60;
    return Math.max(0, Math.min(100, Math.round(totalScore / totalWeight * 100)));
  }

  private static compareGenreRatings(r1: any[], r2: any[]) { 
    // Basit tür karşılaştırması
    return 0.7; 
  }
}