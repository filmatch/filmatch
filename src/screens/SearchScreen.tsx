import React, { useState, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import TMDbService, { Movie } from '../services/TMDbService';
import debounce from 'lodash.debounce';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.28; // Made smaller for better grid

/*** minimal inline icons (no emoji, no libraries) ***/
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

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDiscover();
  }, []);

  const loadDiscover = async () => {
    try {
      const [trending, popular] = await Promise.all([
        TMDbService.getTrendingMovies('week'),
        TMDbService.getPopularMovies(),
      ]);
      setTrendingMovies((trending ?? []).slice(0, 20));
      setPopularMovies((popular ?? []).slice(0, 40));
    } catch {
      Alert.alert('error', 'failed to load movies.');
    } finally {
      setDiscoverLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDiscover();
    setRefreshing(false);
  };

  const debouncedSearch = useCallback(
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
    }, 600),
    []
  );

  useEffect(() => {
    return () => {
      // @ts-ignore
      debouncedSearch.cancel?.();
    };
  }, [debouncedSearch]);

  const handleSearchChange = (t: string) => {
    setQuery(t);
    if (t.trim().length >= 1) {
      setSearchLoading(true);
    }
    debouncedSearch(t);
  };

  const clearSearch = () => {
    setQuery('');
    setSearchResults([]);
    setSearchLoading(false);
  };

  const openMovie = (m: Movie) => navigation.navigate('MovieDetail', { movie: m });

  const renderDiscoverCard = ({ item }: { item: Movie }) => (
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
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardYear}>
          {item.year || (item.release_date ? new Date(item.release_date).getFullYear() : '')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSearchCard = ({ item }: { item: Movie }) => (
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

  const renderTrendingCard = ({ item }: { item: Movie }) => (
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
      <Text style={styles.trendingTitle} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  );

  // SEARCH MODE
  if (query.trim() && query.trim().length >= 1) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />

        {/* Search Header */}
        <View style={styles.searchHeader}>
          <View style={styles.searchInputContainer}>
            <TextInput
              value={query}
              onChangeText={handleSearchChange}
              placeholder="search for movies..."
              placeholderTextColor="rgba(240, 228, 193, 0.5)"
              style={styles.searchInput}
              autoCapitalize="none"
              autoFocus
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <CrossIcon />
              </TouchableOpacity>
            )}
          </View>
          {searchLoading && <ActivityIndicator size="small" color="#F0E4C1" style={styles.searchIndicator} />}
        </View>

        {/* Search Results */}
        {searchLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F0E4C1" />
            <Text style={styles.loadingText}>searching...</Text>
          </View>
        ) : searchResults.length > 0 ? (
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
            />
          </>
        ) : (
          <View style={styles.noResultsContainer}>
            <Magnifier color="rgba(240,228,193,0.7)" />
            <Text style={styles.noResultsText}>no movies found</Text>
            <Text style={styles.noResultsSubtext}>try a different search term</Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  // DISCOVER MODE
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <FlatList
        data={popularMovies}
        keyExtractor={(i) => `popular-${i.id}`}
        numColumns={3}
        renderItem={renderDiscoverCard}
        columnWrapperStyle={styles.discoverRow}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.heading}>discover movies</Text>
              <Text style={styles.subheading}>find your next favorite film</Text>
            </View>

            {/* Search Box */}
            <View style={styles.searchContainer}>
              <TextInput
                value={query}
                onChangeText={handleSearchChange}
                placeholder="search for movies..."
                placeholderTextColor="rgba(240, 228, 193, 0.5)"
                style={styles.discoverSearchInput}
                autoCapitalize="none"
              />
              <View style={styles.searchIconContainer}>
                <Magnifier color="rgba(240,228,193,0.7)" />
              </View>
            </View>

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
                />
              </View>
            )}

            {/* Popular Section Header */}
            <Text style={[styles.sectionTitle, styles.popularTitle]}>popular movies</Text>
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111C2A',
  },

  // Header styles
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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

  // Search styles
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    position: 'relative',
  },
  discoverSearchInput: {
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
  searchIconContainer: {
    position: 'absolute',
    right: 32,
    top: 14,
  },

  // Search mode header
  searchHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.3)',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#F0E4C1',
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
    marginLeft: 8,
  },
  searchIndicator: {
    marginTop: 8,
  },

  // Results count
  resultsCount: {
    color: 'rgba(240, 228, 193, 0.7)',
    fontSize: 14,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },

  // Trending section
  trendingSection: {
    marginBottom: 24,
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

  // Trending cards (horizontal)
  trendingCard: {
    width: 120,
    marginRight: 12,
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

  // Discover cards (3-column grid)
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

  // Search result cards (3-column grid like discover)
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

  // placeholders (no emoji)
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

  // Loading and empty states
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

  // Content padding
  discoverContent: {
    paddingBottom: 32,
  },
});
