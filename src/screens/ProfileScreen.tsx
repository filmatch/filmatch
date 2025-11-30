// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from 'react';
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
import { getAuth } from 'firebase/auth'; // <--- ADDED IMPORT
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import TMDbService from '../services/TMDbService';
import ProfileCard from '../components/ProfileCard';
import { COLORS } from '../theme';

const { width } = Dimensions.get('window');
const PROFILE_PHOTO_SIZE = (width - 60) / 4 - 6;

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // <--- NEW STATE

  const nav = useNavigation();
  const starFontFamily = Platform.select({ ios: 'System', android: 'sans-serif' });

  useEffect(() => {
    loadUserProfile();
    checkAdminStatus(); // <--- NEW CHECK
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!loading && userProfile) {
        loadUserProfile();
      }
    }, [loading])
  );

  // --- NEW FUNCTION TO CHECK ADMIN ---
  const checkAdminStatus = async () => {
    const auth = getAuth();
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdTokenResult();
      if (token.claims.role === 'admin') {
        setIsAdmin(true);
      }
    }
  };

  const loadUserProfile = async () => {
    try {
      const currentUser = FirebaseAuthService.getCurrentUser();
      if (!currentUser) {
        return;
      }
      
      let profile = await FirestoreService.getUserProfile(currentUser.uid);
      
      if (profile) {
        const richProfile = await TMDbService.enrichProfile(profile);
        setUserProfile(richProfile);
      }
    } catch (error) {
      console.error('error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadUserProfile();
  };

  const handleSettings = () => {
    // @ts-ignore
    nav.navigate('Settings');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.text} />
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
  const intentDisplay = (userProfile.relationshipIntent || []).join(', '); // <--- NEW INTENT DISPLAY
  const fourFavorites = (userProfile.favorites || []).slice(0, 4);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor={COLORS.text} />}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.profileInfo}>
            
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

              <TouchableOpacity style={styles.miniPreviewBtn} onPress={() => setPreviewVisible(true)}>
                <Text style={styles.miniPreviewText}>preview</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.userDetails}>
               <View style={styles.nameRow}>
                   <Text style={styles.displayName}>
                     {(userProfile.displayName || 'movie lover').toLowerCase()}
                   </Text>
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
              {/* <--- NEW INTENT TEXT */}
              {intentDisplay && (
                <Text style={styles.interestedIn}>
                  intent: {intentDisplay}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Favorite Films */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>favorite films</Text>
            {/* Removed the x/4 counter here */}
          </View>
          <View style={styles.favoritesGrid}>
            {[0, 1, 2, 3].map((idx) => {
              const fav = fourFavorites[idx];
              if (!fav) return <View key={`empty-${idx}`} style={[styles.posterSlot, styles.emptySlot]} />;
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

        {/* Recent Diary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>recent diary entries</Text>
            <Text style={styles.sectionMeta}>
              {totalWatches > 0 ? `last ${Math.min(totalWatches, 4)}` : 'none yet'}
            </Text>
          </View>

          <View style={styles.diaryContainer}>
            {(userProfile.recentWatches || []).length === 0 ? (
              <Text style={styles.emptyText}>no diary entries yet</Text>
            ) : (
              (userProfile.recentWatches || [])
                .slice()
                .reverse()
                .slice(0, 4)
                .map((movie: any, index: number) => (
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
                      </View>
                    </View>
                  </View>
                ))
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

        {/* SETTINGS & ADMIN BUTTONS */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
            <Text style={styles.settingsButtonText}>settings</Text>
          </TouchableOpacity>

          {/* --- ADMIN BUTTON (Only visible if isAdmin is true) --- */}
          {isAdmin && (
            <TouchableOpacity 
              style={[styles.settingsButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#511619', marginTop: 10 }]} 
              onPress={() => nav.navigate('Admin' as never)}
            >
              <Text style={[styles.settingsButtonText, { color: '#F0E4C1' }]}>admin dashboard</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* PREVIEW MODAL */}
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
  container: { flex: 1, backgroundColor: COLORS.bg },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, paddingHorizontal: 40 },
  errorText: { color: COLORS.text, fontSize: 16, textAlign: 'center', opacity: 0.8, textTransform: 'lowercase' },
  retryButton: { backgroundColor: COLORS.button, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  retryButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '600', textTransform: 'lowercase' },

  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Reduced paddingBottom to shrink gap
  profileHeader: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  profileInfo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  headerLeftCol: { alignItems: 'center', marginRight: 16 },
  
  profilePhotoContainer: { 
    width: PROFILE_PHOTO_SIZE, 
    height: PROFILE_PHOTO_SIZE, 
    borderRadius: PROFILE_PHOTO_SIZE / 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  profilePhoto: { width: '100%', height: '100%', backgroundColor: 'rgba(240, 228, 193, 0.05)' },
  profilePhotoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(240, 228, 193, 0.05)',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePhotoPlaceholderText: { color: 'rgba(240, 228, 193, 0.4)', fontSize: 10, textAlign: 'center', textTransform: 'lowercase' },

  miniPreviewBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(240, 228, 193, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  miniPreviewText: { color: COLORS.text, fontSize: 10, fontWeight: '600', textTransform: 'lowercase' },

  userDetails: { flex: 1, paddingTop: 4 },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  displayName: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', textTransform: 'lowercase', flex: 1, marginRight: 8 },
  
  profileLine: { color: COLORS.text, fontSize: 16, opacity: 0.85, marginBottom: 8, textTransform: 'lowercase', lineHeight: 22 },
  bio: { color: COLORS.text, fontSize: 15, opacity: 0.8, marginBottom: 8, textTransform: 'lowercase', lineHeight: 22 },
  interestedIn: { color: COLORS.text, fontSize: 15, opacity: 0.75, marginTop: 4, textTransform: 'lowercase', fontStyle: 'italic', lineHeight: 22 },

  // Reduced paddingVertical to shrink gap
  section: { paddingHorizontal: 20, paddingVertical: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', textTransform: 'lowercase' },
  sectionMeta: { color: COLORS.text, fontSize: 14, opacity: 0.6, textTransform: 'lowercase' },
  
  favoritesGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  posterSlot: { width: PROFILE_PHOTO_SIZE, height: PROFILE_PHOTO_SIZE * 1.5, borderRadius: 4, overflow: 'hidden' },
  posterImage: { width: '100%', height: '100%', backgroundColor: 'rgba(240, 228, 193, 0.1)' },
  emptySlot: { backgroundColor: 'rgba(240, 228, 193, 0.03)', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed' },
  
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.15)' },
  posterPlaceholderText: { color: COLORS.text, fontSize: 10, textAlign: 'center', opacity: 0.5, textTransform: 'lowercase', lineHeight: 12 },

  diaryContainer: { gap: 10 },
  diaryEntry: { flexDirection: 'row', backgroundColor: 'rgba(240, 228, 193, 0.03)', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.08)' },
  diaryPoster: { marginRight: 12 },
  diaryPosterImage: { width: 50, height: 75, borderRadius: 4, backgroundColor: 'rgba(240, 228, 193, 0.1)' },
  diaryContent: { flex: 1, justifyContent: 'center' },
  diaryTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 2, textTransform: 'lowercase' },
  diaryYear: { color: COLORS.text, fontSize: 14, opacity: 0.6, marginBottom: 8 },
  diaryRating: { flexDirection: 'row', alignItems: 'center' },
  starsRow: { flexDirection: 'row', marginRight: 8 },
  starText: { fontSize: 14, fontWeight: 'bold', marginRight: 1 },
  starFilled: { color: COLORS.text },
  starEmpty: { color: 'rgba(240, 228, 193, 0.3)' },

  genresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  genreChip: {
    backgroundColor: 'rgba(240, 228, 193, 0.08)', 
    borderRadius: 6, // Changed from 20 to 6 for more cornered look
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 4,
    borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.15)', flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  genreTitle: { color: COLORS.text, fontSize: 14, fontWeight: '500', textTransform: 'lowercase' },
  genreStars: { flexDirection: 'row' },
  genreStarText: { fontSize: 10, fontWeight: 'bold' },

  emptyText: { color: COLORS.text, fontSize: 14, textAlign: 'center', opacity: 0.5, fontStyle: 'italic', paddingVertical: 20, textTransform: 'lowercase' },

  // --- ACTIONS ---
  actionsContainer: { paddingHorizontal: 20, paddingTop: 20, gap: 12 },
  settingsButton: { 
    backgroundColor: COLORS.button, // Primary Red
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center', 
  },
  settingsButtonText: { color: COLORS.text, fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
  
  // UPDATED: Used COLORS.bg for 100% opacity
  modalOverlay: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  modalCenter: { justifyContent: 'center', alignItems: 'center' },
});