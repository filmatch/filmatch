// src/services/TMDbService.ts
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

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
      console.error('❌ [TMDb Fetch Error]:', error);
      throw error;
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
  static async searchMovies(query: string): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/search/movie', { query: query.trim(), include_adult: 'false' });
      return data.results.map((m: any) => this.convertTMDbToMovie(m));
    } catch (e) { return []; }
  }

  // --- MOVIE LISTS (Restored) ---
  static async getNowPlayingMovies(page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/movie/now_playing', { 
        page: page.toString(), 
        region: 'TR' 
      });
      return data.results.map((m: any) => this.convertTMDbToMovie(m));
    } catch (e) { return []; }
  }

  static async getPopularMovies(): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/movie/popular');
      return data.results.map((m: any) => this.convertTMDbToMovie(m));
    } catch (e) { return []; }
  }

  static async getTopRatedMovies(page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb('/movie/top_rated', { page: page.toString() });
      return data.results.map((m: any) => this.convertTMDbToMovie(m));
    } catch (e) { return []; }
  }

  static async getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) await this.getGenres();
      const data = await this.fetchFromTMDb(`/trending/movie/${timeWindow}`);
      return data.results.map((m: any) => this.convertTMDbToMovie(m));
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

  /**
   * Finds a poster URL for a movie title/year.
   * Useful for filling in gaps in user profiles.
   */
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

  /**
   * Automatically fills in missing posters for a user profile
   */
  static async enrichProfile(profile: any): Promise<any> {
    const enriched = { ...profile };
    
    // Enrich Favorites
    if (enriched.favorites) {
      enriched.favorites = await Promise.all(enriched.favorites.map(async (fav: any) => {
        if (fav.poster) return fav; 
        const foundUrl = await this.findPoster(fav.title, fav.year);
        return { ...fav, poster: foundUrl };
      }));
    }

    // Enrich Recents
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