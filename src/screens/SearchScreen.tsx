import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import TMDbService, { Movie } from '../services/TMDbService';
import debounce from 'lodash.debounce';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const CARD_W = width * 0.28;

/*** minimal inline icons ***/
const Magnifier = ({ color = '#F0E4C1' }: { color?: string }) => (
  <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: color }} />
    <View
      style={{
        position: 'absolute',
        width: 8,
        height: 2,
        backgroundColor: color,
        borderRadius: 1,
        transform: [{ rotate: '45deg' }],
        right: 0,
        bottom: 2,
      }}
    />
  </View>
);

const PosterPlaceholder = () => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <View
      style={{
        width: 28,
        height: 18,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: 'rgba(240,228,193,0.35)',
      }}
    />
  </View>
);

const CrossIcon = ({ color = 'rgba(240, 228, 193, 0.6)' }: { color?: string }) => (
  <View style={{ width: 14, height: 14 }}>
    <View
      style={{
        position: 'absolute',
        left: 1, right: 1, top: 6,
        height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '45deg' }],
      }}
    />
    <View
      style={{
        position: 'absolute',
        left: 1, right: 1, top: 6,
        height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '-45deg' }],
      }}
    />
  </View>
);

const Dot = ({ color = 'rgba(240, 228, 193, 0.8)' }: { color?: string }) => (
  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 4 }} />
);

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const auth = getAuth();
  const currentUser = auth.currentUser;

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [topRatedMovies, setTopRatedMovies] = useState<Movie[]>([]);
  
  // Store user ratings in a Map for O(1) lookup: { [movieId]: rating }
  const [userRatingsMap, setUserRatingsMap] = useState<Record<string, number>>({});

  const [searchLoading, setSearchLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isSearchMode = query.trim().length >= 1;

  // --- 1. THE "DECODER" LISTENER ---
  // This logic is specifically built to read 'EditPreferencesScreen' data formats
  useEffect(() => {
    if (!currentUser) return;

    const updateMap = (incoming: Record<string, number>) => {
      setUserRatingsMap(prev => ({ ...prev, ...incoming }));
    };

    // A. LISTENER FOR NORMAL RATINGS (from MovieDetail screen)
    // These are saved in users/{uid}/movies/{movieId}
    const subUnsubscribe = onSnapshot(
      collection(db, 'users', currentUser.uid, 'movies'),
      (snapshot) => {
        const batch: Record<string, number> = {};
        snapshot.forEach((doc) => {
          const data = doc.data();
          const rating = Number(data.rating || data.score || 0);
          if (rating > 0) {
            batch[doc.id] = rating; // The doc ID is the movie ID here
          }
        });
        updateMap(batch);
      },
      (err) => console.log("Subcollection Error", err)
    );

    // B. LISTENER FOR PROFILE SETUP RATINGS (from EditPreferences screen)
    // These are saved in users/{uid} inside the 'recentWatches' array
    const mainDocUnsubscribe = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const batch: Record<string, number> = {};

          // 1. Handle 'recentWatches' (The specific array from EditPreferences)
          if (Array.isArray(data.recentWatches)) {
            data.recentWatches.forEach((item: any) => {
              const rating = Number(item.rating || 0);
              if (rating > 0 && item.id && typeof item.id === 'string') {
                // THE FIX: Extract ID from "recent_12345_9999" string
                if (item.id.startsWith('recent_')) {
                  const parts = item.id.split('_');
                  if (parts.length >= 2) {
                    const realMovieId = parts[1]; // This is "12345"
                    batch[realMovieId] = rating;
                  }
                } else {
                  // Fallback if ID format changes later
                  batch[item.id] = rating;
                }
              }
            });
          }

          // 2. Handle generic 'movies' or 'ratings' maps if they exist
          ['ratings', 'movies', 'watched'].forEach(field => {
            const map = data[field];
            if (map && typeof map === 'object' && !Array.isArray(map)) {
              Object.keys(map).forEach(key => {
                const r = Number(map[key]);
                if (r > 0) batch[key] = r;
              });
            }
          });

          updateMap(batch);
        }
      },
      (err) => console.log("Main Doc Error", err)
    );

    return () => {
      subUnsubscribe();
      mainDocUnsubscribe();
    };
  }, [currentUser]);

  // --- 2. LOAD DISCOVER DATA ---
  const loadDiscover = async () => {
    try {
      const [trending, topRated] = await Promise.all([
        TMDbService.getTrendingMovies('week'),
        TMDbService.getTopRatedMovies(),
      ]);
      
      setTrendingMovies((trending ?? []).slice(0, 20));
      setTopRatedMovies((topRated ?? []).slice(0, 18)); // 18 items for 6 clean rows
    } catch {
      Alert.alert('error', 'failed to load movies.');
    } finally {
      setDiscoverLoading(false);
    }
  };

  useEffect(() => {
    loadDiscover();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiscover();
    setRefreshing(false);
  };

  // --- 3. DEBOUNCED SEARCH ---
  const debouncedSearchRef = useRef(
    debounce(async (q: string) => {
      if (!q.trim() || q.trim().length < 1) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }
      try {
        const res = await TMDbService.searchMovies(q);
        setSearchResults(res ?? []);
      } catch {
        Alert.alert('error', 'search failed.');
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 600)
  ).current;

  useEffect(() => {
    return () => {
      debouncedSearchRef.cancel?.();
    };
  }, []);

  const handleSearchChange = (t: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQuery(t);
    if (t.trim().length >= 1) {
      setSearchLoading(true);
      debouncedSearchRef(t);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  };

  const clearSearch = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQuery('');
    setSearchResults([]);
    setSearchLoading(false);
    Keyboard.dismiss();
  }, []);

  const openMovie = useCallback((m: Movie) => {
    Keyboard.dismiss();
    navigation.navigate('MovieDetail', { movie: m });
  }, [navigation]);

  // --- RENDER HELPERS ---
  const getRating = (id: number | undefined) => {
    if (!id) return undefined;
    return userRatingsMap[id.toString()];
  };

  const renderDiscoverCard = useCallback(({ item }: { item: Movie }) => {
    if (item.id && item.id.toString().startsWith('placeholder')) {
      return <View style={{ width: CARD_W }} />;
    }
    
    const userRating = getRating(item.id);

    return (
      <TouchableOpacity style={styles.discoverCard} onPress={() => openMovie(item)}>
        {item.poster_path ? (
          <Image
            source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
            style={styles.cardPoster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterFallback}>
            <PosterPlaceholder />
          </View>
        )}
        {userRating !== undefined && userRating > 0 && (
          <View style={styles.ratedBadge}>
            <Text style={styles.ratedBadgeText}>★ {userRating}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardYear}>
            {item.year || (item.release_date ? new Date(item.release_date).getFullYear() : '')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [openMovie, userRatingsMap]);

  const renderSearchCard = useCallback(({ item }: { item: Movie }) => {
    if (item.id && item.id.toString().startsWith('placeholder')) {
      return <View style={{ width: CARD_W }} />;
    }

    const userRating = getRating(item.id);

    return (
      <TouchableOpacity style={styles.searchCard} onPress={() => openMovie(item)}>
        {item.poster_path ? (
          <Image
            source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
            style={styles.searchCardPoster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.searchPosterFallback}>
            <PosterPlaceholder />
          </View>
        )}
        {userRating !== undefined && userRating > 0 && (
          <View style={styles.ratedBadge}>
            <Text style={styles.ratedBadgeText}>★ {userRating}</Text>
          </View>
        )}
        <View style={styles.searchCardInfo}>
          <Text style={styles.searchCardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.searchCardYear}>
            {item.year || (item.release_date ? new Date(item.release_date).getFullYear() : 'N/A')}
          </Text>
          <View style={[styles.ratingContainer, { flexDirection: 'row', alignItems: 'center' }]}>
            <Dot />
            <Text style={styles.searchCardRating}>
              {item.vote_average ? item.vote_average?.toFixed(1) : 'N/A'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [openMovie, userRatingsMap]);

  const renderTrendingCard = useCallback(({ item }: { item: Movie }) => {
    const userRating = getRating(item.id);

    return (
      <TouchableOpacity style={styles.trendingCard} onPress={() => openMovie(item)}>
        {item.poster_path ? (
          <Image
            source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
            style={styles.trendingPoster}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.trendingPosterFallback}>
            <PosterPlaceholder />
          </View>
        )}
        {userRating !== undefined && userRating > 0 && (
          <View style={styles.trendingRatedBadge}>
            <Text style={styles.ratedBadgeText}>★ {userRating}</Text>
          </View>
        )}
        <Text style={styles.trendingTitle} numberOfLines={2}>{item.title}</Text>
      </TouchableOpacity>
    );
  }, [openMovie, userRatingsMap]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* PERSISTENT HEADER AREA */}
      <View style={styles.persistentHeader}>
        {!isSearchMode && (
          <View style={styles.headerTitleArea}>
            <Text style={styles.heading}>discover movies</Text>
            <Text style={styles.subheading}>find your next favorite film</Text>
          </View>
        )}

        <View style={[styles.searchContainer, isSearchMode && styles.searchContainerCompact]}>
          <View style={styles.searchInputWrapper}>
            <TextInput
              value={query}
              onChangeText={handleSearchChange}
              placeholder="search for movies..."
              placeholderTextColor="rgba(240, 228, 193, 0.5)"
              style={styles.unifiedSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              blurOnSubmit={false}
            />
            <View style={styles.searchIconAbs}>
               {query.length > 0 ? (
                  <TouchableOpacity onPress={clearSearch} style={styles.clearHitSlop}>
                    <CrossIcon />
                  </TouchableOpacity>
               ) : (
                  <Magnifier color="rgba(240,228,193,0.7)" />
               )}
            </View>
          </View>
          
          {searchLoading && isSearchMode && (
            <ActivityIndicator size="small" color="#F0E4C1" style={styles.searchIndicator} />
          )}
        </View>
      </View>

      {/* CONTENT AREA */}
      <View style={styles.contentArea}>
        {isSearchMode ? (
          // --- SEARCH RESULTS ---
          searchResults.length > 0 ? (
            <>
              <Text style={styles.resultsCount}>
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
              </Text>
              <FlatList
                data={searchResults}
                keyExtractor={(i) => `search-${i.id}`}
                renderItem={renderSearchCard}
                numColumns={3}
                columnWrapperStyle={styles.searchRow}
                contentContainerStyle={styles.searchResults}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                extraData={userRatingsMap}
              />
            </>
          ) : (
            !searchLoading && (
              <View style={styles.noResultsContainer}>
                <Magnifier color="rgba(240,228,193,0.7)" />
                <Text style={styles.noResultsText}>no movies found</Text>
                <Text style={styles.noResultsSubtext}>try a different search term</Text>
              </View>
            )
          )
        ) : (
          // --- DISCOVER CONTENT ---
          <FlatList
            data={topRatedMovies}
            keyExtractor={(i) => `toprated-${i.id}`}
            numColumns={3}
            renderItem={renderDiscoverCard}
            columnWrapperStyle={styles.discoverRow}
            extraData={userRatingsMap}
            ListHeaderComponent={
              <View>
                {/* Trending Section */}
                {discoverLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F0E4C1" />
                  </View>
                ) : (
                  <View style={styles.trendingSection}>
                    <Text style={styles.sectionTitle}>trending this week</Text>
                    <FlatList
                      data={trendingMovies}
                      horizontal
                      keyExtractor={(i) => `trending-${i.id}`}
                      renderItem={renderTrendingCard}
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.trendingList}
                      extraData={userRatingsMap}
                    />
                  </View>
                )}

                <Text style={[styles.sectionTitle, styles.popularTitle]}>all-time popular movies</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#F0E4C1"
                colors={['#F0E4C1']}
              />
            }
            contentContainerStyle={styles.discoverContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111C2A',
  },
  persistentHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#111C2A',
    zIndex: 10,
  },
  headerTitleArea: {
    marginBottom: 20,
    marginTop: 10,
  },
  heading: {
    color: '#F0E4C1',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subheading: {
    color: 'rgba(240, 228, 193, 0.6)',
    fontSize: 16,
    marginTop: 4,
  },
  
  searchContainer: {
    marginBottom: 20,
  },
  searchContainerCompact: {
    marginTop: 10,
    marginBottom: 10,
  },
  searchInputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  unifiedSearchInput: {
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    color: '#F0E4C1',
    fontSize: 16,
  },
  searchIconAbs: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearHitSlop: {
    padding: 4,
  },
  searchIndicator: {
    position: 'absolute',
    right: 0,
    top: -25,
  },

  contentArea: {
    flex: 1,
  },

  resultsCount: {
    color: 'rgba(240, 228, 193, 0.7)',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  trendingSection: {
    marginBottom: 24,
    marginTop: 10,
  },
  sectionTitle: {
    color: '#F0E4C1',
    fontSize: 20,
    fontWeight: '600',
    paddingHorizontal: 20,
    marginBottom: 12,
    textTransform: 'lowercase',
  },
  popularTitle: {
    marginTop: 8,
  },
  trendingList: {
    paddingLeft: 20,
  },

  trendingCard: {
    width: 120,
    marginRight: 12,
    position: 'relative',
  },
  trendingPoster: {
    width: 120,
    height: 180,
    borderRadius: 12,
  },
  trendingPosterFallback: {
    width: 120,
    height: 180,
    borderRadius: 12,
    backgroundColor: 'rgba(240,228,193,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingTitle: {
    color: '#F0E4C1',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  trendingRatedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(81, 22, 25, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240, 228, 193, 0.3)',
  },

  discoverRow: {
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
  },
  discoverCard: {
    width: CARD_W,
    marginBottom: 20,
    backgroundColor: 'rgba(240,228,193,0.06)',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  cardPoster: {
    width: '100%',
    height: CARD_W * 1.4,
  },
  cardInfo: {
    padding: 8,
  },
  cardTitle: {
    color: '#F0E4C1',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  cardYear: {
    color: 'rgba(240, 228, 193, 0.6)',
    fontSize: 10,
    marginTop: 2,
  },

  ratedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(81, 22, 25, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(240, 228, 193, 0.3)',
    zIndex: 1,
  },
  ratedBadgeText: {
    color: '#F0E4C1',
    fontSize: 10,
    fontWeight: '600',
  },

  searchRow: {
    justifyContent: 'space-evenly',
    paddingHorizontal: 16,
  },
  searchResults: {
    paddingBottom: 24,
  },
  searchCard: {
    width: CARD_W,
    marginBottom: 16,
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  searchCardPoster: {
    width: '100%',
    height: CARD_W * 1.4,
  },
  searchCardInfo: {
    padding: 8,
  },
  searchCardTitle: {
    color: '#F0E4C1',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  searchCardYear: {
    color: 'rgba(240, 228, 193, 0.6)',
    fontSize: 10,
    marginTop: 2,
  },
  ratingContainer: {
    marginTop: 4,
  },
  searchCardRating: {
    color: 'rgba(240, 228, 193, 0.8)',
    fontSize: 10,
    fontWeight: '500',
  },

  posterFallback: {
    width: '100%',
    height: CARD_W * 1.4,
    backgroundColor: 'rgba(240,228,193,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchPosterFallback: {
    width: '100%',
    height: CARD_W * 1.4,
    backgroundColor: 'rgba(240,228,193,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: 'rgba(240, 228, 193, 0.7)',
    marginTop: 12,
    fontSize: 16,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  noResultsText: {
    color: '#F0E4C1',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  noResultsSubtext: {
    color: 'rgba(240, 228, 193, 0.6)',
    fontSize: 14,
    textAlign: 'center',
  },

  discoverContent: {
    paddingBottom: 32,
  },
});