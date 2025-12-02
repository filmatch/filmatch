// src/screens/SearchScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image'; 
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase'; 
import TMDbService, { Movie } from '../services/TMDbService';
import debounce from 'lodash.debounce';

const { width } = Dimensions.get('window');

// --- GRID SETTINGS ---
const GAP = 12;
const PADDING = 16;
const GRID_CARD_W = (width - (PADDING * 2) - (GAP * 2)) / 3; 
const HORIZONTAL_CARD_W = (width - PADDING) / 3.5; 

const BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQ';

// --- ICONS ---
const Magnifier = ({ color = '#F0E4C1' }: { color?: string }) => (
  <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: color }} />
    <View style={{ position: 'absolute', width: 8, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '45deg' }], right: 0, bottom: 2 }} />
  </View>
);

const CrossIcon = ({ color = 'rgba(240, 228, 193, 0.6)' }: { color?: string }) => (
  <View style={{ width: 14, height: 14 }}>
    <View style={{ position: 'absolute', left: 1, right: 1, top: 6, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '45deg' }] }} />
    <View style={{ position: 'absolute', left: 1, right: 1, top: 6, height: 2, backgroundColor: color, borderRadius: 1, transform: [{ rotate: '-45deg' }] }} />
  </View>
);

const shuffleArray = (array: Movie[]) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  // Fix: Renamed state to 'searchQuery' to avoid conflict with Firestore 'query' function
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data States
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [nowPlayingMovies, setNowPlayingMovies] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);

  // UI States
  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Triggers re-render for FlatLists
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const lastQueryRef = useRef('');

  useEffect(() => {
    loadDiscover();
  }, []);

  // --- CRITICAL: REFRESH DATA & SYNC FIRESTORE ON FOCUS ---
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 Screen focused - syncing and refreshing ratings');
      syncFirestoreRatings().then(() => {
        refreshLocalRatings();
      });
    }, [])
  );

  const syncFirestoreRatings = async () => {
    const auth = getAuth();
    if (!auth.currentUser) return;
    
    try {
      // 1. Fetch ratings from Firestore that might be missing locally
      // Note: We use the imported 'query' function here
      const q = query(collection(db, 'users', auth.currentUser.uid, 'movies'), where('rating', '>', 0));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const remoteRatings: Record<number, number> = {};
        
        snapshot.forEach((doc) => {
          const data = doc.data() as any; 
          
          // ROBUSTNESS FIX: Try data.movieId first, fall back to doc.id (the key)
          const rawId = data.movieId ?? doc.id;
          const numericId = Number(rawId);

          if (!isNaN(numericId) && data.rating) {
            remoteRatings[numericId] = data.rating;
          }
        });
        
        console.log(`☁️ Synced IDs from Firestore:`, Object.keys(remoteRatings));

        // 2. Bulk save to AsyncStorage
        await TMDbService.bulkSaveRatings(remoteRatings);
      } else {
        console.log('☁️ No ratings found in Firestore to sync.');
      }
    } catch (e) {
      console.error('❌ Error syncing Firestore ratings:', e);
    }
  };

  const refreshLocalRatings = async () => {
    try {
      // 1. Fetch latest ratings
      const ratedMap = await TMDbService.getRatedMovies();
      const ratedIds = new Set(Object.keys(ratedMap));

      console.log(`📊 Local Storage has ${ratedIds.size} rated movies`);

      // 3. Helper to update a list strictly
      const updateList = (list: Movie[]) => {
        return list.map(m => {
          const id = m.id;
          const tmdbId = m.tmdb_id;
          
          // Check both ID locations
          const isRated = ratedIds.has(String(id)) || (tmdbId ? ratedIds.has(String(tmdbId)) : false);
          
          // Get the rating using the ID that matched
          const ratingKey = ratedIds.has(String(id)) ? id : tmdbId;
          const userRating = isRated ? ratedMap[ratingKey!] : undefined;
          
          return { 
            ...m, 
            isRated, 
            userRating: userRating 
          };
        });
      };

      // 4. Update all lists
      setSearchResults(prev => updateList(prev));
      setNowPlayingMovies(prev => updateList(prev));
      setTrendingMovies(prev => updateList(prev));
      setPopularMovies(prev => updateList(prev));
      
      setLastRefresh(Date.now());
      
    } catch (e) {
      console.error('❌ Failed to refresh local ratings', e);
    }
  };

  const loadDiscover = async () => {
    try {
      const [nowPlaying, trending, page1, page2, page3] = await Promise.all([
        TMDbService.getNowPlayingMovies(),
        TMDbService.getTrendingMovies('week'),
        TMDbService.getTopRatedMovies(1),
        TMDbService.getTopRatedMovies(2),
        TMDbService.getTopRatedMovies(3),
      ]);

      const allTopRated = [...(page1||[]), ...(page2||[]), ...(page3||[])];
      const shuffledTopRated = shuffleArray(allTopRated);

      setNowPlayingMovies((nowPlaying ?? []).slice(0, 15));
      setTrendingMovies((trending ?? []).slice(0, 15));
      setPopularMovies(shuffledTopRated.slice(0, 21)); 
      
      setTimeout(refreshLocalRatings, 100);
      
    } catch (error) {
      console.error(error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiscover();
    await syncFirestoreRatings(); 
    await refreshLocalRatings();
    setRefreshing(false);
  };

  const performSearch = async (q: string) => {
    if (!q.trim() || q.trim().length < 1) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    
    try {
      setSearchLoading(true);
      
      const res = await TMDbService.searchMovies(q, false);
      const ratedMap = await TMDbService.getRatedMovies();
      const ratedIds = new Set(Object.keys(ratedMap));
      
      const safeResults = (res || []).map(m => {
        const id = m.id;
        const tmdbId = m.tmdb_id;
        const isRated = ratedIds.has(String(id)) || (tmdbId ? ratedIds.has(String(tmdbId)) : false);
        const ratingKey = ratedIds.has(String(id)) ? id : tmdbId;
        const userRating = isRated ? ratedMap[ratingKey!] : undefined;

        return { 
          ...m, 
          isRated, 
          userRating
        };
      });

      console.log(`🔍 Search Results IDs:`, safeResults.slice(0, 3).map(m => m.id));
      setSearchResults(safeResults);
      setLastRefresh(Date.now());

    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const debouncedSearch = useCallback(
    debounce((q: string) => {
      lastQueryRef.current = q;
      performSearch(q);
    }, 600),
    []
  );

  const handleSearchChange = (t: string) => {
    setSearchQuery(t); // Use corrected state setter
    if (t.trim().length >= 1) {
      setSearchLoading(true);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
    debouncedSearch(t);
  };

  const clearSearch = () => {
    setSearchQuery(''); // Use corrected state setter
    setSearchResults([]);
    setSearchLoading(false);
    lastQueryRef.current = '';
  };

  const openMovie = (m: Movie) => {
    // FIX: Allow opening rated movies to change rating
    console.log('✅ Opening movie:', m.title);
    navigation.navigate('MovieDetail', { movie: m });
  };

  // --- UI RENDERERS ---

  const renderRatingBadge = (rating: number) => (
    <View style={styles.ratingBadge}>
      <Text style={styles.starIcon}>★</Text>
      <Text style={styles.ratingText}>{rating}</Text>
    </View>
  );

  const renderGridCard = ({ item }: { item: Movie }) => (
    <TouchableOpacity 
      style={[styles.gridCard, item.isRated && styles.cardRated]}
      onPress={() => openMovie(item)}
      // Removed disabled={item.isRated}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
          style={[styles.posterImage, item.isRated && styles.posterDimmed]}
          contentFit="cover"
          transition={200}
          placeholder={BLURHASH}
        />
        {item.isRated && renderRatingBadge(item.userRating || 0)}
      </View>

      <View style={styles.textContainer}>
        <Text style={[styles.cardTitle, item.isRated && styles.textDimmed]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardYear, item.isRated && styles.textDimmed]}>{item.year || ''}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderHorizontalCard = ({ item }: { item: Movie }) => (
    <TouchableOpacity 
      style={[styles.horizontalCard, item.isRated && styles.cardRated]}
      onPress={() => openMovie(item)}
      // Removed disabled={item.isRated}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
          style={[styles.horizontalPosterImage, item.isRated && styles.posterDimmed]}
          contentFit="cover"
          transition={200}
          placeholder={BLURHASH}
        />
        {item.isRated && renderRatingBadge(item.userRating || 0)}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.cardTitle, item.isRated && styles.textDimmed]} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const isSearching = searchQuery.trim().length >= 1; // Use corrected state

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* HEADER */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <TextInput
            value={searchQuery} // Use corrected state
            onChangeText={handleSearchChange}
            placeholder="search..."
            placeholderTextColor="rgba(240, 228, 193, 0.5)"
            style={styles.searchInput}
            autoCorrect={false}
          />
          {isSearching ? (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <CrossIcon />
            </TouchableOpacity>
          ) : (
             <View style={styles.searchIcon}>
               <Magnifier color="rgba(240,228,193,0.4)" />
             </View>
          )}
        </View>
      </View>

      {/* CONTENT */}
      {isSearching ? (
        searchLoading ? (
           <ActivityIndicator size="large" color="#F0E4C1" style={{ marginTop: 40 }} />
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>no movies found</Text>
            <Text style={styles.emptyStateSubtext}>try a different title</Text>
          </View>
        ) : (
          <FlatList
            key="search-results-3-col"
            data={searchResults}
            keyExtractor={(i) => `search-${i.id}-${lastRefresh}`}
            renderItem={renderGridCard}
            numColumns={3}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            extraData={lastRefresh} 
          />
        )
      ) : (
        <FlatList
          key="discover-3-col"
          data={popularMovies}
          keyExtractor={(i) => `pop-${i.id}-${lastRefresh}`}
          numColumns={3}
          renderItem={renderGridCard}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F0E4C1" />}
          keyboardShouldPersistTaps="handled"
          extraData={lastRefresh} 
          ListHeaderComponent={
            <View>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.heading}>discover movies</Text>
                <Text style={styles.subheading}>find your next favorite film</Text>
              </View>

              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>in theaters now</Text>
                <FlatList
                  data={nowPlayingMovies}
                  horizontal
                  keyExtractor={(i) => `now-${i.id}-${lastRefresh}`}
                  renderItem={renderHorizontalCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: PADDING }}
                  ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
                  extraData={lastRefresh}
                />
              </View>

              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>trending this week</Text>
                <FlatList
                  data={trendingMovies}
                  horizontal
                  keyExtractor={(i) => `trend-${i.id}-${lastRefresh}`}
                  renderItem={renderHorizontalCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: PADDING }}
                  ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
                  extraData={lastRefresh}
                />
              </View>

              <Text style={[styles.sectionTitle, { marginTop: 8 }]}>classics & top rated</Text>
              <Text style={styles.shuffleHint}>pull down to shuffle movies</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },
  
  searchHeader: { paddingHorizontal: PADDING, paddingBottom: 12, paddingTop: 8 },
  searchInputContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(240,228,193,0.08)', 
    borderRadius: 12, 
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.1)'
  },
  searchInput: { flex: 1, paddingVertical: 12, color: '#F0E4C1', fontSize: 16 },
  clearButton: { padding: 8 },
  searchIcon: { padding: 8 },

  headerTitleContainer: { paddingHorizontal: PADDING, marginBottom: 20, marginTop: 10 },
  heading: { color: '#F0E4C1', fontSize: 28, fontWeight: '700' },
  subheading: { color: 'rgba(240, 228, 193, 0.6)', fontSize: 16, marginTop: 4 },
  
  sectionContainer: { marginBottom: 24 },
  sectionTitle: { color: '#F0E4C1', fontSize: 13, fontWeight: '700', paddingHorizontal: PADDING, marginBottom: 12, textTransform: 'lowercase' },
  
  imageContainer: { position: 'relative', overflow: 'hidden', borderRadius: 6 },

  // HORIZONTAL CARD
  horizontalCard: { width: HORIZONTAL_CARD_W },
  horizontalPosterImage: { 
    width: '100%', 
    height: HORIZONTAL_CARD_W * 1.5, 
    borderRadius: 6, 
    backgroundColor: '#1a2634' 
  },
  
  // GRID CARD
  gridCard: { width: GRID_CARD_W, marginBottom: 16 },
  posterImage: { 
    width: '100%', 
    height: GRID_CARD_W * 1.5, 
    borderRadius: 6, 
    backgroundColor: '#1a2634' 
  },
  
  // --- IMPROVED RATED MOVIE STYLING ---
  cardRated: {
    opacity: 1, 
  },
  posterDimmed: {
    opacity: 0.6, // Slightly dimmed to make the badge pop, but visible
  },
  
  // NEW STAR BADGE STYLES
  ratingBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#511619', // Burgundy
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240, 228, 193, 0.4)', // Cream border
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  starIcon: {
    color: '#F0E4C1', // Cream
    fontSize: 10,
    marginRight: 3,
  },
  ratingText: {
    color: '#F0E4C1', // Cream
    fontSize: 11,
    fontWeight: '800',
  },

  textDimmed: {
    color: 'rgba(240, 228, 193, 0.5)', 
  },
  
  textContainer: { marginTop: 6, alignItems: 'center', paddingHorizontal: 2 },
  cardTitle: { 
    color: '#F0E4C1', 
    fontSize: 11, 
    fontWeight: '500', 
    textAlign: 'center',
    opacity: 0.9,
    textTransform: 'lowercase',
    lineHeight: 14
  },
  cardYear: {
    color: 'rgba(240, 228, 193, 0.5)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center'
  },

  row: { justifyContent: 'flex-start', paddingHorizontal: PADDING, gap: GAP }, 
  listContent: { paddingBottom: 40 },
  shuffleHint: { paddingHorizontal: PADDING, color: 'rgba(240, 228, 193, 0.4)', fontSize: 12, marginBottom: 10, textTransform: 'lowercase' },
  
  // EMPTY STATE
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: PADDING,
  },
  emptyStateText: {
    color: '#F0E4C1',
    fontSize: 18,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  emptyStateSubtext: {
    color: 'rgba(240, 228, 193, 0.5)',
    fontSize: 14,
    marginTop: 8,
    textTransform: 'lowercase',
  },
});