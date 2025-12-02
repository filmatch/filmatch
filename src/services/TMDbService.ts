// src/services/TMDbService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const RATED_MOVIES_KEY = '@rated_movies';

export interface TMDbMovie {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  adult: boolean;
  original_language: string;
  original_title: string;
  popularity: number;
  video: boolean;
}

export interface TMDbMovieDetails extends TMDbMovie {
  budget: number;
  genres: { id: number; name: string }[];
  homepage: string | null;
  imdb_id: string | null;
  status: string;
  tagline: string | null;
  runtime: number | null;
  credits?: {
    cast: any[];
    crew: any[];
  };
}

export interface Movie {
  id: number;
  tmdb_id: number;
  title: string;
  year?: number;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: string[];
  director?: string;
  rating?: number;
  overview: string;
  runtime?: number;
  cast?: string[];
  release_date?: string;
  vote_average?: number;
  isRated?: boolean;
  userRating?: number;
}

export class TMDbService {
  private static readonly API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY;
  private static genreCache: Map<number, string> = new Map();

  private static async fetchFromTMDb(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    if (!this.API_KEY) throw new Error('TMDb API key missing');

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', this.API_KEY);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    try {
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`TMDb Error: ${response.status}`);
      return response.json();
    } catch (error) {
      console.error('⌛ [TMDb Fetch Error]:', error);
      throw error;
    }
  }

  // --- RATED MOVIES MANAGEMENT ---
  
  static async getRatedMovieIds(): Promise<number[]> {
    try {
      const stored = await AsyncStorage.getItem(RATED_MOVIES_KEY);
      if (!stored) return [];
      const ratedMovies = JSON.parse(stored);
      return Object.keys(ratedMovies).map(id => parseInt(id, 10));
    } catch (error) {
      console.error('Error fetching rated movie IDs:', error);
      return [];
    }
  }

  static async getRatedMovies(): Promise<Record<number, number>> {
    try {
      const stored = await AsyncStorage.getItem(RATED_MOVIES_KEY);
      if (!stored) return {};
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error fetching rated movies:', error);
      return {};
    }
  }

  static async isMovieRated(movieId: number): Promise<boolean> {
    try {
      const ratedMovies = await this.getRatedMovies();
      return movieId in ratedMovies;
    } catch (error) {
      return false;
    }
  }

  static async saveMovieRating(movieId: number, rating: number): Promise<void> {
    try {
      const ratedMovies = await this.getRatedMovies();
      ratedMovies[movieId] = rating;
      await AsyncStorage.setItem(RATED_MOVIES_KEY, JSON.stringify(ratedMovies));
    } catch (error) {
      console.error('Error saving movie rating:', error);
      throw error;
    }
  }

  // --- FIX: Robust remove logic ---
  static async removeMovieRating(movieId: number): Promise<void> {
    try {
      const ratedMovies = await this.getRatedMovies();
      const key = String(movieId);
      
      // Check both number and string key presence before deleting
      if (key in ratedMovies) {
        delete ratedMovies[key];
        await AsyncStorage.setItem(RATED_MOVIES_KEY, JSON.stringify(ratedMovies));
        console.log(`🗑️ Removed rating for movie ${movieId} from storage`);
      }
    } catch (error) {
      console.error('Error removing movie rating:', error);
      throw error;
    }
  }

  static async bulkSaveRatings(ratingsMap: Record<number, number>): Promise<void> {
    try {
      const current = await this.getRatedMovies();
      const merged = { ...current, ...ratingsMap };
      await AsyncStorage.setItem(RATED_MOVIES_KEY, JSON.stringify(merged));
      console.log('✅ Bulk ratings saved to storage');
    } catch (error) {
      console.error('Error bulk saving ratings:', error);
    }
  }

  static async enrichWithRatings(movies: Movie[]): Promise<Movie[]> {
    try {
      const ratedMovies = await this.getRatedMovies();
      return movies.map(movie => ({
        ...movie,
        isRated: movie.id in ratedMovies,
        userRating: ratedMovies[movie.id] || undefined
      }));
    } catch (error) {
      return movies;
    }
  }

  // --- GENRES ---
  static async getGenres(): Promise<any[]> {
    try {
      if (this.genreCache.size > 0) return [];
      const data = await this.fetchFromTMDb('/genre/movie/list');
      data.genres.forEach((g: any) => this.genreCache.set(g.id, g.name));
      return data.genres;
    } catch (e) { return []; }
  }

  // --- SEARCH ---
  static async searchMovies(query: string, filterRated: boolean = false): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/search/movie', { query: query.trim(), include_adult: 'false' });
      let movies = data.results.map((m: any) => this.convertTMDbToMovie(m));
      
      console.log(`📥 TMDb returned ${movies.length} movies for "${query}"`);
      
      movies = await this.enrichWithRatings(movies);
      
      if (filterRated) {
        movies = movies.filter(m => !m.isRated);
      }
      
      return movies;
    } catch (e) { 
      console.error('❌ Search error:', e);
      return []; 
    }
  }

  // --- MOVIE LISTS ---
  static async getNowPlayingMovies(page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/movie/now_playing', { page: page.toString(), region: 'TR' });
      const movies = data.results.map((m: any) => this.convertTMDbToMovie(m));
      return await this.enrichWithRatings(movies);
    } catch (e) { return []; }
  }

  static async getPopularMovies(): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/movie/popular');
      const movies = data.results.map((m: any) => this.convertTMDbToMovie(m));
      return await this.enrichWithRatings(movies);
    } catch (e) { return []; }
  }

  static async getTopRatedMovies(page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/movie/top_rated', { page: page.toString() });
      const movies = data.results.map((m: any) => this.convertTMDbToMovie(m));
      return await this.enrichWithRatings(movies);
    } catch (e) { return []; }
  }

  static async getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb(`/trending/movie/${timeWindow}`);
      const movies = data.results.map((m: any) => this.convertTMDbToMovie(m));
      return await this.enrichWithRatings(movies);
    } catch (e) { return []; }
  }

  static async getMovieDetails(movieId: number): Promise<TMDbMovieDetails | null> {
    try {
      const data = await this.fetchFromTMDb(`/movie/${movieId}`, { append_to_response: 'credits' });
      return data;
    } catch (error) { return null; }
  }

  // --- HELPER METHODS ---
  static getPosterUrl(posterPath: string | null, size: 'w154' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
    if (!posterPath) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${posterPath}`;
  }

  static async findPoster(title: string, year?: number): Promise<string | null> {
    try {
      if (!title) return null;
      const results = await this.searchMovies(title);
      if (!results || results.length === 0) return null;
      let match = results[0];
      if (year) {
        const exactMatch = results.find(m => m.year === year);
        if (exactMatch) match = exactMatch;
      }
      return this.getPosterUrl(match.poster_path, 'w154');
    } catch (error) {
      return null;
    }
  }

  static async enrichProfile(profile: any): Promise<any> {
    const enriched = { ...profile };
    if (enriched.favorites) {
      enriched.favorites = await Promise.all(enriched.favorites.map(async (fav: any) => {
        if (fav.poster) return fav; 
        const foundUrl = await this.findPoster(fav.title, fav.year);
        return { ...fav, poster: foundUrl };
      }));
    }
    if (enriched.recentWatches) {
      enriched.recentWatches = await Promise.all(enriched.recentWatches.map(async (rec: any) => {
        if (rec.poster) return rec;
        const foundUrl = await this.findPoster(rec.title, rec.year);
        return { ...rec, poster: foundUrl };
      }));
    }
    return enriched;
  }

  static convertTMDbToMovie(tmdbMovie: any): Movie {
    const genres = tmdbMovie.genre_ids 
      ? tmdbMovie.genre_ids.map((id: number) => this.genreCache.get(id) || 'Unknown').filter((g: string) => g !== 'Unknown')
      : [];
      
    return {
      id: tmdbMovie.id,
      tmdb_id: tmdbMovie.id,
      title: tmdbMovie.title,
      year: tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : 0,
      poster_path: tmdbMovie.poster_path,
      backdrop_path: tmdbMovie.backdrop_path,
      genres,
      overview: tmdbMovie.overview,
      rating: tmdbMovie.vote_average,
      release_date: tmdbMovie.release_date
    };
  }
}

export default TMDbService;