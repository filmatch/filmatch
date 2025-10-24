// src/screens/SwipeScreen.tsx
import React, { useMemo, useRef, useState } from "react";
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
} from "react-native";
import { StatusBar } from "expo-status-bar";

const { width, height } = Dimensions.get("window");
const CARD_W = Math.min(width * 0.92, 420);
const CARD_H = Math.min(height * 0.78, 720);

// ---------------- Types ----------------
type Poster = { id: string; title: string; poster?: string; year?: number };
type Recent = { id: string; title: string; year?: number };
type GenreRating = { genre: string; rating: number }; // 0–5
type MatchProfile = {
  id: string;
  displayName: string;
  age?: number;
  location?: string;     // city
  compatibility: number; // %
  bio?: string;
  photos: string[];      // image URLs
  favorites: Poster[];   // up to 4 items
  recentWatches: Recent[];
  favGenres?: string[];  // fallback
  genreRatings?: GenreRating[]; // preferred source for "fav genres"
};

// -------------- Mock data --------------
// Replace with Firestore later.
const PROFILES: MatchProfile[] = [
  {
    id: "1",
    displayName: "alex",
    age: 27,
    location: "istanbul",
    compatibility: 93,
    bio: "cinephile into long takes, synth scores, and mind-benders.",
    photos: [
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=900&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=900&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=900&auto=format&fit=crop",
    ],
    favorites: [
      { id: "br2049", title: "blade runner 2049", year: 2017, poster: "https://image.tmdb.org/t/p/w185/aMpyrCizvSg3hZqvQkWpMAHfuO9.jpg" },
      { id: "her", title: "her", year: 2013, poster: "https://image.tmdb.org/t/p/w185/eCOtqtfvn7mxGl6nfmq4b1exJRc.jpg" },
      { id: "dune2", title: "dune: part two", year: 2024, poster: "https://image.tmdb.org/t/p/w185/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg" },
      { id: "arrival", title: "arrival", year: 2016, poster: "https://image.tmdb.org/t/p/w185/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg" },
    ],
    recentWatches: [
      { id: "enemy", title: "enemy", year: 2013 },
      { id: "drive", title: "drive", year: 2011 },
    ],
    genreRatings: [
      { genre: "sci-fi", rating: 5 },
      { genre: "drama", rating: 5 },
      { genre: "thriller", rating: 4 },
      { genre: "romance", rating: 2 },
    ],
  },
  {
    id: "2",
    displayName: "mia",
    age: 25,
    location: "ankara",
    compatibility: 88,
    bio: "dialogue-driven dramas, subtle romance, and festival gems.",
    photos: [
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=900&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1554151228-14d9def656e4?q=80&w=900&auto=format&fit=crop",
    ],
    favorites: [
      { id: "moonlight", title: "moonlight", year: 2016, poster: "https://image.tmdb.org/t/p/w185/4911T5FbJ9eD2wjuKxN0VOJYhpm.jpg" },
      { id: "eeaao", title: "eeaao", year: 2022, poster: "https://image.tmdb.org/t/p/w185/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg" },
      { id: "callme", title: "call me by your name", year: 2017, poster: "https://image.tmdb.org/t/p/w185/oPqF4KJfVv9qGZo4PM5XgS5aXoa.jpg" },
      { id: "before", title: "before sunrise", year: 1995, poster: "https://image.tmdb.org/t/p/w185/bmtnxH4ihDZVx8bV2G7fX7nT2jN.jpg" },
    ],
    recentWatches: [{ id: "pastlives", title: "past lives", year: 2023 }],
    genreRatings: [
      { genre: "drama", rating: 5 },
      { genre: "romance", rating: 5 },
      { genre: "indie", rating: 4 },
      { genre: "sci-fi", rating: 1 },
    ],
  },
];

// -------------- Small UI bits --------------
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

