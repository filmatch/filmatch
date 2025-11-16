// src/screens/MovieDetailScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { StackNavigationProp, StackScreenProps } from '@react-navigation/stack';
import { getAuth } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { TMDbService } from '../services/TMDbService';
import { Movie, MovieWithUserData } from '../types';

const { width } = Dimensions.get('window');

type RootStackParamList = {
  MainTabs: undefined;
  MovieDetail: { movie: MovieWithUserData };
  Chat: { chatId?: string } | undefined;
};

type MovieDetailRouteProp = { params: { movie: MovieWithUserData } };
type MovieDetailNavProp = StackNavigationProp<RootStackParamList, 'MovieDetail'>;
export default function MovieDetailScreen() {
  const navigation = useNavigation<MovieDetailNavProp>();
  const route = useRoute<MovieDetailRouteProp>();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const initialMovie = route.params.movie;
  const [movie, setMovie] = useState<MovieWithUserData>(initialMovie);
  const [detailedMovie, setDetailedMovie] = useState<MovieWithUserData | null>(null);
  const [tempRating, setTempRating] = useState<number>(initialMovie.userRating || 0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);

  useEffect(() => {
    loadMovieDetails();
    loadUserData();
  }, []);

  // ---- helpers ----
  const safeVoteAverage = (m: any): number =>
    typeof m?.vote_average === 'number' ? m.vote_average : 0;

  const formatRuntime = (minutes?: number) => {
    if (!minutes || minutes <= 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // ---- data loaders ----
  const loadMovieDetails = async () => {
    try {
const movieId = Number(movie.tmdb_id || movie.id);
      const details = await TMDbService.getMovieDetails(movieId);
      if (details) {
        // keep only fields that exist in your Movie/MovieWithUserData types
        const merged: MovieWithUserData = {
          ...(details as Movie), // normalized by your service
          userRating: movie.userRating || undefined,
          userStatus: movie.userStatus || undefined,
        };
        setDetailedMovie(merged);
        setMovie(merged);
      }
    } catch (error) {
      console.error('Error loading movie details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadUserData = async () => {
    if (!currentUser) return;
    try {
      const userMovieDoc = await getDoc(
        doc(db, 'users', currentUser.uid, 'movies', (movie.id ?? movie.tmdb_id).toString())
      );
      if (userMovieDoc.exists()) {
        const userData = userMovieDoc.data();
        setMovie((prev) => ({
          ...prev,
          userRating: userData.rating || undefined,
          userStatus: userData.status || undefined,
        }));
        setTempRating(userData.rating || 0);
      }
    } catch (error) {
      console.error('Error loading user movie data:', error);
    }
  };

  // ---- interactions ----
  const handleRatingChange = (rating: number) => {
    const newRating = tempRating === rating ? 0 : rating;
    setTempRating(newRating);
    setHasChanges(true);
    if (newRating > 0) setMovie((p) => ({ ...p, userStatus: 'watched' }));
  };

  const handleStatusChange = (status: 'watched' | 'watchlist') => {
    const newStatus = movie.userStatus === status ? null : status;
    setMovie((p) => ({ ...p, userStatus: newStatus || undefined }));
    setHasChanges(true);
  };

const handleSave = async () => {
  if (!currentUser) {
    Alert.alert('error', 'log in first');
    return;
  }
  setIsLoading(true);
  try {
    const finalStatus = tempRating > 0 ? 'watched' : movie.userStatus ?? null;

    // 1. Save to individual movie document (existing code)
    const userMovieRef = doc(db, 'users', currentUser.uid, 'movies', (movie.id ?? movie.tmdb_id).toString());
    await setDoc(
      userMovieRef,
      {
        movieId: movie.id ?? movie.tmdb_id,
        tmdbId: movie.tmdb_id || movie.id,
        title: movie.title,
        year: movie.year,
        rating: tempRating || null,
        status: finalStatus,
        posterPath: movie.poster_path,
        genres: movie.genres ?? [],
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // 2. Update main user document arrays (NEW CODE)
    const userRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      let favorites = userData.favorites || [];
      let recentWatches = userData.recentWatches || [];

      const movieData = {
        id: (movie.id ?? movie.tmdb_id).toString(),
        title: movie.title,
        year: movie.year || (movie.release_date ? new Date(movie.release_date).getFullYear() : 0),
      };

      // Handle favorites (movies with rating 4-5 stars)
      const existingFavIndex = favorites.findIndex((f: any) => f.id === movieData.id);
      if (tempRating >= 4) {
        // Add to favorites if not already there
        if (existingFavIndex === -1) {
          favorites = [...favorites, movieData];
        }
      } else {
        // Remove from favorites if rating is below 4
        if (existingFavIndex !== -1) {
          favorites = favorites.filter((f: any) => f.id !== movieData.id);
        }
      }

      // Handle recent watches (any movie with rating > 0 or marked as watched)
      const existingWatchIndex = recentWatches.findIndex((w: any) => w.id === movieData.id);
      if (finalStatus === 'watched' || tempRating > 0) {
        const watchData = {
          ...movieData,
          rating: tempRating || 0,
        };
        
        if (existingWatchIndex !== -1) {
          // Update existing entry
          recentWatches[existingWatchIndex] = watchData;
        } else {
          // Add new entry
          recentWatches = [...recentWatches, watchData];
        }
        
        // Keep only last 20 watches
        recentWatches = recentWatches.slice(-20);
      } else {
        // Remove from recent watches if no longer watched
        if (existingWatchIndex !== -1) {
          recentWatches = recentWatches.filter((w: any) => w.id !== movieData.id);
        }
      }

      // Update counters
      let watchedCount = userData.watchedMovies || 0;
      let watchlistCount = userData.watchlistMovies || 0;

      if (finalStatus === 'watched' && movie.userStatus !== 'watched') {
        watchedCount += 1;
        if (movie.userStatus === 'watchlist') watchlistCount -= 1;
      } else if (finalStatus === 'watchlist' && movie.userStatus !== 'watchlist') {
        watchlistCount += 1;
        if (movie.userStatus === 'watched') watchedCount -= 1;
      } else if (finalStatus === null) {
        if (movie.userStatus === 'watched') watchedCount -= 1;
        if (movie.userStatus === 'watchlist') watchlistCount -= 1;
      }

      // Update the main user document with all changes
      await updateDoc(userRef, {
        favorites,
        recentWatches,
        watchedMovies: Math.max(0, watchedCount),
        watchlistMovies: Math.max(0, watchlistCount),
        lastUpdated: new Date(),
      });
    }

    setMovie((p) => ({ ...p, userRating: tempRating || undefined, userStatus: finalStatus || undefined }));
    setHasChanges(false);
    Alert.alert('saved', 'your changes are saved', [{ text: 'ok', onPress: () => navigation.goBack() }]);
  } catch (e) {
    console.error('Error saving movie data:', e);
    Alert.alert('error', 'failed to save');
  } finally {
    setIsLoading(false);
  }
};

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert('unsaved changes', 'leave without saving?', [
        { text: 'stay', style: 'cancel' },
        { text: 'leave', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  // ---- render ----
  const displayMovie = detailedMovie || movie;
  const voteAvg = safeVoteAverage(displayMovie); // NO snake_case types needed

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
        {hasChanges && (
          <TouchableOpacity onPress={handleSave} style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} disabled={isLoading}>
            {isLoading ? <ActivityIndicator size="small" color="#F0E4C1" /> : <Text style={styles.saveButtonText}>save</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.posterSection}>
          <View style={styles.posterContainer}>
            {displayMovie?.poster_path ? (
              <Image
                source={{ uri: `https://image.tmdb.org/t/p/w500${displayMovie.poster_path}` }}
                style={styles.posterImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.posterPlaceholder}>
                <Text style={styles.posterPlaceholderText}>🎬</Text>
              </View>
            )}
            {loadingDetails && (
              <View style={styles.posterOverlay}>
                <ActivityIndicator size="small" color="#F0E4C1" />
              </View>
            )}
          </View>

          <View style={styles.basicInfo}>
            <Text style={styles.title}>{displayMovie?.title ?? ''}</Text>
            <Text style={styles.metadata}>
              {displayMovie?.year ?? ''} • {formatRuntime(displayMovie?.runtime)} • ⭐ {voteAvg.toFixed(1)}
            </Text>
            {displayMovie?.director ? <Text style={styles.director}>directed by {displayMovie.director}</Text> : null}
            <View style={styles.genreContainer}>
              {(displayMovie?.genres ?? []).map((g, idx) => (
                <View key={`${g}-${idx}`} style={styles.genreChip}>
                  <Text style={styles.genreText}>{g}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.ratingSection}>
          <Text style={styles.sectionTitle}>rate this movie</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleRatingChange(star)} style={styles.starButton}>
                <Text style={[styles.star, tempRating >= star && styles.starFilled]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          {tempRating > 0 && (
            <Text style={styles.ratingLabel}>
              {tempRating} star{tempRating !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <View style={styles.statusSection}>
          <Text style={styles.sectionTitle}>movie status</Text>
          <View style={styles.statusButtons}>
            <TouchableOpacity
              style={[styles.statusButton, movie.userStatus === 'watched' && styles.statusButtonActive]}
              onPress={() => handleStatusChange('watched')}
            >
              <Text style={[styles.statusButtonText, movie.userStatus === 'watched' && styles.statusButtonTextActive]}>watched</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.statusButton, movie.userStatus === 'watchlist' && styles.statusButtonActive]}
              onPress={() => handleStatusChange('watchlist')}
            >
              <Text style={[styles.statusButtonText, movie.userStatus === 'watchlist' && styles.statusButtonTextActive]}>watchlist</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!!displayMovie?.overview && (
          <View style={styles.overviewSection}>
            <Text style={styles.sectionTitle}>overview</Text>
            <Text style={styles.overviewText}>{displayMovie.overview}</Text>
          </View>
        )}

        {!!displayMovie?.cast?.length && (
          <View style={styles.castSection}>
            <Text style={styles.sectionTitle}>cast</Text>
            <View style={styles.castContainer}>
              {displayMovie.cast.slice(0, 5).map((actor: string, index: number) => (
                <View key={`${actor}-${index}`} style={styles.castMember}>
                  <Text style={styles.castName}>{actor}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(240, 228, 193, 0.1)', justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { color: '#F0E4C1', fontSize: 24, fontWeight: '300' },
  saveButton: { backgroundColor: '#511619', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  saveButtonDisabled: { opacity: 0.7 },
  saveButtonText: { color: '#F0E4C1', fontSize: 14, fontWeight: '600' },
  content: { flex: 1 },
  posterSection: { paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center' },
  posterContainer: { marginBottom: 20, position: 'relative' },
  posterImage: { width: width * 0.6, height: width * 0.9, borderRadius: 16 },
  posterPlaceholder: { width: width * 0.6, height: width * 0.9, backgroundColor: 'rgba(240, 228, 193, 0.1)', borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.2)' },
  posterPlaceholderText: { fontSize: 48 },
  posterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  basicInfo: { alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F0E4C1', textAlign: 'center', marginBottom: 8 },
  metadata: { fontSize: 16, color: '#F0E4C1', opacity: 0.7, marginBottom: 4 },
  director: { fontSize: 14, color: '#F0E4C1', opacity: 0.8, marginBottom: 16 },
  genreContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  genreChip: { backgroundColor: 'rgba(81, 22, 25, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(81, 22, 25, 0.3)' },
  genreText: { color: '#511619', fontSize: 12, fontWeight: '600' },
  ratingSection: { paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(240, 228, 193, 0.1)', paddingTop: 30 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#F0E4C1', marginBottom: 20, textTransform: 'lowercase' },
  starsContainer: { flexDirection: 'row', marginBottom: 12 },
  starButton: { padding: 8 },
  star: { fontSize: 32, color: 'rgba(240, 228, 193, 0.3)' },
  starFilled: { color: '#511619' },
  ratingLabel: { color: '#F0E4C1', fontSize: 14, opacity: 0.8 },
  statusSection: { paddingHorizontal: 20, paddingBottom: 30, alignItems: 'center' },
  statusButtons: { flexDirection: 'row', gap: 16 },
  statusButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: 'rgba(240, 228, 193, 0.1)', borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.2)' },
  statusButtonActive: { backgroundColor: '#511619', borderColor: '#511619' },
  statusButtonText: { color: '#F0E4C1', fontSize: 14, fontWeight: '600', opacity: 0.7, textTransform: 'lowercase' },
  statusButtonTextActive: { opacity: 1 },
  overviewSection: { paddingHorizontal: 20, paddingBottom: 30, borderTopWidth: 1, borderTopColor: 'rgba(240, 228, 193, 0.1)', paddingTop: 30 },
  overviewText: { color: '#F0E4C1', fontSize: 16, lineHeight: 24, opacity: 0.8 },
  castSection: { paddingHorizontal: 20, paddingBottom: 30 },
  castContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  castMember: { backgroundColor: 'rgba(240, 228, 193, 0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.2)' },
  castName: { color: '#F0E4C1', fontSize: 14, opacity: 0.9 },
});
