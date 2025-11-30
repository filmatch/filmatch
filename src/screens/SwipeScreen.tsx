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
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  getDocs 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// SERVICES
import { MatchingService } from '../services/MatchingService';
import { FirestoreService } from '../services/FirestoreService';
import { NotificationService } from '../services/NotificationService';

// --- CONFIG ---
const { width, height } = Dimensions.get("window");
const CARD_W = Math.min(width * 0.90, 400); 
const CARD_H = Math.min(height * 0.74, 680); 

// --- TYPES ---
type Poster = { id: string; title: string; poster?: string; poster_path?: string; year?: number };
type Recent = { id: string; title: string; year?: number; poster?: string; poster_path?: string }; 
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
  isHidden?: boolean; // <--- ADDED: To support hiding admins
};

// --- HELPER FOR IMAGES ---
const getImageSource = (path?: string | null) => {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('file')) {
    return { uri: path };
  }
  // It's a relative TMDb path, add the base URL
  return { uri: `https://image.tmdb.org/t/p/w342${path}` };
};

// --- UI COMPONENTS ---

const GenreText = ({ text, isLast }: { text: string, isLast: boolean }) => (
  <Text style={styles.genreTextItem}>
    {text.toLowerCase()}
    {!isLast && <Text style={styles.genreSeparator}> • </Text>}
  </Text>
);

const GhostPoster = ({ title }: { title: string }) => (
  <View style={styles.ghostPoster}>
    <View style={styles.ghostPosterInner}>
      <Text style={styles.ghostPosterText} numberOfLines={3}>
        {title.toLowerCase()}
      </Text>
    </View>
  </View>
);

const RecentPoster = ({ poster }: { poster: string }) => {
  const source = getImageSource(poster);
  return (
    <View style={styles.recentPosterContainer}>
      {source && (
        <Image 
          source={source} 
          style={styles.recentPosterImg} 
          resizeMode="cover"
        />
      )}
    </View>
  );
};

const PosterTile = ({ p }: { p: Poster }) => {
  // Check both 'poster' (full url usually) and 'poster_path' (tmdb raw)
  const source = getImageSource(p.poster || p.poster_path);
  
  return (
    <View style={styles.posterTile}>
      {source ? (
        <Image 
          source={source} 
          style={styles.posterImg} 
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.posterImg, styles.posterPlaceholder]}>
          <Text style={styles.posterPlaceholderText}>no{'\n'}img</Text>
        </View>
      )}
      <Text style={styles.posterCaption} numberOfLines={1}>
        {p.title.toLowerCase()}
      </Text>
    </View>
  );
};

// --- MAIN SCREEN ---

