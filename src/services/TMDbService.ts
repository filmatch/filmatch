// src/services/TMDbService.ts
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

// Add this to your .env file:
// EXPO_PUBLIC_TMDB_API_KEY=your_api_key_here

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
  genres: Genre[];
  homepage: string | null;
  imdb_id: string | null;
  production_companies: ProductionCompany[];
  production_countries: ProductionCountry[];
  revenue: number;
  runtime: number | null;
  spoken_languages: SpokenLanguage[];
  status: string;
  tagline: string | null;
  credits?: {
    cast: CastMember[];
    crew: CrewMember[];
  };
}

export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface ProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface SpokenLanguage {
  english_name: string;
  iso_639_1: string;
  name: string;
}

export interface CastMember {
  adult: boolean;
  gender: number | null;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  cast_id: number;
  character: string;
  credit_id: string;
  order: number;
}

export interface CrewMember {
  adult: boolean;
  gender: number | null;
  id: number;
  known_for_department: string;
  name: string;
  original_name: string;
  popularity: number;
  profile_path: string | null;
  credit_id: string;
  department: string;
  job: string;
}

// Standardized Movie interface for your app
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
    if (!this.API_KEY) {
      throw new Error('TMDb API key not configured. Add EXPO_PUBLIC_TMDB_API_KEY to your .env file');
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', this.API_KEY);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Get genre list and cache it
  static async getGenres(): Promise<Genre[]> {
    try {
      const data = await this.fetchFromTMDb('/genre/movie/list');
      
      // Cache genres for quick lookup
      data.genres.forEach((genre: Genre) => {
        this.genreCache.set(genre.id, genre.name);
      });

      return data.genres;
    } catch (error) {
      console.error('Error fetching genres:', error);
      return [];
    }
  }

  // Convert TMDb movie to our standardized format
  static convertTMDbToMovie(tmdbMovie: TMDbMovie | TMDbMovieDetails, credits?: any): Movie {
    const year = tmdbMovie.release_date ? new Date(tmdbMovie.release_date).getFullYear() : 0;
    
    // Get genre names from cache or IDs
    const genres = tmdbMovie.genre_ids 
      ? tmdbMovie.genre_ids.map(id => this.genreCache.get(id) || 'Unknown').filter(g => g !== 'Unknown')
      : 'genres' in tmdbMovie 
        ? tmdbMovie.genres.map(g => g.name)
        : [];

    // Find director from credits
    let director: string | undefined;
    if (credits?.crew) {
      const directorCredit = credits.crew.find((person: CrewMember) => person.job === 'Director');
      director = directorCredit?.name;
    }

    // Get main cast
    const cast = credits?.cast?.slice(0, 5).map((person: CastMember) => person.name) || [];

    return {
      id: tmdbMovie.id,
      tmdb_id: tmdbMovie.id,
      title: tmdbMovie.title,
      year,
      poster_path: tmdbMovie.poster_path,
      backdrop_path: tmdbMovie.backdrop_path,
      genres,
      director,
      rating: Math.round(tmdbMovie.vote_average * 10) / 10,
      overview: tmdbMovie.overview,
      runtime: 'runtime' in tmdbMovie ? tmdbMovie.runtime ?? undefined : undefined,
      cast
    };
  }

  // Get poster URL
  static getPosterUrl(posterPath: string | null, size: 'w154' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string | null {
    if (!posterPath) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${posterPath}`;
  }

  // Get backdrop URL
  static getBackdropUrl(backdropPath: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w780'): string | null {
    if (!backdropPath) return null;
    return `${TMDB_IMAGE_BASE_URL}/${size}${backdropPath}`;
  }

  // Search movies
  static async searchMovies(query: string, page: number = 1): Promise<Movie[]> {
    try {
      // Ensure genres are loaded
      if (this.genreCache.size === 0) {
        await this.getGenres();
      }

      const data = await this.fetchFromTMDb('/search/movie', {
        query: query.trim(),
        page: page.toString(),
        include_adult: 'false'
      });

      return data.results.map((movie: TMDbMovie) => this.convertTMDbToMovie(movie));
    } catch (error) {
      console.error('Error searching movies:', error);
      return [];
    }
  }

  // Get popular movies
  static async getPopularMovies(page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) {
        await this.getGenres();
      }

      const data = await this.fetchFromTMDb('/movie/popular', {
        page: page.toString()
      });

      return data.results.map((movie: TMDbMovie) => this.convertTMDbToMovie(movie));
    } catch (error) {
      console.error('Error fetching popular movies:', error);
      return [];
    }
  }

  // Get trending movies
  static async getTrendingMovies(timeWindow: 'day' | 'week' = 'week'): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) {
        await this.getGenres();
      }

      const data = await this.fetchFromTMDb(`/trending/movie/${timeWindow}`);
      return data.results.map((movie: TMDbMovie) => this.convertTMDbToMovie(movie));
    } catch (error) {
      console.error('Error fetching trending movies:', error);
      return [];
    }
  }

  // Get movie details with credits
  static async getMovieDetails(movieId: number): Promise<Movie | null> {
    try {
      const [movieData, creditsData] = await Promise.all([
        this.fetchFromTMDb(`/movie/${movieId}`),
        this.fetchFromTMDb(`/movie/${movieId}/credits`)
      ]);

      return this.convertTMDbToMovie(movieData, creditsData);
    } catch (error) {
      console.error('Error fetching movie details:', error);
      return null;
    }
  }

  // Get movies by genre
  static async getMoviesByGenre(genreId: number, page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) {
        await this.getGenres();
      }

      const data = await this.fetchFromTMDb('/discover/movie', {
        with_genres: genreId.toString(),
        page: page.toString(),
        sort_by: 'popularity.desc'
      });

      return data.results.map((movie: TMDbMovie) => this.convertTMDbToMovie(movie));
    } catch (error) {
      console.error('Error fetching movies by genre:', error);
      return [];
    }
  }

  // Get top rated movies
  static async getTopRatedMovies(page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) {
        await this.getGenres();
      }

      const data = await this.fetchFromTMDb('/movie/top_rated', {
        page: page.toString()
      });

      return data.results.map((movie: TMDbMovie) => this.convertTMDbToMovie(movie));
    } catch (error) {
      console.error('Error fetching top rated movies:', error);
      return [];
    }
  }

  // Get now playing movies
  static async getNowPlayingMovies(page: number = 1): Promise<Movie[]> {
    try {
      if (this.genreCache.size === 0) {
        await this.getGenres();
      }

      const data = await this.fetchFromTMDb('/movie/now_playing', {
        page: page.toString()
      });

      return data.results.map((movie: TMDbMovie) => this.convertTMDbToMovie(movie));
    } catch (error) {
      console.error('Error fetching now playing movies:', error);
      return [];
    }
  }
}

export default TMDbService;