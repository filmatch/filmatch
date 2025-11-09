// src/screens/EditPreferencesScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import TMDbService, { Movie } from '../services/TMDbService';
import type { FavoriteMovie, RecentWatch, GenreRating } from '../types';

const C = { bg: '#111C2A', card: '#121D2B', text: '#F0E4C1', dim: 'rgba(240,228,193,0.70)', accent: '#511619' };
const { width, height } = Dimensions.get('window');

type StepKey = 'favorites' | 'recent' | 'genres';

export default function EditPreferencesScreen() {
  const navigation = useNavigation();
  const starFontFamily = Platform.select({ ios: 'System', android: 'sans-serif' });

  const steps: StepKey[] = ['favorites', 'recent', 'genres'];
  const [stepIndex, setStepIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  const [favorites, setFavorites] = useState<FavoriteMovie[]>([]);
  const [recentWatches, setRecentWatches] = useState<RecentWatch[]>([]);
  const [genreRatings, setGenreRatings] = useState<GenreRating[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searching, setSearching] = useState(false);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [movieToRate, setMovieToRate] = useState<Movie | null>(null);
  const [tempRating, setTempRating] = useState(0);

  const posterSets: Record<string, { title: string; year: string; uri: string }[]> = {
    action: [
      { title: 'mad max: fury road', year: '(2015)', uri: 'https://image.tmdb.org/t/p/w185/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg' },
      { title: 'john wick', year: '(2014)', uri: 'https://image.tmdb.org/t/p/w185/fZPSd91yGE9fCcCe6OoQr6E3Bev.jpg' },
      { title: 'mission impossible', year: '(1996)', uri: 'https://image.tmdb.org/t/p/w185/euCqAgnpOAoquNC4Cy24Nd3g8bO.jpg' },
    ],
    horror: [
      { title: 'get out', year: '(2017)', uri: 'https://image.tmdb.org/t/p/w185/1SwAVYpuLj8KsHxllTF8Dt9dSSX.jpg' },
      { title: 'hereditary', year: '(2018)', uri: 'https://image.tmdb.org/t/p/w185/sR0SpCrXKsBnV0GEiH0eIwJQ2n.jpg' },
      { title: 'the exorcist', year: '(1973)', uri: 'https://image.tmdb.org/t/p/w185/4ucLGcXVVSVnsfkGtbLY4XAius8.jpg' },
    ],
    romance: [
      { title: 'before sunrise', year: '(1995)', uri: 'https://image.tmdb.org/t/p/w185/9w4EPGu5JjLhZ4J8sKZtK4aJf2r.jpg' },
      { title: 'the notebook', year: '(2004)', uri: 'https://image.tmdb.org/t/p/w185/rNzQyW4f8B8cQeg7Dgj3n6eT5tu.jpg' },
      { title: 'her', year: '(2013)', uri: 'https://image.tmdb.org/t/p/w185/eCOtqtfvn7mxGl6nfmq4b1exl3i.jpg' },
    ],
    comedy: [
      { title: 'the grand budapest hotel', year: '(2014)', uri: 'https://image.tmdb.org/t/p/w185/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg' },
      { title: 'superbad', year: '(2007)', uri: 'https://image.tmdb.org/t/p/w185/ek8e8txUybtWQ0nlJGqOCMGdsvZ.jpg' },
      { title: 'groundhog day', year: '(1993)', uri: 'https://image.tmdb.org/t/p/w185/gCQt9ujSzcCR0js7QwNwx73PkJB.jpg' },
    ],
    thriller: [
      { title: 'se7en', year: '(1995)', uri: 'https://image.tmdb.org/t/p/w185/6yoghtyTpznpBik8EngEmJskVUO.jpg' },
      { title: 'gone girl', year: '(2014)', uri: 'https://image.tmdb.org/t/p/w185/lv5xShBIDPe7m4ufdlV0IAc7Avk.jpg' },
      { title: 'prisoners', year: '(2013)', uri: 'https://image.tmdb.org/t/p/w185/uhviyknTT5cEQXbn6vWIqfM4vGm.jpg' },
    ],
    drama: [
      { title: 'the shawshank redemption', year: '(1994)', uri: 'https://image.tmdb.org/t/p/w185/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg' },
      { title: 'parasite', year: '(2019)', uri: 'https://image.tmdb.org/t/p/w185/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg' },
      { title: 'the godfather', year: '(1972)', uri: 'https://image.tmdb.org/t/p/w185/3bhkrj58Vtu7enYsRolD1fZdja1.jpg' },
    ],
    scifi: [
      { title: 'inception', year: '(2010)', uri: 'https://image.tmdb.org/t/p/w185/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg' },
      { title: 'interstellar', year: '(2014)', uri: 'https://image.tmdb.org/t/p/w185/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg' },
      { title: 'the matrix', year: '(1999)', uri: 'https://image.tmdb.org/t/p/w185/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg' },
    ],
    fantasy: [
      { title: 'spirited away', year: '(2001)', uri: 'https://image.tmdb.org/t/p/w185/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg' },
      { title: 'pan\'s labyrinth', year: '(2006)', uri: 'https://image.tmdb.org/t/p/w185/k9gWDkzjh7ntghYs1aziKEncI5d.jpg' },
      { title: 'lord of the rings', year: '(2001)', uri: 'https://image.tmdb.org/t/p/w185/6oom5QYQ2yQTMJIbnvbkBL9cHo6.jpg' },
    ],
    animation: [
      { title: 'spider-man: into the spider-verse', year: '(2018)', uri: 'https://image.tmdb.org/t/p/w185/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg' },
      { title: 'wall-e', year: '(2008)', uri: 'https://image.tmdb.org/t/p/w185/hbhFnRzzg6ZDmm8YAmxBnQpQIPh.jpg' },
      { title: 'toy story', year: '(1995)', uri: 'https://image.tmdb.org/t/p/w185/uXDfjJbdP4ijW5hWSBrPrlKpxab.jpg' },
    ],
    documentary: [
      { title: 'free solo', year: '(2018)', uri: 'https://image.tmdb.org/t/p/w185/v4QfYZMACODlWul9doN9RxE99ag.jpg' },
      { title: 'won\'t you be my neighbor?', year: '(2018)', uri: 'https://image.tmdb.org/t/p/w185/2vM0QWhzYIfw1Uc7W0jFI3pr5WP.jpg' },
      { title: 'planet earth ii', year: '(2016)', uri: 'https://image.tmdb.org/t/p/w185/mZDAPlh4XmLhVGLAAiHNu2z9UYn.jpg' },
    ],
  };

  const genreList = [
    { key: 'action', label: 'action', required: true },
    { key: 'romance', label: 'romance', required: true },
    { key: 'comedy', label: 'comedy', required: true },
    { key: 'horror', label: 'horror', required: true },
    { key: 'drama', label: 'drama', required: false },
    { key: 'animation', label: 'animation', required: false },
    { key: 'thriller', label: 'thriller', required: false },
    { key: 'scifi', label: 'sci-fi', required: false },
    { key: 'fantasy', label: 'fantasy', required: false },
    { key: 'documentary', label: 'documentary', required: false },
  ];

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const results = await TMDbService.searchMovies(searchQuery.trim());
        setSearchResults(results.slice(0, 8));
      } catch (e) {
        console.error('search error:', e);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadUserData = async () => {
    try {
      const currentUser = FirebaseAuthService.getCurrentUser();
      if (!currentUser) return;
      const profile = await FirestoreService.getUserProfile(currentUser.uid);
      if (profile) {
        setFavorites(profile.favorites || []);
        setRecentWatches(profile.recentWatches || []);
        setGenreRatings(profile.genreRatings || []);
        setIsNewUser(!profile.hasPreferences);
      }
    } catch (error) {
      console.error('error loading user data:', error);
      Alert.alert('error', 'failed to load your preferences');
    } finally {
      setLoading(false);
    }
  };

  const mandatoryGenres = ['action', 'romance', 'comedy', 'horror'];

  const canContinueFavorites = favorites.length >= 4;
  const canContinueRecents = recentWatches.length >= 4;
  const canContinueGenres = mandatoryGenres.every((genre) =>
    genreRatings.some((rating) => rating.genre === genre && rating.rating > 0)
  );

  const saveChanges = async () => {
    if (!canContinueFavorites) {
      return Alert.alert('incomplete', `you need to add ${4 - favorites.length} more favorite(s)`);
    }
    if (!canContinueRecents) {
      return Alert.alert('incomplete', `you need to add ${4 - recentWatches.length} more recent watch(es)`);
    }
    if (!canContinueGenres) {
      return Alert.alert('incomplete', 'please rate all required genres (action, romance, comedy, horror) before saving');
    }

    try {
      setSaving(true);
      const currentUser = FirebaseAuthService.getCurrentUser();
      if (!currentUser) return;

      await FirestoreService.saveUserProfile(currentUser.uid, {
        favorites,
        recentWatches,
        genreRatings,
      });

      await FirestoreService.updateUserProfile(currentUser.uid, { hasPreferences: true });

      Alert.alert('saved', 'your preferences have been updated!', [
        { text: 'ok', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('error saving preferences:', error);
      Alert.alert('error', 'failed to save your preferences. please try again.');
    } finally {
      setSaving(false);
    }
  };

  const goNext = useCallback(() => {
    if (stepIndex === 0 && !canContinueFavorites) {
      return Alert.alert('incomplete', `you need to add ${4 - favorites.length} more favorite(s)`);
    }
    if (stepIndex === 1 && !canContinueRecents) {
      return Alert.alert('incomplete', `you need to add ${4 - recentWatches.length} more recent watch(es)`);
    }
    if (stepIndex === 2 && !canContinueGenres) {
      return Alert.alert('incomplete', 'please rate all required genres (action, romance, comedy, horror) before saving');
    }

    if (stepIndex < steps.length - 1) {
      const next = stepIndex + 1;
      setStepIndex(next);
      scrollRef.current?.scrollTo({ x: width * next, animated: true });
    } else {
      saveChanges();
    }
  }, [stepIndex, steps.length, canContinueFavorites, canContinueRecents, canContinueGenres, favorites.length, recentWatches.length]);

  const goBack = useCallback(() => {
    if (stepIndex > 0) {
      const prev = stepIndex - 1;
      setStepIndex(prev);
      scrollRef.current?.scrollTo({ x: width * prev, animated: true });
    } else {
      if (isNewUser) {
        Alert.alert('preferences required', 'you need to complete your preferences before using the app');
      } else {
        navigation.goBack();
      }
    }
  }, [stepIndex, navigation, isNewUser]);

  const addFavorite = (movie: Movie) => {
    if (favorites.length >= 4) {
      return Alert.alert('limit reached', 'you can only have 4 favorite movies');
    }
    if (favorites.some((f) => f.title === movie.title && f.year === movie.year)) {
      return Alert.alert('already added', 'this movie is already in your favorites');
    }
    setFavorites((prev) => [
      ...prev,
      { id: `fav_${movie.id}_${Date.now()}`, title: movie.title, year: movie.year },
    ]);
    setSearchQuery('');
  };

  const removeFavorite = (id: string) => setFavorites((prev) => prev.filter((f) => f.id !== id));

  const addRecentWatch = (movie: Movie) => {
    if (recentWatches.some((w) => w.title === movie.title && w.year === movie.year)) {
      return Alert.alert('already added', 'this movie is already in your recent watches');
    }
    setMovieToRate(movie);
    setTempRating(0);
    setShowRatingModal(true);
  };

  const confirmAddRecentWatch = () => {
    if (!movieToRate || tempRating === 0) {
      return Alert.alert('rating required', 'please select a rating for this movie');
    }
    setRecentWatches((prev) => [
      ...prev,
      {
        id: `recent_${movieToRate.id}_${Date.now()}`,
        title: movieToRate.title,
        year: movieToRate.year,
        rating: tempRating,
      },
    ]);
    setShowRatingModal(false);
    setMovieToRate(null);
    setTempRating(0);
    setSearchQuery('');
  };

  const removeRecentWatch = (id: string) => setRecentWatches((prev) => prev.filter((w) => w.id !== id));

  const updateRecentRating = (id: string, rating: number) =>
    setRecentWatches((prev) => prev.map((w) => (w.id === id ? { ...w, rating } : w)));

  const updateGenreRating = (genre: string, rating: number) => {
    setGenreRatings((prev) => {
      const existing = prev.find((g) => g.genre === genre);
      if (existing) {
        return prev.map((g) => (g.genre === genre ? { ...g, rating } : g));
      } else {
        return [...prev, { genre, rating }];
      }
    });
  };

  const getGenreRating = (genre: string): number => {
    return genreRatings.find((g) => g.genre === genre)?.rating || 0;
  };

  const canProceed = stepIndex === 0 ? canContinueFavorites : 
                     stepIndex === 1 ? canContinueRecents : 
                     canContinueGenres;

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <StatusBar style="light" />
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color={C.text} />
          <Text style={s.loadingText}>loading your preferences…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar style="light" />

      <View style={s.header}>
        {stepIndex > 0 ? (
          <TouchableOpacity onPress={goBack} style={s.backButton}>
            <Text style={s.backText}>← back</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
        <Text style={s.headerTitle}>edit preferences</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={s.dots}>
        {steps.map((_, i) => (
          <View key={i} style={[s.dot, i === stepIndex && s.dotActive]} />
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        {/* FAVORITES STEP */}
        <View style={s.step}>
          <Text style={s.sectionTitle}>favorite movies ({favorites.length}/4)</Text>

          <View style={s.searchContainer}>
            <TextInput
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="search for movies to add…"
              placeholderTextColor="rgba(240, 228, 193, 0.5)"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              keyboardAppearance="dark"
            />
            {searching && <ActivityIndicator style={s.searchIndicator} color={C.text} />}
          </View>

          {searchResults.length > 0 && (
            <ScrollView style={s.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.map((movie) => (
                <TouchableOpacity key={movie.id} style={s.searchResultItem} onPress={() => addFavorite(movie)}>
                  {movie.poster_path ? (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w92${movie.poster_path}` }} style={s.posterThumb} />
                  ) : (
                    <View style={[s.posterThumb, s.posterPlaceholder]}>
                      <Text style={s.posterPlaceholderText}>no{'\n'}image</Text>
                    </View>
                  )}
                  <View style={s.movieInfo}>
                    <Text style={s.movieTitle}>{movie.title}</Text>
                    <Text style={s.movieYear}>{movie.year ?? '—'}</Text>
                  </View>
                  <Text style={s.addButton}>+</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={s.currentItems}>
            {favorites.map((m) => (
              <View key={m.id} style={s.currentItem}>
                <View style={s.movieInfo}>
                  <Text style={s.currentItemTitle}>{m.title}</Text>
                  <Text style={s.currentItemYear}>({m.year ?? '—'})</Text>
                </View>
                <TouchableOpacity onPress={() => removeFavorite(m.id)}>
                  <Text style={s.removeButton}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {!canContinueFavorites && (
            <Text style={s.requirementText}>you need to add {4 - favorites.length} more favorite(s)</Text>
          )}
        </View>

        {/* RECENTS STEP */}
        <View style={s.step}>
          <Text style={s.sectionTitle}>recent watches ({recentWatches.length} added)</Text>
          <Text style={s.stepHint}>add at least 4, but feel free to add more as you watch</Text>

          <View style={s.searchContainer}>
            <TextInput
              style={s.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="search for movies to add…"
              placeholderTextColor="rgba(240, 228, 193, 0.5)"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              keyboardAppearance="dark"
            />
            {searching && <ActivityIndicator style={s.searchIndicator} color={C.text} />}
          </View>

          {searchResults.length > 0 && (
            <ScrollView style={s.searchResults} keyboardShouldPersistTaps="handled">
              {searchResults.map((movie) => (
                <TouchableOpacity key={movie.id} style={s.searchResultItem} onPress={() => addRecentWatch(movie)}>
                  {movie.poster_path ? (
                    <Image source={{ uri: `https://image.tmdb.org/t/p/w92${movie.poster_path}` }} style={s.posterThumb} />
                  ) : (
                    <View style={[s.posterThumb, s.posterPlaceholder]}>
                      <Text style={s.posterPlaceholderText}>no{'\n'}image</Text>
                    </View>
                  )}
                  <View style={s.movieInfo}>
                    <Text style={s.movieTitle}>{movie.title}</Text>
                    <Text style={s.movieYear}>{movie.year ?? '—'}</Text>
                  </View>
                  <Text style={s.addButton}>+</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <View style={s.currentItems}>
            {recentWatches.map((movie) => (
              <View key={movie.id} style={s.recentItem}>
                <View style={s.movieHeader}>
                  <View style={s.movieInfo}>
                    <Text style={s.currentItemTitle}>{movie.title}</Text>
                    <Text style={s.currentItemYear}>({movie.year ?? '—'})</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeRecentWatch(movie.id)}>
                    <Text style={s.removeButton}>×</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => updateRecentRating(movie.id, star)} style={s.starButton}>
                      <Text
                        style={[
                          s.starText,
                          { fontFamily: starFontFamily },
                          movie.rating >= star ? s.starFilled : s.starEmpty,
                        ]}
                      >
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <Text style={s.numericRating}>{movie.rating}/5</Text>
                </View>
              </View>
            ))}
          </View>

          {!canContinueRecents && (
            <Text style={s.requirementText}>you need to add {4 - recentWatches.length} more recent watch(es)</Text>
          )}
          
          <Text style={s.helpText}>the more recent watches you add, the better we can calculate compatibility</Text>
        </View>

        {/* GENRES STEP */}
        <View style={s.step}>
          <Text style={s.bigTitle}>rate these genres</Text>
          <Text style={s.subtitle}>how do you feel about these genres?</Text>

          <ScrollView style={s.genresScrollView} showsVerticalScrollIndicator={false}>
            {genreList.map((genreItem) => {
              const posters = posterSets[genreItem.key] || [];
              const rating = getGenreRating(genreItem.key);

              return (
                <View key={genreItem.key} style={s.genreCard}>
                  <View style={s.cardTitleRow}>
                    <Text style={s.cardTitle}>{genreItem.label}</Text>
                    {genreItem.required && <Text style={s.requiredBadge}>required</Text>}
                  </View>

                  <View style={s.postersRow}>
                    {posters.map((poster, idx) => (
                      <View key={idx} style={s.posterCell}>
                        <Image source={{ uri: poster.uri }} style={s.posterBig} />
                        <Text style={s.posterCaption}>{poster.title}</Text>
                        <Text style={s.posterYear}>{poster.year}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={s.cardQuestion}>how do you feel about {genreItem.label}?</Text>

                  <View style={s.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => updateGenreRating(genreItem.key, star)}
                        style={s.starButton}
                      >
                        <Text
                          style={[
                            s.genreStarText,
                            { fontFamily: starFontFamily },
                            rating >= star ? s.starFilled : s.starEmpty,
                          ]}
                        >
                          ★
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}

            {!canContinueGenres && (
              <Text style={s.requirementText}>please rate all required genres (action, romance, comedy, horror)</Text>
            )}
            
            <Text style={s.helpText}>the more genres you rate, the better we can calculate compatibility</Text>
          </ScrollView>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity 
          style={[s.nextBtn, (!canProceed || saving) && s.nextBtnDisabled]} 
          onPress={goNext}
          disabled={!canProceed || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={C.text} />
          ) : (
            <Text style={[s.nextTxt, !canProceed && s.nextTxtDisabled]}>
              {stepIndex < steps.length - 1 ? 'next' : 'finish'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showRatingModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>rate this movie</Text>
            {movieToRate && <Text style={s.modalMovieTitle}>{movieToRate.title} ({movieToRate.year ?? '—'})</Text>}

            <View style={s.modalStarsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setTempRating(star)} style={s.modalStarButton}>
                  <Text
                    style={[
                      s.modalStarText,
                      { fontFamily: starFontFamily },
                      tempRating >= star ? s.starFilled : s.starEmpty,
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={s.modalNumeric}>{tempRating}/5</Text>
            </View>

            <View style={s.modalButtons}>
              <TouchableOpacity
                style={s.modalCancelButton}
                onPress={() => {
                  setShowRatingModal(false);
                  setMovieToRate(null);
                  setTempRating(0);
                }}
              >
                <Text style={s.modalCancelText}>cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.modalConfirmButton, tempRating === 0 && s.modalConfirmButtonDisabled]}
                onPress={confirmAddRecentWatch}
                disabled={tempRating === 0}
              >
                <Text style={[s.modalConfirmText, tempRating === 0 && s.modalConfirmTextDisabled]}>add movie</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: C.text, opacity: 0.7 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240, 228, 193, 0.2)',
  },
  backButton: { padding: 4 },
  backText: { color: C.text, fontSize: 16 },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: 'bold', textTransform: 'lowercase' },

  dots: { flexDirection: 'row', justifyContent: 'center', paddingTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(240, 228, 193, 0.25)', marginHorizontal: 3 },
  dotActive: { backgroundColor: 'rgba(240, 228, 193, 0.8)' },

  step: { width, padding: 20 },

  sectionTitle: { color: C.text, fontSize: 20, fontWeight: 'bold', marginBottom: 4, textTransform: 'lowercase' },
  stepHint: { color: C.dim, fontSize: 13, marginBottom: 12, textTransform: 'lowercase' },
  subtitle: { color: C.dim, textAlign: 'center', marginTop: 6, textTransform: 'lowercase', fontSize: 14 },
  bigTitle: { color: C.text, fontSize: 26, textAlign: 'center', marginTop: 8, textTransform: 'lowercase', fontWeight: 'bold' },

  searchContainer: { marginBottom: 16, position: 'relative' },
  searchInput: {
    backgroundColor: 'rgba(240, 228, 193, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: C.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(240, 228, 193, 0.2)',
  },
  searchIndicator: { position: 'absolute', right: 16, top: 14 },

  searchResults: { maxHeight: 200, marginBottom: 20 },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(240, 228, 193, 0.05)',
    marginBottom: 8,
    borderRadius: 8,
  },
  posterThumb: { width: 35, height: 50, borderRadius: 4, marginRight: 12 },
  posterPlaceholder: { backgroundColor: 'rgba(240, 228, 193, 0.1)', alignItems: 'center', justifyContent: 'center' },
  posterPlaceholderText: { color: 'rgba(240, 228, 193, 0.5)', fontSize: 8, textAlign: 'center' },
  movieInfo: { flex: 1 },
  movieTitle: { color: C.text, fontSize: 16, fontWeight: '500' },
  movieYear: { color: C.dim, fontSize: 14 },
  addButton: { color: C.accent, fontSize: 24, fontWeight: 'bold' },

  currentItems: { gap: 8 },
  currentItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(81, 22, 25, 0.2)', padding: 12, borderRadius: 8 },
  currentItemTitle: { color: C.text, fontSize: 16, fontWeight: '500' },
  currentItemYear: { color: C.dim, fontSize: 14 },
  removeButton: { color: C.dim, fontSize: 24, fontWeight: 'bold' },

  recentItem: { backgroundColor: 'rgba(81, 22, 25, 0.2)', padding: 12, borderRadius: 8, marginBottom: 8 },
  movieHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },

  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  starButton: { padding: 2 },
  starText: { fontSize: 20, fontWeight: 'bold', marginHorizontal: 2 },
  starFilled: { color: C.accent },
  starEmpty: { color: 'rgba(240, 228, 193, 0.3)' },
  numericRating: { color: C.text, fontSize: 14, marginLeft: 8, opacity: 0.8 },

  genresScrollView: { flex: 1, marginTop: 20 },
  genreCard: { 
    backgroundColor: C.card, 
    borderRadius: 20, 
    paddingVertical: 16, 
    paddingHorizontal: 14, 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 16,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4, marginBottom: 12 },
  cardTitle: { color: C.text, textAlign: 'center', fontSize: 20, textTransform: 'lowercase', fontWeight: '700' },
  requiredBadge: { backgroundColor: C.accent, color: C.text, fontSize: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, textTransform: 'lowercase', fontWeight: '700' },
  postersRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingHorizontal: 8 },
  posterCell: { width: 70, alignItems: 'center' },
  posterBig: { width: 70, height: 105, borderRadius: 8 },
  posterCaption: { color: C.text, fontSize: 11, marginTop: 6, textAlign: 'center', textTransform: 'lowercase' },
  posterYear: { color: C.dim, fontSize: 10, marginTop: 2, textAlign: 'center' },
  cardQuestion: { color: C.dim, textAlign: 'center', marginTop: 12, marginBottom: 8, textTransform: 'lowercase' },
  genreStarText: { fontSize: 24, fontWeight: 'bold', marginHorizontal: 2 },

  requirementText: { color: C.accent, textAlign: 'center', marginTop: 16, fontSize: 14, textTransform: 'lowercase' },
  helpText: { color: C.dim, textAlign: 'center', marginTop: 12, fontSize: 13, textTransform: 'lowercase', fontStyle: 'italic' },

  footer: { padding: 16 },
  nextBtn: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: 'rgba(81, 22, 25, 0.4)' },
  nextTxt: { color: C.text, fontSize: 16, textTransform: 'lowercase', letterSpacing: 1, fontWeight: '600' },
  nextTxtDisabled: { opacity: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { backgroundColor: '#1A2B3D', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: C.text, marginBottom: 8 },
  modalMovieTitle: { color: C.dim, marginBottom: 20, textAlign: 'center' },
  modalStarsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  modalStarButton: { padding: 4 },
  modalStarText: { fontSize: 24, fontWeight: 'bold' },
  modalNumeric: { color: C.text, fontSize: 16, marginLeft: 12 },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalCancelButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(240, 228, 193, 0.3)', alignItems: 'center' },
  modalCancelText: { color: C.text, fontSize: 16 },
  modalConfirmButton: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: C.accent, alignItems: 'center' },
  modalConfirmButtonDisabled: { opacity: 0.5 },
  modalConfirmText: { color: C.text, fontSize: 16, fontWeight: '600' },
  modalConfirmTextDisabled: { opacity: 0.7 },
});