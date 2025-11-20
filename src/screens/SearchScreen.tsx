// src/screens/SearchScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image'; // YENİ: Hızlı resim kütüphanesi
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import TMDbService, { Movie } from '../services/TMDbService';
import debounce from 'lodash.debounce';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 3; // 3 sütunlu düzgün hesaplama
const BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQ';

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

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]); // EKSİK OLAN SATIR
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
        TMDbService.getTopRatedMovies(),
      ]);
      console.log('Discover Loaded:', { trending: trending?.length, popular: popular?.length });
      setTrendingMovies((trending ?? []).slice(0, 20));
      setPopularMovies((popular ?? []).slice(0, 40));
    } catch (error) {
      console.error(error);
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
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 600),
    []
  );

  const handleSearchChange = (t: string) => {
    setQuery(t);
    if (t.trim().length >= 1) setSearchLoading(true);
    debouncedSearch(t);
  };

  const openMovie = (m: Movie) => navigation.navigate('MovieDetail', { movie: m });

  const renderCard = ({ item }: { item: Movie }) => (
    <TouchableOpacity style={styles.card} onPress={() => openMovie(item)}>
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
        style={styles.cardPoster}
        contentFit="cover"
        transition={200}
        placeholder={BLURHASH}
      />
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTrendingCard = ({ item }: { item: Movie }) => (
    <TouchableOpacity style={styles.trendingCard} onPress={() => openMovie(item)}>
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
        style={styles.trendingPoster}
        contentFit="cover"
        transition={200}
        placeholder={BLURHASH}
      />
      <Text style={styles.trendingTitle} numberOfLines={1}>{item.title}</Text>
    </TouchableOpacity>
  );

  // SEARCH MODE
  if (query.trim().length >= 1) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.searchHeader}>
          <View style={styles.searchInputContainer}>
            <TextInput
              value={query}
              onChangeText={handleSearchChange}
              placeholder="search..."
              placeholderTextColor="rgba(240, 228, 193, 0.5)"
              style={styles.searchInput}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }} style={styles.clearButton}>
              <CrossIcon />
            </TouchableOpacity>
          </View>
        </View>
        {searchLoading ? (
          <ActivityIndicator size="large" color="#F0E4C1" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(i) => `search-${i.id}`}
            renderItem={renderCard}
            numColumns={3}
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
          />
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
        keyExtractor={(i) => `pop-${i.id}`}
        numColumns={3}
        renderItem={renderCard}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F0E4C1" />}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.heading}>discover movies</Text>
              <Text style={styles.subheading}>find your next favorite film</Text>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                value={query}
                onChangeText={handleSearchChange}
                placeholder="search for movies..."
                placeholderTextColor="rgba(240, 228, 193, 0.5)"
                style={styles.discoverSearchInput}
              />
              <View style={styles.searchIconContainer}>
                <Magnifier color="rgba(240,228,193,0.7)" />
              </View>
            </View>

            <View style={styles.trendingSection}>
              <Text style={styles.sectionTitle}>trending this week</Text>
              <FlatList
                data={trendingMovies}
                horizontal
                keyExtractor={(i) => `trend-${i.id}`}
                renderItem={renderTrendingCard}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 20 }}
              />
            </View>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>all-time popular movies</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },
  header: { padding: 20 },
  heading: { color: '#F0E4C1', fontSize: 28, fontWeight: '700' },
  subheading: { color: 'rgba(240, 228, 193, 0.6)', fontSize: 16, marginTop: 4 },
  searchContainer: { paddingHorizontal: 20, marginBottom: 24 },
  discoverSearchInput: { backgroundColor: 'rgba(240,228,193,0.08)', borderRadius: 12, padding: 14, color: '#F0E4C1', fontSize: 16, borderWidth: 1, borderColor: 'rgba(240,228,193,0.1)' },
  searchIconContainer: { position: 'absolute', right: 34, top: 14 },
  trendingSection: { marginBottom: 8 },
  sectionTitle: { color: '#F0E4C1', fontSize: 18, fontWeight: '600', paddingHorizontal: 20, marginBottom: 12 },
  trendingCard: { width: 120, marginRight: 12 },
  trendingPoster: { width: 120, height: 180, borderRadius: 12, backgroundColor: '#1a2634' },
  trendingTitle: { color: '#F0E4C1', fontSize: 12, marginTop: 6, textAlign: 'center' },
  
  // Grid Styles
  row: { justifyContent: 'flex-start', paddingHorizontal: 16, gap: 8 }, // Gap ile boşlukları ayarlıyoruz
  card: { width: CARD_W, marginBottom: 16 },
  cardPoster: { width: '100%', height: CARD_W * 1.5, borderRadius: 8, backgroundColor: '#1a2634' },
  cardInfo: { marginTop: 4 },
  cardTitle: { color: '#F0E4C1', fontSize: 11, textAlign: 'center' },
  listContent: { paddingBottom: 40 },
  
  // Search Mode Styles
  searchHeader: { padding: 16 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(240,228,193,0.08)', borderRadius: 12, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 12, color: '#F0E4C1', fontSize: 16 },
  clearButton: { padding: 8 },
});