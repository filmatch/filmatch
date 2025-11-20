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
import { Image } from 'expo-image'; 
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import TMDbService, { Movie } from '../services/TMDbService';
import debounce from 'lodash.debounce';

const { width } = Dimensions.get('window');

// --- 3 SÜTUNLU GRID AYARLARI (KESİN HESAP) ---
const GAP = 12;
const PADDING = 16;
// Matematik: (Ekran - SolSağPadding - 2 tane AraBoşluk) / 3
const GRID_CARD_W = (width - (PADDING * 2) - (GAP * 2)) / 3; 

// --- YATAY LİSTE ---
const HORIZONTAL_CARD_W = (width - PADDING) / 3.5; // 3.5 tane görünsün

const BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQ';

// --- İKONLAR ---
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
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  
  const [nowPlayingMovies, setNowPlayingMovies] = useState<Movie[]>([]);
  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDiscover();
  }, []);

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
      
    } catch (error) {
      console.error(error);
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

  const clearSearch = () => {
    setQuery('');
    setSearchResults([]);
    setSearchLoading(false);
  };

  const openMovie = (m: Movie) => navigation.navigate('MovieDetail', { movie: m });

  // --- KART BİLEŞENLERİ ---

  // 1. Dikey Grid Kartı (3 Sütun - İsim ve Yıl Var)
  const renderGridCard = ({ item }: { item: Movie }) => (
    <TouchableOpacity style={styles.gridCard} onPress={() => openMovie(item)}>
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
        style={styles.posterImage}
        contentFit="cover"
        transition={200}
        placeholder={BLURHASH}
      />
      <View style={styles.textContainer}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardYear}>{item.year || ''}</Text>
      </View>
    </TouchableOpacity>
  );

  // 2. Yatay Kart
  const renderHorizontalCard = ({ item }: { item: Movie }) => (
    <TouchableOpacity style={styles.horizontalCard} onPress={() => openMovie(item)}>
      <Image
        source={{ uri: `https://image.tmdb.org/t/p/w342${item.poster_path}` }}
        style={styles.horizontalPosterImage}
        contentFit="cover"
        transition={200}
        placeholder={BLURHASH}
      />
      <View style={styles.textContainer}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
      </View>
    </TouchableOpacity>
  );

  const isSearching = query.trim().length >= 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* HEADER (Sabit) */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <TextInput
            value={query}
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

      {/* İÇERİK */}
      {isSearching ? (
        // ARAMA SONUÇLARI
        searchLoading ? (
           <ActivityIndicator size="large" color="#F0E4C1" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            key="search-results-3-col" // KEY EKLENDİ: Render'ı zorlar
            data={searchResults}
            keyExtractor={(i) => `search-${i.id}`}
            renderItem={renderGridCard}
            numColumns={3} // 3 SÜTUN
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )
      ) : (
        // KEŞFET EKRANI
        <FlatList
          key="discover-3-col" // KEY EKLENDİ: Render'ı zorlar
          data={popularMovies}
          keyExtractor={(i) => `pop-${i.id}`}
          numColumns={3} // 3 SÜTUN
          renderItem={renderGridCard}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F0E4C1" />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.heading}>discover movies</Text>
                <Text style={styles.subheading}>find your next favorite film</Text>
              </View>

              {/* 1. SİNEMADA ŞİMDİ */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>in theaters now</Text>
                <FlatList
                  data={nowPlayingMovies}
                  horizontal
                  keyExtractor={(i) => `now-${i.id}`}
                  renderItem={renderHorizontalCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: PADDING }}
                  ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
                />
              </View>

              {/* 2. TRENDLER */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>trending this week</Text>
                <FlatList
                  data={trendingMovies}
                  horizontal
                  keyExtractor={(i) => `trend-${i.id}`}
                  renderItem={renderHorizontalCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingLeft: PADDING }}
                  ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
                />
              </View>

              {/* 3. KLASİKLER */}
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
  
  // YATAY KART
  horizontalCard: { width: HORIZONTAL_CARD_W },
  horizontalPosterImage: { 
    width: '100%', 
    height: HORIZONTAL_CARD_W * 1.5, 
    borderRadius: 6, 
    backgroundColor: '#1a2634' 
  },
  
  // DİKEY GRID KARTI (3 Sütun)
  gridCard: { width: GRID_CARD_W, marginBottom: 16 }, 
  posterImage: { 
    width: '100%', 
    height: GRID_CARD_W * 1.5, 
    borderRadius: 6, 
    backgroundColor: '#1a2634' 
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
});