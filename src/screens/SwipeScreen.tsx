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
  Image,
  FlatList,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { MatchingService } from '../services/MatchingService';
import { SwipeService } from '../services/SwipeService';
import { NotificationService } from '../services/NotificationService';
import type { UserProfile } from '../types';

const { width, height } = Dimensions.get("window");
const CARD_W = Math.min(width * 0.92, 420);
const CARD_H = Math.min(height * 0.78, 720);

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
      <Image source={{ uri: p.poster }} style={styles.posterImg} />
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

  const profile = profiles[idx];

  useEffect(() => {
    loadMatches();
  }, []);

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

      if (!userProfile.genderPreferences || userProfile.genderPreferences.length === 0) {
        setError('no gender preferences set');
        return;
      }

      const potentialMatches = await MatchingService.getPotentialMatches(
        currentUser.uid,
        userProfile.genderPreferences,
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
            poster: (f as any).poster,
          })),
          recentWatches: (match.recentWatches || []).map(r => ({
            id: String(r.id),
            title: r.title,
            year: r.year,
          })),
          genreRatings: match.genreRatings || [],
        };
      });

      matchProfiles.sort((a, b) => b.compatibility - a.compatibility);
      setProfiles(matchProfiles);
    } catch (err) {
      console.error('error loading matches:', err);
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
      console.log('❌ No current user or profile');
      setSwiping(false);
      nextCard();
      return;
    }

    try {
      if (direction === 1) {
        // LIKE - Record and check for match
        console.log('👍 Recording like...');
        const isMatch = await SwipeService.recordLike(currentUser.uid, profile.uid);
        
        if (isMatch) {
          console.log('🎉 IT\'S A MATCH!');
          
          // Show brief visual indicator
          setShowMatchIndicator(true);
          setTimeout(() => setShowMatchIndicator(false), 2000);
          
          // Create match notifications for BOTH users
          console.log('📤 Creating match notifications...');
          try {
            const sortedIds = [currentUser.uid, profile.uid].sort();
            const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
            
            console.log('📤 Notification params:', {
              user1: currentUser.uid,
              user1Name: currentUserProfile.displayName,
              user2: profile.uid,
              user2Name: profile.displayName,
              chatId,
            });
            
            await NotificationService.createMatchNotifications(
              currentUser.uid,
              currentUserProfile.displayName || 'Someone',
              currentUserProfile.photos?.[0],
              profile.uid,
              profile.displayName,
              profile.photos?.[0],
              chatId
            );
            
            console.log('✅ Match notifications sent to both users');
          } catch (notifError) {
            console.error('❌ Error sending match notifications:', notifError);
            console.error('❌ Full error:', JSON.stringify(notifError));
          }
        } else {
          console.log('👍 Like recorded (not a match yet)');
        }
      } else {
        // PASS - Just record it
        console.log('👎 Recording pass...');
        await SwipeService.recordPass(currentUser.uid, profile.uid);
      }
    } catch (error) {
      console.error('❌ Error handling swipe:', error);
    } finally {
      setSwiping(false);
      nextCard();
    }
  };

  const nextCard = () => {
    pan.setValue({ x: 0, y: 0 });
    fade.setValue(1);
    
    if (idx + 1 >= profiles.length) {
      setIdx(0);
    } else {
      setIdx((i) => i + 1);
    }
  };

  const swipeOut = (dir: 1 | -1) => {
    Animated.parallel([
      Animated.timing(pan.x, { toValue: dir * width, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => handleSwipe(dir));
  };
  
  const like = () => !swiping && swipeOut(1);
  const pass = () => !swiping && swipeOut(-1);

  const renderPhoto = ({ item }: { item: string }) => (
    <Image source={{ uri: item }} style={styles.photo} resizeMode="cover" />
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

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.noMatchesTitle}>{error}</Text>
          {error === 'no gender preferences set' && (
            <Text style={styles.noMatchesText}>update your preferences in settings</Text>
          )}
          {error === 'no matches found' && (
            <Text style={styles.noMatchesText}>check back later for new users</Text>
          )}
          <TouchableOpacity style={styles.retryButton} onPress={loadMatches}>
            <Text style={styles.retryButtonText}>retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Text style={styles.noMatchesTitle}>no more profiles</Text>
          <Text style={styles.noMatchesText}>check back later</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      
      {/* Match Indicator */}
      {showMatchIndicator && (
        <View style={styles.matchIndicator}>
          <Text style={styles.matchIndicatorText}>🎉 it's a match!</Text>
          <Text style={styles.matchIndicatorSubtext}>check your matches tab</Text>
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
                {
                  rotate: pan.x.interpolate({
                    inputRange: [-width / 2, 0, width / 2],
                    outputRange: ["-9deg", "0deg", "9deg"],
                  }),
                },
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

          {/* Bio */}
          {profile.bio ? (
            <Text style={styles.bio} numberOfLines={3}>
              {profile.bio}
            </Text>
          ) : null}

          {/* USER PHOTOS */}
          {profile.photos?.length > 0 ? (
            <FlatList
              data={profile.photos}
              keyExtractor={(u, i) => `${u}-${i}`}
              renderItem={renderPhoto}
              horizontal
              showsHorizontalScrollIndicator={false}
              pagingEnabled
              snapToAlignment="center"
              decelerationRate="fast"
              contentContainerStyle={{ gap: 10, paddingVertical: 8 }}
            />
          ) : (
            <View style={styles.noPhotosPlaceholder}>
              <Text style={styles.noPhotosText}>no photos added</Text>
            </View>
          )}

          {/* Favorite genres */}
          {topGenres.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>favorite genres</Text>
              <View style={styles.genresWrap}>
                {topGenres.map((g) => (
                  <Chip key={g} text={g} />
                ))}
              </View>
            </>
          )}

          {/* Favorite films */}
          {profile.favorites?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>fav 4 films</Text>
              <View style={styles.posterRow}>
                {profile.favorites.slice(0, 4).map((p) => (
                  <PosterTile key={p.id} p={p} />
                ))}
              </View>
            </>
          )}

          {/* Recent watches */}
          {profile.recentWatches?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>recents</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {profile.recentWatches.map((r) => (
                  <Chip key={r.id} text={r.title.toLowerCase()} />
                ))}
              </ScrollView>
            </>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.passBtn, swiping && { opacity: 0.5 }]} 
              onPress={pass}
              disabled={swiping}
            >
              <Text style={styles.actionText}>pass</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.likeBtn, swiping && { opacity: 0.5 }]} 
              onPress={like}
              disabled={swiping}
            >
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

  matchIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#511619',
    borderRadius: 16,
    padding: 16,
    zIndex: 1000,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.3)',
  },
  matchIndicatorText: {
    color: '#F0E4C1',
    fontSize: 18,
    fontWeight: '800',
    textTransform: 'lowercase',
    marginBottom: 4,
  },
  matchIndicatorSubtext: {
    color: 'rgba(240,228,193,0.8)',
    fontSize: 14,
    textTransform: 'lowercase',
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { color: '#F0E4C1', opacity: 0.7, marginTop: 12, textTransform: 'lowercase' },
  noMatchesTitle: { color: '#F0E4C1', fontSize: 24, fontWeight: 'bold', textTransform: 'lowercase', marginBottom: 12 },
  noMatchesText: { color: 'rgba(240,228,193,0.7)', textAlign: 'center', textTransform: 'lowercase', marginBottom: 20 },

  retryButton: {
    backgroundColor: '#511619',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#F0E4C1',
    fontWeight: '700',
    textTransform: 'lowercase',
  },

  card: {
    width: CARD_W,
    minHeight: CARD_H,
    backgroundColor: "rgba(240,228,193,0.07)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.18)",
    padding: 18,
  },

  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  name: { color: "#F0E4C1", fontSize: 22, fontWeight: "800", textTransform: "lowercase" },

  compBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#511619",
    borderRadius: 16,
    minWidth: 86,
  },
  compText: { color: "#F0E4C1", fontSize: 28, fontWeight: "900" },
  compCaption: { color: "#F0E4C1", opacity: 0.85, fontSize: 10, marginTop: -2, textTransform: "lowercase" },

  bio: {
    color: "#F0E4C1",
    opacity: 0.95,
    marginBottom: 12,
    lineHeight: 20,
  },

  sectionTitle: {
    color: "#F0E4C1",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
    textTransform: "lowercase",
  },

  photo: {
    width: CARD_W - 36,
    height: 280,
    borderRadius: 14,
    backgroundColor: "#0b1220",
  },

  noPhotosPlaceholder: {
    width: CARD_W - 36,
    height: 200,
    borderRadius: 14,
    backgroundColor: "rgba(240,228,193,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  noPhotosText: {
    color: "rgba(240,228,193,0.5)",
    fontSize: 14,
    textTransform: "lowercase",
  },

  posterRow: { flexDirection: "row", gap: 8 },
  posterTile: { width: 60 },
  posterImg: { width: 60, height: 85, borderRadius: 6, backgroundColor: "rgba(240,228,193,0.1)" },
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  posterPlaceholderText: { color: "rgba(240,228,193,0.5)", fontSize: 9, textAlign: "center" },
  posterCaption: { color: "#F0E4C1", fontSize: 10, marginTop: 4 },

  genresWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(240,228,193,0.14)",
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.26)",
  },
  chipText: { color: "#F0E4C1", fontWeight: "700", fontSize: 12, textTransform: "lowercase" },

  actionsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  actionBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  passBtn: { backgroundColor: "transparent", borderColor: "rgba(240,228,193,0.25)" },
  likeBtn: { backgroundColor: "#511619", borderColor: "#511619" },
  actionText: { color: "#F0E4C1", fontWeight: "800", fontSize: 16, textTransform: "lowercase" },
});