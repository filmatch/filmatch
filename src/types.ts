// src/types.ts
export type FavoriteMovie = {
  id: string | number;
  title: string;
  year?: number;
  poster?: string; // Eşleşme ekranında posteri buraya ekliyoruz
};

export type RecentWatch = {
  id: string | number;
  title: string;
  year?: number;
  rating: number; // 1-5
};

export type GenreRating = {
  genre: string;
  rating: number; // 0-5
};

export type UserProfile = {
  uid: string;
  email?: string;
  displayName?: string;

  // Profile fields
  age?: number;
  city?: string;
  gender?: string;              // "female" | "male" | "nonbinary" | "other"
  genderPreferences?: string[]; // ["female", "male"...]
  bio?: string;
  photos?: string[];            // storage URLs

  // Preferences
  favorites?: FavoriteMovie[];
  recentWatches?: RecentWatch[];
  genreRatings?: GenreRating[];

  // Flags
  hasProfile?: boolean;
  hasPreferences?: boolean;

  createdAt?: number;
  updatedAt?: number;
};

export type Movie = {
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
};