// src/types.ts
export type FavoriteMovie = {
  id: string;
  title: string;
  year?: number;
};

export type RecentWatch = {
  id: string;
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
  age?: number;           // 18–100
  city?: string;
  gender?: string;        // "female" | "male" | "nonbinary" | "other"
  genderPreferences?: string[]; // ["female", "male", "nonbinary", "other"] - can select multiple
  bio?: string;           // <= 160
  photos?: string[];      // storage URLs (optional)

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

// Used by Search/MovieDetail
export type Movie = {
  id: string | number;
  title: string;
  year?: number;
  poster_path?: string | null;
};