// ------------------- Screen -------------------
export default function SwipeScreen() {
  const [idx, setIdx] = useState(0);
  const profile = PROFILES[idx];

  // derive top "fav genres" from ratings (fallback to provided list)
  const topGenres = useMemo(() => {
    if (profile.genreRatings?.length) {
      return [...profile.genreRatings]
        .filter((g) => g.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .map((g) => g.genre);
    }
    return profile.favGenres ?? [];
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
              Animated.timing(fade,  { toValue: 0,           duration: 220, useNativeDriver: true }),
            ]).start(() => nextCard());
          } else {
            Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: true }).start();
          }
        },
      }),
    []
  );

  const nextCard = () => {
    pan.setValue({ x: 0, y: 0 });
    fade.setValue(1);
    setIdx((i) => (i + 1) % PROFILES.length);
  };

  const swipeOut = (dir: 1 | -1) => {
    Animated.parallel([
      Animated.timing(pan.x, { toValue: dir * width, duration: 220, useNativeDriver: true }),
      Animated.timing(fade,  { toValue: 0,           duration: 220, useNativeDriver: true }),
    ]).start(nextCard);
  };
  const like = () => swipeOut(1);
  const pass = () => swipeOut(-1);

  const renderPhoto = ({ item }: { item: string }) => (
    <Image source={{ uri: item }} style={styles.photo} />
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
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
          {/* Header: name, age, city — BIG compatibility % */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.name}>
                {profile.displayName}
                {profile.age ? `, ${profile.age}` : ""}
                {profile.location ? ` • ${profile.location}` : ""}
              </Text>
            </View>
            <View style={styles.compBadge}>
              <Text style={styles.compText}>{profile.compatibility}%</Text>
              <Text style={styles.compCaption}>compatibility</Text>
            </View>
          </View>

          {/* Bio */}
          {profile.bio ? (
            <Text style={styles.bio} numberOfLines={3}>
              {profile.bio}
            </Text>
          ) : null}

          {/* Photos — directly under name + bio */}
          {profile.photos?.length ? (
            <>
              <FlatList
                data={profile.photos}
                keyExtractor={(u, i) => `${u}-${i}`}
                renderItem={renderPhoto}
                horizontal
                showsHorizontalScrollIndicator={false}
                pagingEnabled
                snapToAlignment="center"
                decelerationRate="fast"
                contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
              />
            </>
          ) : null}

          {/* fav films (4 posters) */}
          {profile.favorites?.length ? (
            <>
              <Text style={styles.sectionTitle}>fav 4 films</Text>
              <View style={styles.posterRow}>
                {profile.favorites.slice(0, 4).map((p) => (
                  <PosterTile key={p.id} p={p} />
                ))}
              </View>
            </>
          ) : null}

          {/* fav genres (derived from top star ratings) */}
          {topGenres.length ? (
            <>
              <Text style={styles.sectionTitle}>fav genres</Text>
              <View style={styles.genresWrap}>
                {topGenres.map((g) => (
                  <Chip key={g} text={g} />
                ))}
              </View>
            </>
          ) : null}

          {/* recents */}
          {profile.recentWatches?.length ? (
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
          ) : null}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.passBtn]} onPress={pass}>
              <Text style={styles.actionText}>pass</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.likeBtn]} onPress={like}>
              <Text style={styles.actionText}>like</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

// ------------------- styles -------------------
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#111C2A" },
  centerWrap: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    width: CARD_W,
    minHeight: CARD_H,
    backgroundColor: "rgba(240,228,193,0.07)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.18)",
    padding: 18,
  },

  headerRow: { flexDirection: "row", alignItems: "center" },
  name: { color: "#F0E4C1", fontSize: 22, fontWeight: "800", textTransform: "lowercase" },

  // bigger compatibility badge
  compBadge: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#511619",
    borderRadius: 16,
    minWidth: 86,
  },
  compText: { color: "#F0E4C1", fontSize: 28, fontWeight: "900" }, // BIGGER %
  compCaption: { color: "#F0E4C1", opacity: 0.85, fontSize: 10, marginTop: -2 },

  bio: {
    color: "#F0E4C1",
    opacity: 0.95,
    marginTop: 10,
    marginBottom: 8,
    lineHeight: 20,
  },

  sectionTitle: {
    color: "#F0E4C1",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
    textTransform: "lowercase",
  },

  // photos
  photo: {
    width: CARD_W - 36,
    height: 220,
    borderRadius: 14,
    backgroundColor: "#0b1220",
  },

  // fav films
  posterRow: { flexDirection: "row", gap: 10 },
  posterTile: { width: 72 },
  posterImg: { width: 72, height: 100, borderRadius: 8, backgroundColor: "rgba(240,228,193,0.1)" },
  posterPlaceholder: { alignItems: "center", justifyContent: "center" },
  posterPlaceholderText: { color: "rgba(240,228,193,0.5)", fontSize: 10, textAlign: "center" },
  posterCaption: { color: "#F0E4C1", fontSize: 11, marginTop: 4 },

  // fav genres
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

  // actions
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
