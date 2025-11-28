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
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import TMDbService from '../services/TMDbService';
import { navigateNested, logTree } from '../navigation/RootNavigation';
import ProfileCard from '../components/ProfileCard'; // <--- The new shared component

const { width, height } = Dimensions.get('window');
const PROFILE_PHOTO_SIZE = (width - 60) / 4 - 6;

// Helper function to generate keys for cache
const keyFor = (title: string, year?: number) => `${(title || '').trim().toLowerCase()}-${year || ''}`;

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);

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
    }, [loading]) // Removed userProfile dependency to prevent loop
  );

  const loadUserProfile = async () => {
    try {
      const currentUser = FirebaseAuthService.getCurrentUser();
      if (!currentUser) {
        Alert.alert('error', 'no user found. please sign in again.');
        return;
      }
      
      let profile = await FirestoreService.getUserProfile(currentUser.uid);
      
      if (profile) {
        // ENRICH DATA: Fix missing posters automatically using the Service
        const richProfile = await TMDbService.enrichProfile(profile);
        setUserProfile(richProfile);
      } else {
        Alert.alert('error', 'could not load user profile.');
      }
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

  const handleEditPreferences = () => {
    logTree?.();
    navigateNested('MainApp', 'EditPreferences');
  };

  const handleEditProfile = () => {
    logTree?.();
    navigateNested('MainApp', 'EditProfile');
  };

  // --- Render Helpers ---

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

  const profilePhotoUrl = (userProfile.photos && userProfile.photos.length > 0) ? userProfile.photos[0] : null;
  const totalWatches = (userProfile.recentWatches || []).length;
  const ratedGenres = (userProfile.genreRatings || []).filter((g: any) => g.rating > 0).length;
  const genderDisplay = userProfile.gender || '';
  const interestedInDisplay = (userProfile.genderPreferences || []).join(', ');
  
  // Favorites logic
  const fourFavorites = (userProfile.favorites || []).slice(0, 4);

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
            
            {/* LEFT COLUMN: Photo + Button */}
            <View style={styles.headerLeftCol}>
              <View style={styles.profilePhotoContainer}>
                {profilePhotoUrl ? (
                  <Image source={{ uri: profilePhotoUrl }} style={styles.profilePhoto} />
                ) : (
                  <View style={styles.profilePhotoPlaceholder}>
                    <Text style={styles.profilePhotoPlaceholderText}>no photo</Text>
                  </View>
                )}
              </View>

              {/* PREVIEW BUTTON -> OPENS NEW SHARED CARD */}
              <TouchableOpacity style={styles.miniPreviewBtn} onPress={() => setPreviewVisible(true)}>
                <Text style={styles.miniPreviewText}>preview</Text>
              </TouchableOpacity>
            </View>

            {/* RIGHT COLUMN: Details + Edit Button */}
            <View style={styles.userDetails}>
               <View style={styles.nameAndEditRow}>
                   <Text style={styles.displayName}>
                     {(userProfile.displayName || 'movie lover').toLowerCase()}
                   </Text>
                   
                   <TouchableOpacity style={styles.smallEditBtn} onPress={handleEditProfile}>
                       <Text style={styles.smallEditBtnText}>edit profile</Text>
                   </TouchableOpacity>
               </View>

              {(userProfile.age || userProfile.city || genderDisplay) && (
                <Text style={styles.profileLine}>
                  {userProfile.age ? `${userProfile.age}` : ''}
                  {userProfile.city ? `${userProfile.age ? ' · ' : ''}${userProfile.city}` : ''}
                  {genderDisplay ? `${userProfile.age || userProfile.city ? ' · ' : ''}${genderDisplay}` : ''}
                </Text>
              )}

              {userProfile.bio && <Text style={styles.bio}>{userProfile.bio}</Text>}

              {interestedInDisplay && (
                <Text style={styles.interestedIn}>
                  looking for: {interestedInDisplay}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Favorite Films (Main UI) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>favorite films</Text>
            <Text style={styles.sectionMeta}>{fourFavorites.length}/4</Text>
          </View>
          <View style={styles.favoritesGrid}>
            {[0, 1, 2, 3].map((idx) => {
              const fav = fourFavorites[idx];
              if (!fav) return <View key={`empty-${idx}`} style={[styles.posterSlot, styles.emptySlot]} />;
              
              // Use enrichProfile data directly
              return (
                <TouchableOpacity key={fav.id || idx} style={styles.posterSlot}>
                  {fav.poster ? (
                    <Image source={{ uri: fav.poster }} style={styles.posterImage} />
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

        {/* Recent Diary (YOUR ORIGINAL LIST STYLE PRESERVED) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>recent diary entries</Text>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <Text style={styles.sectionMeta}>
                {totalWatches > 0 ? `last ${Math.min(totalWatches, 4)}` : 'none yet'}
              </Text>
            </View>
          </View>

          <View style={styles.diaryContainer}>
            {(userProfile.recentWatches || []).length === 0 ? (
              <Text style={styles.emptyText}>no diary entries yet</Text>
            ) : (
              (userProfile.recentWatches || [])
                .slice() // Copy to avoid mutation
                .reverse() // Show newest first? Or assume server order. Let's assume order needs reversing if it's chronological
                .slice(0, 4)
                .map((movie: any, index: number) => {
                  return (
                    <View key={`${movie.id}-${index}`} style={styles.diaryEntry}>
                      <View style={styles.diaryPoster}>
                        {movie.poster ? (
                          <Image source={{ uri: movie.poster }} style={styles.diaryPosterImage} />
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
                                  (movie.rating || 0) >= star ? styles.starFilled : styles.starEmpty,
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

        {/* Genres (YOUR ORIGINAL GRID STYLE PRESERVED) */}
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
                .filter((g: any) => g.rating > 0)
                .sort((a: any, b: any) => b.rating - a.rating)
                .slice(0, 6)
                .map((genre: any) => (
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
          <TouchableOpacity style={styles.secondaryButton} onPress={confirmSignOut}>
            <Text style={styles.secondaryButtonText}>sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* PREVIEW MODAL (Uses New Shared Card) */}
      <Modal
        visible={previewVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCenter}>
             <ProfileCard profile={userProfile} isPreview={true} onClose={() => setPreviewVisible(false)} />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

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

  // --- Profile Header ---
  profileHeader: { paddingHorizontal: 20, paddingVertical: 30, borderBottomWidth: 1, borderBottomColor: 'rgba(240, 228, 193, 0.1)' },
  profileInfo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },

  // New wrapper for Left Column
  headerLeftCol: { alignItems: 'center', marginRight: 16 },
  
  profilePhotoContainer: { 
    width: PROFILE_PHOTO_SIZE, 
    height: PROFILE_PHOTO_SIZE, 
    borderRadius: PROFILE_PHOTO_SIZE / 2,
    overflow: 'hidden',
    marginBottom: 8, // Space for button below
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

  // Mini Preview Button
  miniPreviewBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 228, 193, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240, 228, 193, 0.15)',
  },
  miniPreviewText: {
    color: '#F0E4C1',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'lowercase',
  },

  userDetails: { flex: 1, paddingTop: 4 },
  
  nameAndEditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  displayName: { color: '#F0E4C1', fontSize: 24, fontWeight: 'bold', textTransform: 'lowercase', flex: 1, marginRight: 8 },
  
  smallEditBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: 'rgba(240,228,193,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(240,228,193,0.2)',
  },
  smallEditBtnText: {
      color: '#F0E4C1',
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'lowercase',
  },

  profileLine: { color: '#F0E4C1', fontSize: 16, opacity: 0.85, marginBottom: 8, textTransform: 'lowercase', lineHeight: 22 },
  bio: { color: '#F0E4C1', fontSize: 15, opacity: 0.8, marginBottom: 8, textTransform: 'lowercase', lineHeight: 22 },
  interestedIn: { color: '#F0E4C1', fontSize: 15, opacity: 0.75, marginTop: 4, textTransform: 'lowercase', fontStyle: 'italic', lineHeight: 22 },

  // --- Standard Profile Sections ---
  section: { paddingHorizontal: 20, paddingVertical: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: '#F0E4C1', fontSize: 18, fontWeight: 'bold', textTransform: 'lowercase' },
  sectionMeta: { color: '#F0E4C1', fontSize: 14, opacity: 0.6, textTransform: 'lowercase' },
  
  favoritesGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  posterSlot: { width: PROFILE_PHOTO_SIZE, height: PROFILE_PHOTO_SIZE * 1.5, borderRadius: 4, overflow: 'hidden' },
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
    backgroundColor: 'rgba(240, 228, 193, 0.08)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.15)', flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  genreTitle: { color: '#F0E4C1', fontSize: 14, fontWeight: '500', textTransform: 'lowercase' },
  genreStars: { flexDirection: 'row' },
  genreStarText: { fontSize: 10, fontWeight: 'bold' },

  emptyText: { color: '#F0E4C1', fontSize: 14, textAlign: 'center', opacity: 0.5, fontStyle: 'italic', paddingVertical: 20, textTransform: 'lowercase' },

  actionsContainer: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  primaryButton: { backgroundColor: '#511619', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
  secondaryButton: { backgroundColor: 'transparent', borderRadius: 12, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.3)' },
  secondaryButtonText: { color: '#F0E4C1', fontSize: 16, fontWeight: '600', textTransform: 'lowercase' },
  
  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,28,42,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCenter: { justifyContent: 'center', alignItems: 'center' },
});