export default function SwipeScreen() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<MatchProfile[]>([]);
  const [idx, setIdx] = useState(0);
  const [error, setError] = useState<string>('');
  const [swiping, setSwiping] = useState(false);
  const [showMatchIndicator, setShowMatchIndicator] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const db = getFirestore();
  const auth = getAuth();
  const profile = profiles[idx];

  // Prefetch next photo
  useEffect(() => {
    const nextProfile = profiles[idx + 1];
    if (nextProfile && nextProfile.photos?.[0]) {
      Image.prefetch(nextProfile.photos[0]);
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
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setError('not logged in');
        setLoading(false);
        return;
      }

      // 1. GET CURRENT USER'S PREFERENCES
      const myProfile = await FirestoreService.getUserProfile(currentUser.uid);
      if (!myProfile) {
        setError('profile not found');
        setLoading(false);
        return;
      }

      // 2. GET POTENTIAL MATCHES
      const matches = await MatchingService.getPotentialMatches(
        currentUser.uid,
        (myProfile.gender as string) || 'Male',
        myProfile.genderPreferences || [],
        myProfile.relationshipIntent || ['friends', 'romance'],
        myProfile.city as string
      );

      // --- FILTER START ---
      // Filter out any users who have isHidden set to true (e.g. Admins)
      const visibleMatches = matches.filter((p: any) => !p.isHidden);
      // --- FILTER END ---

      if (visibleMatches.length === 0) {
        setError('no new people nearby');
      } else {
        // 3. CALCULATE REAL COMPATIBILITY & SORT
        const processedMatches = visibleMatches.map((p: any) => {
            const realScore = MatchingService.calculateCompatibility(myProfile, p);
            return {
                ...p,
                photos: p.photos || [],
                favorites: p.favorites || [],
                recentWatches: p.recentWatches || [],
                genreRatings: p.genreRatings || [],
                compatibility: realScore, 
            } as MatchProfile;
        });

        processedMatches.sort((a, b) => b.compatibility - a.compatibility);
        setProfiles(processedMatches);
      }

    } catch (err: any) {
      console.error(err);
      setError('failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (direction: 1 | -1) => {
    if (swiping || !profile) return;
    setSwiping(true);

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      if (direction === 1) {
        await addDoc(collection(db, 'swipes'), {
            fromUserId: currentUser.uid,
            toUserId: profile.uid,
            direction: 'right',
            timestamp: serverTimestamp()
        });

        const swipesRef = collection(db, 'swipes');
        const q = query(
            swipesRef, 
            where('fromUserId', '==', profile.uid),
            where('toUserId', '==', currentUser.uid),
            where('direction', '==', 'right')
        );

        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          setShowMatchIndicator(true);
          setTimeout(() => setShowMatchIndicator(false), 2000);
          
          const sortedIds = [currentUser.uid, profile.uid].sort();
          const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;

          await addDoc(collection(db, 'matches'), {
            users: [currentUser.uid, profile.uid],
            user1Id: currentUser.uid, 
            user2Id: profile.uid,     
            createdAt: serverTimestamp(),
            lastMessage: null,
            chatId: chatId
          });

          const myProfileSnap = await FirestoreService.getUserProfile(currentUser.uid);
          const myName = myProfileSnap?.displayName || "Someone";
          const myPhoto = myProfileSnap?.photos?.[0];

          await NotificationService.createMatchNotifications(
             currentUser.uid, myName, myPhoto,
             profile.uid, profile.displayName, profile.photos?.[0],
             chatId
          );
        }
      } else {
        await addDoc(collection(db, 'swipes'), {
            fromUserId: currentUser.uid,
            toUserId: profile.uid,
            direction: 'left',
            timestamp: serverTimestamp()
        });
      }
    } catch (error) { 
        console.error("Swipe Error:", error); 
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
  
  const handlePhotoTap = () => {
    if (profile?.photos && profile.photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev + 1) % profile.photos.length);
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
            swipeOut(dir);
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
          }
        },
      }),
    [profile]
  );

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

  const currentPhotoSource = getImageSource(profile.photos[currentPhotoIndex]);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {showMatchIndicator && (
        <View style={styles.matchIndicator}>
          <Text style={styles.matchIndicatorText}> it's a match!</Text>
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
                {profile.displayName.toLowerCase()}
                {profile.age ? `, ${profile.age}` : ""}
                {profile.city ? ` • ${profile.city.toLowerCase()}` : ""}
              </Text>
            </View>
            <View style={styles.compBadge}>
              <Text style={styles.compText}>{profile.compatibility}%</Text>
              <Text style={styles.compCaption}>match</Text>
            </View>
          </View>

          {/* Bio */}
          {profile.bio ? <Text style={styles.bio} numberOfLines={3}>{profile.bio.toLowerCase()}</Text> : null}

          {/* PHOTOS */}
          {profile.photos?.length > 0 && currentPhotoSource ? (
            <TouchableOpacity activeOpacity={0.95} onPress={handlePhotoTap} style={styles.photoContainer}>
              <Image 
                source={currentPhotoSource} 
                style={styles.photo} 
                resizeMode="cover"
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
              <Text style={styles.genresLine}>
                {topGenres.map((g, index) => (
                  <GenreText key={g} text={g} isLast={index === topGenres.length - 1} />
                ))}
              </Text>
            </View>
          )}

          {/* Fav Films */}
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
                contentContainerStyle={{ gap: 8 }}
              >
                {profile.recentWatches.slice(0, 6).map((r) => {
                    const imgSource = getImageSource(r.poster || r.poster_path);
                    if (imgSource) return <RecentPoster key={r.id} poster={r.poster || r.poster_path || ''} />;
                    return <GhostPoster key={r.id} title={r.title} />;
                })}
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
    padding: 16, 
  },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  name: { color: "#F0E4C1", fontSize: 20, fontWeight: "800", textTransform: "lowercase" }, 

  compBadge: { alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#511619", borderRadius: 14, minWidth: 76 },
  compText: { color: "#F0E4C1", fontSize: 24, fontWeight: "900" }, 
  compCaption: { color: "#F0E4C1", opacity: 0.85, fontSize: 10, marginTop: -2, textTransform: "lowercase" },

  bio: { color: "#F0E4C1", opacity: 0.95, marginBottom: 10, lineHeight: 18, fontSize: 14 },

  photoContainer: { marginVertical: 6, position: 'relative' },
  photo: { width: '100%', height: 250, borderRadius: 12, backgroundColor: "#0b1220" }, 
  
  photoIndicatorContainer: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(240,228,193,0.4)' },
  dotActive: { backgroundColor: '#F0E4C1', width: 20 },
  
  noPhotosPlaceholder: { width: '100%', height: 200, borderRadius: 12, backgroundColor: "rgba(240,228,193,0.08)", alignItems: "center", justifyContent: "center", marginVertical: 6 },
  noPhotosText: { color: "rgba(240,228,193,0.5)", fontSize: 14 },
  
  sectionTitle: { color: "#F0E4C1", fontSize: 12, fontWeight: "700", marginTop: 10, marginBottom: 6, textTransform: "lowercase" },
  
  posterRow: { flexDirection: "row", gap: 6 },
  posterTile: { width: 52 }, 
  posterImg: { width: 52, height: 78, borderRadius: 6, backgroundColor: "rgba(240,228,193,0.1)" }, 
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  posterPlaceholderText: { color: "rgba(240,228,193,0.5)", fontSize: 9, textAlign: "center" },
  posterCaption: { color: "#F0E4C1", fontSize: 9, marginTop: 2 },
  
  genresWrap: { flexDirection: 'row', justifyContent: 'center', marginTop: 8, marginBottom: 8 },
  genresLine: { textAlign: 'center', lineHeight: 20 },
  genreTextItem: { color: '#F0E4C1', fontWeight: '700', fontSize: 11, letterSpacing: 0.5 },
  genreSeparator: { color: 'rgba(240,228,193,0.4)', fontSize: 10 },

  ghostPoster: {
    width: 52, 
    height: 78,
    borderRadius: 6,
    backgroundColor: 'rgba(240,228,193,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.15)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostPosterInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostPosterText: {
    color: '#F0E4C1',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'lowercase',
    opacity: 0.9,
  },
  recentPosterContainer: {
    width: 52,
    height: 78,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#1a2634',
  },
  recentPosterImg: {
    width: '100%',
    height: '100%',
  },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  passBtn: { backgroundColor: "transparent", borderColor: "rgba(240,228,193,0.25)" },
  likeBtn: { backgroundColor: "#511619", borderColor: "#511619" },
  actionText: { color: "#F0E4C1", fontWeight: "800", fontSize: 16, textTransform: "lowercase" },

  matchIndicator: { position: 'absolute', top: 60, left: 20, right: 20, backgroundColor: '#511619', borderRadius: 16, padding: 16, zIndex: 1000, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(240,228,193,0.3)' },
  matchIndicatorText: { color: '#F0E4C1', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { color: '#F0E4C1', opacity: 0.7, marginTop: 12, textTransform: 'lowercase' },
  noMatchesTitle: { color: '#F0E4C1', fontSize: 22, fontWeight: 'bold', textTransform: 'lowercase', marginBottom: 10 },
  noMatchesText: { color: 'rgba(240,228,193,0.7)', textAlign: 'center', textTransform: 'lowercase', marginBottom: 18 },
  retryButton: { backgroundColor: '#511619', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  retryButtonText: { color: '#F0E4C1', fontWeight: '700', textTransform: 'lowercase' },
});