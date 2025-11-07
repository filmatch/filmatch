// src/screens/ProfileScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/MainApp';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import type { UserProfile } from '../types';
import { navigateNested, logTree } from '../navigation/RootNavigation';
import TMDbService from '../services/TMDbService';

type PosterCache = Record<string, string | null>;

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [posterCache, setPosterCache] = useState<PosterCache>({});
  const [postersLoading, setPostersLoading] = useState(false);

  const nav = useNavigation();
  const starFontFamily = Platform.select({ ios: 'System', android: 'sans-serif' });

  useEffect(() => {
    loadUserProfile();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!loading && userProfile) {
        loadUserProfile();
      }
    }, [loading, userProfile])
  );

  useEffect(() => {
    if (!userProfile) return;
    fetchMissingPosters(userProfile);
  }, [userProfile?.favorites, userProfile?.recentWatches]);

  const loadUserProfile = async () => {
    try {
      const currentUser = FirebaseAuthService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('error', 'no user found. please sign in again.');
        return;
      }
      const profile = await FirestoreService.getUserProfile(currentUser.uid);
      if (profile) setUserProfile(profile);
      else Alert.alert('error', 'could not load user profile.');
    } catch (error) {
      console.error('error loading user profile:', error);
      Alert.alert('error', 'failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadUserProfile();
  };

  const handleSignOut = async () => {
    try {
      await FirebaseAuthService.signOut();
    } catch (error) {
      console.error('error signing out:', error);
      Alert.alert('error', 'failed to sign out.');
    }
  };

  const confirmSignOut = () => {
    Alert.alert('sign out', 'are you sure you want to sign out?', [
      { text: 'cancel', style: 'cancel' },
      { text: 'sign out', onPress: handleSignOut, style: 'destructive' },
    ]);
  };

  const keyFor = (title: string, year?: number) => `${(title || '').trim().toLowerCase()}-${year || ''}`;

  const fetchMissingPosters = async (profile: UserProfile) => {
    const want: { title: string; year?: number }[] = [];
    const favs = (profile.favorites || []).slice(0, 4);
    favs.forEach((f) => {
      const k = keyFor(f.title, f.year as any);
      if (!(k in posterCache)) want.push({ title: f.title, year: f.year as any });
    });
    (profile.recentWatches || []).forEach((r) => {
      const k = keyFor(r.title, r.year as any);
      if (!(k in posterCache)) want.push({ title: r.title, year: r.year as any });
    });

    if (!want.length) return;

    setPostersLoading(true);
    try {
      const updates: PosterCache = {};
      for (const w of want) {
        try {
          const results = await TMDbService.searchMovies(w.title);
          let match = results.find((m) => (m.year ? m.year === w.year : false)) || results[0];
          updates[keyFor(w.title, w.year)] = match?.poster_path ?? null;
        } catch (_) {
          updates[keyFor(w.title, w.year)] = null;
        }
      }
      setPosterCache((prev) => ({ ...prev, ...updates }));
    } finally {
      setPostersLoading(false);
    }
  };

  const fourFavorites = useMemo(() => (userProfile?.favorites || []).slice(0, 4), [userProfile?.favorites]);

  const handleEditPreferences = () => {
    logTree?.();
    navigateNested('MainApp', 'EditPreferences');
  };

  const handleEditProfile = () => {
    logTree?.();
    navigateNested('MainApp', 'EditProfile');
  };

  const genderDisplay = userProfile?.gender ? userProfile.gender : '';
  const interestedInDisplay = (userProfile?.genderPreferences && Array.isArray(userProfile.genderPreferences) && userProfile.genderPreferences.length > 0)
    ? userProfile.genderPreferences.join(', ')
    : '';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F0E4C1" />
          <Text style={styles.loadingText}>loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>could not load profile data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
            <Text style={styles.retryButtonText}>retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalWatches = (userProfile.recentWatches || []).length;
  const ratedGenres = (userProfile.genreRatings || []).filter((g) => g.rating > 0).length;
  const profilePhotoUrl = (userProfile.photos && userProfile.photos.length > 0) ? userProfile.photos[0] : null;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            {/* Profile Photo */}
            <View style={styles.profilePhotoContainer}>
              {profilePhotoUrl ? (
                <Image source={{ uri: profilePhotoUrl }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.profilePhotoPlaceholder}>
                  <Text style={styles.profilePhotoPlaceholderText}>no photo</Text>
                </View>
              )}
            </View>

            <View style={styles.userDetails}>
              <Text style={styles.displayName}>
                {(userProfile.displayName || 'movie lover').toLowerCase()}
              </Text>

              {/* Age · City · Gender */}
              {(userProfile.age || userProfile.city || genderDisplay) && (
                <Text style={styles.profileLine}>
                  {userProfile.age ? `${userProfile.age}` : ''}
                  {userProfile.city ? `${userProfile.age ? ' · ' : ''}${userProfile.city}` : ''}
                  {genderDisplay ? `${userProfile.age || userProfile.city ? ' · ' : ''}${genderDisplay}` : ''}
                </Text>
              )}

              {/* Bio */}
              {userProfile.bio && <Text style={styles.bio}>{userProfile.bio}</Text>}

              {/* Genders I'd like to match */}
              {interestedInDisplay && (
                <Text style={styles.interestedIn}>
                  looking for: {interestedInDisplay}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Favorite Films */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>favorite films</Text>
            <Text style={styles.sectionMeta}>{fourFavorites.length}/4</Text>
          </View>

          <View style={styles.favoritesGrid}>
            {Array.from({ length: 4 }).map((_, idx) => {
              const fav = fourFavorites[idx];
              if (!fav) {
                return <View key={`empty-${idx}`} style={[styles.posterSlot, styles.emptySlot]} />;
              }
              const k = keyFor(fav.title, fav.year as any);
              const poster = posterCache[k];

              return (
                <TouchableOpacity key={fav.id} style={styles.posterSlot}>
                  {poster ? (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w342${poster}` }} style={styles.posterImage} />
                  ) : (
                    <View style={[styles.posterImage, styles.posterPlaceholder]}>
                      <Text style={styles.posterPlaceholderText}>no{'\n'}image</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Recent Diary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>recent diary entries</Text>
            <Text style={styles.sectionMeta}>
              {totalWatches > 0 ? `last ${Math.min(totalWatches, 5)}` : 'none yet'}
            </Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <Text style={styles.refreshButtonText}>refresh</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.diaryContainer}>
            {(userProfile.recentWatches || []).length === 0 ? (
              <Text style={styles.emptyText}>no diary entries yet</Text>
            ) : (
              (userProfile.recentWatches || [])
                .slice()
                .reverse()
                .map((movie, index) => {
                  const k = keyFor(movie.title, movie.year as any);
                  const poster = posterCache[k];
                  return (
                    <View key={`${movie.id}-${index}`} style={styles.diaryEntry}>
                      <View style={styles.diaryPoster}>
                        {poster ? (
                          <Image source={{ uri: `https://image.tmdb.org/t/p/w154${poster}` }} style={styles.diaryPosterImage} />
                        ) : (
                          <View style={[styles.diaryPosterImage, styles.posterPlaceholder]}>
                            <Text style={styles.posterPlaceholderText}>no{'\n'}image</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.diaryContent}>
                        <Text style={styles.diaryTitle}>{movie.title.toLowerCase()}</Text>
                        <Text style={styles.diaryYear}>{movie.year}</Text>

                        <View style={styles.diaryRating}>
                          <View style={styles.starsRow}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Text
                                key={star}
                                style={[
                                  styles.starText,
                                  { fontFamily: starFontFamily },
                                  movie.rating >= star ? styles.starFilled : styles.starEmpty,
                                ]}
                              >
                                ★
                              </Text>
                            ))}
                          </View>
                          <Text style={styles.ratingNumber}>{movie.rating}/5</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
            )}
          </View>
        </View>

        {/* Genres */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>top genres</Text>
            <Text style={styles.sectionMeta}>{ratedGenres > 0 ? `${ratedGenres} rated` : 'none rated'}</Text>
          </View>

          <View style={styles.genresGrid}>
            {(userProfile.genreRatings || []).length === 0 ? (
              <Text style={styles.emptyText}>no genre preferences set</Text>
            ) : (
              (userProfile.genreRatings || [])
                .filter((g) => g.rating > 0)
                .sort((a, b) => b.rating - a.rating)
                .slice(0, 6)
                .map((genre) => (
                  <View key={genre.genre} style={styles.genreChip}>
                    <Text style={styles.genreTitle}>{genre.genre.toLowerCase()}</Text>
                    <View style={styles.genreStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Text
                          key={star}
                          style={[
                            styles.genreStarText,
                            { fontFamily: starFontFamily },
                            genre.rating >= star ? styles.starFilled : styles.starEmpty,
                          ]}
                        >
                          ★
                        </Text>
                      ))}
                    </View>
                  </View>
                ))
            )}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleEditPreferences}>
            <Text style={styles.primaryButtonText}>edit preferences</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfile}>
            <Text style={styles.editProfileButtonText}>edit profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={confirmSignOut}>
            <Text style={styles.secondaryButtonText}>sign out</Text>
          </TouchableOpacity>
        </View>

        {postersLoading && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#F0E4C1" />
            <Text style={styles.loadingText}>fetching posters...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const POSTER_SIZE = (width - 60) / 4 - 6;
const PROFILE_PHOTO_SIZE = POSTER_SIZE;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#F0E4C1', fontSize: 16, opacity: 0.8, textTransform: 'lowercase' },

  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 40 },
  errorText: { color: '#F0E4C1', fontSize: 16, textAlign: 'center', opacity: 0.8, textTransform: 'lowercase' },
  retryButton: { backgroundColor: '#511619', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryButtonText: { color: '#F0E4C1', fontSize: 16, fontWeight: '600', textTransform: 'lowercase' },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  profileHeader: { paddingHorizontal: 20, paddingVertical: 30, borderBottomWidth: 1, borderBottomColor: 'rgba(240, 228, 193, 0.1)' },
  profileInfo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },

  profilePhotoContainer: { 
    width: PROFILE_PHOTO_SIZE, 
    height: PROFILE_PHOTO_SIZE, 
    marginRight: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  profilePhoto: { 
    width: '100%', 
    height: '100%',
    backgroundColor: 'rgba(240, 228, 193, 0.05)',
  },
  profilePhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(240, 228, 193, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(240, 228, 193, 0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhotoPlaceholderText: {
    color: 'rgba(240, 228, 193, 0.4)',
    fontSize: 10,
    textAlign: 'center',
    textTransform: 'lowercase',
  },

  userDetails: { flex: 1, paddingTop: 4 },
  displayName: { color: '#F0E4C1', fontSize: 26, fontWeight: 'bold', marginBottom: 8, textTransform: 'lowercase' },

  profileLine: { color: '#F0E4C1', fontSize: 16, opacity: 0.85, marginBottom: 8, textTransform: 'lowercase', lineHeight: 22 },
  bio: { color: '#F0E4C1', fontSize: 15, opacity: 0.8, marginBottom: 8, textTransform: 'lowercase', lineHeight: 22 },
  interestedIn: { color: '#F0E4C1', fontSize: 15, opacity: 0.75, marginTop: 4, textTransform: 'lowercase', fontStyle: 'italic', lineHeight: 22 },

  section: { paddingHorizontal: 20, paddingVertical: 24 },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#F0E4C1', fontSize: 18, fontWeight: 'bold', textTransform: 'lowercase' },
  sectionMeta: { color: '#F0E4C1', fontSize: 14, opacity: 0.6, textTransform: 'lowercase' },

  refreshButton: { marginLeft: 12, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(240, 228, 193, 0.1)', borderRadius: 6 },
  refreshButtonText: { color: '#F0E4C1', fontSize: 12, textTransform: 'lowercase' },

  favoritesGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  posterSlot: { width: POSTER_SIZE, height: POSTER_SIZE * 1.5, borderRadius: 4, overflow: 'hidden' },
  posterImage: { width: '100%', height: '100%', backgroundColor: 'rgba(240, 228, 193, 0.1)' },
  emptySlot: { backgroundColor: 'rgba(240, 228, 193, 0.03)', borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.1)', borderStyle: 'dashed' },

  posterPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.15)' },
  posterPlaceholderText: { color: '#F0E4C1', fontSize: 10, textAlign: 'center', opacity: 0.5, textTransform: 'lowercase', lineHeight: 12 },

  diaryContainer: { gap: 10 },
  diaryEntry: { flexDirection: 'row', backgroundColor: 'rgba(240, 228, 193, 0.03)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.08)' },
  diaryPoster: { marginRight: 12 },
  diaryPosterImage: { width: 50, height: 75, borderRadius: 4, backgroundColor: 'rgba(240, 228, 193, 0.1)' },
  diaryContent: { flex: 1, justifyContent: 'center' },
  diaryTitle: { color: '#F0E4C1', fontSize: 16, fontWeight: '600', marginBottom: 2, textTransform: 'lowercase' },
  diaryYear: { color: '#F0E4C1', fontSize: 14, opacity: 0.6, marginBottom: 8 },
  diaryRating: { flexDirection: 'row', alignItems: 'center' },

  starsRow: { flexDirection: 'row', marginRight: 8 },
  starText: { fontSize: 14, fontWeight: 'bold', marginRight: 1 },
  starFilled: { color: '#F0E4C1' },
  starEmpty: { color: 'rgba(240, 228, 193, 0.3)' },
  ratingNumber: { color: '#F0E4C1', fontSize: 12, opacity: 0.7 },

  genresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreChip: {
    backgroundColor: 'rgba(240, 228, 193, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(240, 228, 193, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  genreTitle: { color: '#F0E4C1', fontSize: 14, fontWeight: '500', textTransform: 'lowercase' },
  genreStars: { flexDirection: 'row' },
  genreStarText: { fontSize: 10, fontWeight: 'bold' },

  emptyText: { color: '#F0E4C1', fontSize: 14, textAlign: 'center', opacity: 0.5, fontStyle: 'italic', paddingVertical: 20, textTransform: 'lowercase' },

  actionsContainer: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  primaryButton: { backgroundColor: '#511619', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
  editProfileButton: { backgroundColor: 'rgba(240, 228, 193, 0.1)', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.2)' },
  editProfileButtonText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240, 228, 193, 0.3)',
  },
  secondaryButtonText: { color: '#F0E4C1', fontSize: 16, fontWeight: '600', textTransform: 'lowercase' },

  loadingIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 16 },
});