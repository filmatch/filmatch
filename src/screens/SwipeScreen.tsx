// src/screens/SwipeScreen.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Image } from 'expo-image'; 
import { StatusBar } from "expo-status-bar";
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { MatchingService } from '../services/MatchingService';
import { SwipeService } from '../services/SwipeService';
import { NotificationService } from '../services/NotificationService';
import type { UserProfile } from '../types';

const { width, height } = Dimensions.get("window");

// --- BOYUT AYARLARI (Hafifçe Küçültüldü) ---
const CARD_W = Math.min(width * 0.90, 400); // %92 yerine %90
const CARD_H = Math.min(height * 0.74, 680); // %78 yerine %74

const BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQ';

type Poster = { id: string; title: string; poster?: string; year?: number };
type Recent = { id: string; title: string; year?: number };
type GenreRating = { genre: string; rating: number };

type MatchProfile = {
  uid: string;
  displayName: string;
  age?: number;
  city?: string;
  gender?: string;
  compatibility: number;
  bio?: string;
  photos: string[];
  favorites: Poster[];
  recentWatches: Recent[];
  genreRatings?: GenreRating[];
};

const Chip = ({ text }: { text: string }) => (
  <View style={styles.chip}>
    <Text style={styles.chipText}>{text}</Text>
  </View>
);

const PosterTile = ({ p }: { p: Poster }) => (
  <View style={styles.posterTile}>
    {p.poster ? (
      <Image 
        source={{ uri: p.poster }} 
        style={styles.posterImg} 
        placeholder={BLURHASH}
        contentFit="cover"
        transition={200}
      />
    ) : (
      <View style={[styles.posterImg, styles.posterPlaceholder]}>
        <Text style={styles.posterPlaceholderText}>no{'\n'}image</Text>
      </View>
    )}
    <Text style={styles.posterCaption} numberOfLines={1}>
      {p.title}
    </Text>
  </View>
);

export default function SwipeScreen() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<MatchProfile[]>([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string>('');
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [swiping, setSwiping] = useState(false);
  const [showMatchIndicator, setShowMatchIndicator] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const profile = profiles[idx];

  useEffect(() => {
    if (profiles[idx + 1]?.photos?.[0]) {
      Image.prefetch(profiles[idx + 1].photos[0]);
    }
  }, [idx, profiles]);

  useEffect(() => {
    loadMatches();
  }, []);

  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [idx]);

  const loadMatches = async () => {
    try {
      setLoading(true);
      setError('');
      
      const currentUser = FirebaseAuthService.getCurrentUser();
      if (!currentUser) {
        setError('not logged in');
        return;
      }

      const userProfile = await FirestoreService.getUserProfile(currentUser.uid);
      if (!userProfile) {
        setError('profile not found');
        return;
      }
      setCurrentUserProfile(userProfile);

      const potentialMatches = await MatchingService.getPotentialMatches(
        currentUser.uid,
        userProfile.gender || 'other',
        userProfile.genderPreferences || [],
        userProfile.city, 
        20
      );

      if (potentialMatches.length === 0) {
        setError('no matches found');
        return;
      }

      const matchProfiles: MatchProfile[] = potentialMatches.map(match => {
        const compatibility = MatchingService.calculateCompatibility(userProfile, match);
        
        return {
          uid: match.uid,
          displayName: match.displayName || 'anonymous',
          age: match.age,
          city: match.city,
          gender: match.gender,
          compatibility,
          bio: match.bio,
          photos: match.photos || [],
          favorites: (match.favorites || []).map(f => ({
            id: String(f.id),
            title: f.title,
            year: f.year,
            poster: f.poster
          })),
          recentWatches: (match.recentWatches || []).map(r => ({
            id: String(r.id),
            title: r.title,
            year: r.year
          })),
          genreRatings: match.genreRatings || [],
        };
      });

      matchProfiles.sort((a, b) => b.compatibility - a.compatibility);
      setProfiles(matchProfiles);

    } catch (err: any) {
      console.error('SwipeScreen Error:', err);
      setError('failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const topGenres = useMemo(() => {
    if (profile?.genreRatings?.length) {
      return [...profile.genreRatings]
        .filter((g) => g.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .map((g) => g.genre);
    }
    return [];
  }, [profile]);

  const pan = useRef(new Animated.ValueXY()).current;
  const fade = useRef(new Animated.Value(1)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_e, gesture) => {
          const threshold = width * 0.28;
          if (Math.abs(gesture.dx) > threshold) {
            const dir = gesture.dx > 0 ? 1 : -1;
            Animated.parallel([
              Animated.timing(pan.x, { toValue: dir * width, duration: 220, useNativeDriver: true }),
              Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
            ]).start(() => handleSwipe(dir));
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
          }
        },
      }),
    [profile]
  );

  const handleSwipe = async (direction: 1 | -1) => {
    if (swiping || !profile) return;
    setSwiping(true);

    const currentUser = FirebaseAuthService.getCurrentUser();
    if (!currentUser || !currentUserProfile) {
      setSwiping(false);
      nextCard();
      return;
    }

    try {
      if (direction === 1) {
        const isMatch = await SwipeService.recordLike(currentUser.uid, profile.uid);
        if (isMatch) {
          setShowMatchIndicator(true);
          setTimeout(() => setShowMatchIndicator(false), 2000);
          
          const sortedIds = [currentUser.uid, profile.uid].sort();
          const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
          await NotificationService.createMatchNotifications(
            currentUser.uid,
            currentUserProfile.displayName || 'Someone',
            currentUserProfile.photos?.[0],
            profile.uid,
            profile.displayName,
            profile.photos?.[0],
            chatId
          );
        }
      } else {
        await SwipeService.recordPass(currentUser.uid, profile.uid);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setSwiping(false);
      nextCard();
    }
  };

  const nextCard = () => {
    pan.setValue({ x: 0, y: 0 });
    fade.setValue(1);
    setIdx((i) => i + 1);
  };

  const swipeOut = (dir: 1 | -1) => {
    Animated.parallel([
      Animated.timing(pan.x, { toValue: dir * width, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => handleSwipe(dir));
  };
  
  const like = () => !swiping && swipeOut(1);
  const pass = () => !swiping && swipeOut(-1);

  const handlePhotoTap = () => {
    if (profile?.photos && profile.photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev + 1) % profile.photos.length);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F0E4C1" />
          <Text style={styles.loadingText}>finding your matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.noMatchesTitle}>{error || 'no more profiles'}</Text>
          <Text style={styles.noMatchesText}>check back later</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadMatches}>
            <Text style={styles.retryButtonText}>retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {showMatchIndicator && (
        <View style={styles.matchIndicator}>
          <Text style={styles.matchIndicatorText}>🎉 it's a match!</Text>
        </View>
      )}

      <View style={styles.centerWrap}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { rotate: pan.x.interpolate({ inputRange: [-width/2, 0, width/2], outputRange: ["-9deg", "0deg", "9deg"] }) },
              ],
              opacity: fade,
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.name}>
                {profile.displayName}
                {profile.age ? `, ${profile.age}` : ""}
                {profile.city ? ` • ${profile.city}` : ""}
              </Text>
            </View>
            <View style={styles.compBadge}>
              <Text style={styles.compText}>{profile.compatibility}%</Text>
              <Text style={styles.compCaption}>match</Text>
            </View>
          </View>

          {/* Bio - Font ve boşluklar ayarlandı */}
          {profile.bio ? <Text style={styles.bio} numberOfLines={3}>{profile.bio}</Text> : null}

          {/* PHOTOS - Yükseklik biraz kısıldı (250px) */}
          {profile.photos?.length > 0 ? (
            <TouchableOpacity activeOpacity={0.95} onPress={handlePhotoTap} style={styles.photoContainer}>
              <Image 
                source={{ uri: profile.photos[currentPhotoIndex] }} 
                style={styles.photo} 
                contentFit="cover"
                transition={300}
                placeholder={BLURHASH}
              />
              {profile.photos.length > 1 && (
                <View style={styles.photoIndicatorContainer}>
                  {profile.photos.map((_, i) => (
                    <View key={i} style={[styles.dot, i === currentPhotoIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.noPhotosPlaceholder}>
              <Text style={styles.noPhotosText}>no photos</Text>
            </View>
          )}

          {/* Genres */}
          {topGenres.length > 0 && (
            <View style={styles.genresWrap}>
              {topGenres.map((g) => <Chip key={g} text={g} />)}
            </View>
          )}

          {/* Fav Films - Boyutlar dengelendi */}
          {profile.favorites?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>fav films</Text>
              <View style={styles.posterRow}>
                {profile.favorites.slice(0, 4).map((p) => <PosterTile key={p.id} p={p} />)}
              </View>
            </>
          )}

          {/* Recent Watches */}
          {profile.recentWatches?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>recents</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 6 }}
              >
                {profile.recentWatches.map((r) => (
                  <Chip key={r.id} text={r.title.toLowerCase()} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={() => swipeOut(-1)}>
              <Text style={styles.actionText}>pass</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={() => swipeOut(1)}>
              <Text style={styles.actionText}>like</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111C2A" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: { 
    width: CARD_W, 
    minHeight: CARD_H, 
    backgroundColor: "rgba(240,228,193,0.07)", 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: "rgba(240,228,193,0.18)", 
    padding: 16, // 18'den 16'ya
  },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  name: { color: "#F0E4C1", fontSize: 20, fontWeight: "800", textTransform: "lowercase" }, // 22'den 20'ye

  compBadge: { alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#511619", borderRadius: 14, minWidth: 76 },
  compText: { color: "#F0E4C1", fontSize: 24, fontWeight: "900" }, // 28'den 24'e
  compCaption: { color: "#F0E4C1", opacity: 0.85, fontSize: 10, marginTop: -2, textTransform: "lowercase" },

  bio: { color: "#F0E4C1", opacity: 0.95, marginBottom: 10, lineHeight: 18, fontSize: 14 },

  // --- FOTOĞRAF (Kıvamında Küçültüldü) ---
  photoContainer: { marginVertical: 6, position: 'relative' },
  photo: { width: '100%', height: 250, borderRadius: 12, backgroundColor: "#0b1220" }, // 280 -> 250
  
  photoIndicatorContainer: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(240,228,193,0.4)' },
  dotActive: { backgroundColor: '#F0E4C1', width: 20 },
  
  noPhotosPlaceholder: { width: '100%', height: 200, borderRadius: 12, backgroundColor: "rgba(240,228,193,0.08)", alignItems: "center", justifyContent: "center", marginVertical: 6 },
  noPhotosText: { color: "rgba(240,228,193,0.5)", fontSize: 14 },
  
  sectionTitle: { color: "#F0E4C1", fontSize: 12, fontWeight: "700", marginTop: 10, marginBottom: 6, textTransform: "lowercase" },
  
  // --- POSTERLER (Dengeli Küçültme) ---
  posterRow: { flexDirection: "row", gap: 6 },
  posterTile: { width: 52 }, // 60 -> 52
  posterImg: { width: 52, height: 78, borderRadius: 6, backgroundColor: "rgba(240,228,193,0.1)" }, // Oran korundu
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  posterPlaceholderText: { color: "rgba(240,228,193,0.5)", fontSize: 9, textAlign: "center" },
  posterCaption: { color: "#F0E4C1", fontSize: 9, marginTop: 2 },
  
  genresWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, marginBottom: 4 },
  chip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: "rgba(240,228,193,0.14)", borderWidth: 1, borderColor: "rgba(240,228,193,0.26)" },
  chipText: { color: "#F0E4C1", fontWeight: "700", fontSize: 11, textTransform: "lowercase" },
  
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  passBtn: { backgroundColor: "transparent", borderColor: "rgba(240,228,193,0.25)" },
  likeBtn: { backgroundColor: "#511619", borderColor: "#511619" },
  actionText: { color: "#F0E4C1", fontWeight: "800", fontSize: 16, textTransform: "lowercase" },

  matchIndicator: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: '#511619', borderRadius: 16, padding: 16, zIndex: 1000, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(240,228,193,0.3)' },
  matchIndicatorText: { color: '#F0E4C1', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  matchIndicatorSubtext: { color: 'rgba(240,228,193,0.8)', fontSize: 14 },
  
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { color: '#F0E4C1', opacity: 0.7, marginTop: 12, textTransform: 'lowercase' },
  noMatchesTitle: { color: '#F0E4C1', fontSize: 22, fontWeight: 'bold', textTransform: 'lowercase', marginBottom: 10 },
  noMatchesText: { color: 'rgba(240,228,193,0.7)', textAlign: 'center', textTransform: 'lowercase', marginBottom: 18 },
  retryButton: { backgroundColor: '#511619', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  retryButtonText: { color: '#F0E4C1', fontWeight: '700', textTransform: 'lowercase' },
  tapHint: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(17,28,42,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(240,228,193,0.3)' },
  tapHintText: { color: '#F0E4C1', fontSize: 10, fontWeight: '600', textTransform: 'lowercase' },
});