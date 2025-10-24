// src/screens/HomeScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/MainApp';
import TMDbService, { Movie } from '../services/TMDbService';

const { width } = Dimensions.get('window');

type NavProp = StackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<NavProp>();

  const [trendingMovies, setTrendingMovies] = useState<Movie[]>([]);
  const [popularMovies, setPopularMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMovies();
  }, []);

  const loadMovies = async () => {
    try {
      const [trending, popular] = await Promise.all([
        TMDbService.getTrendingMovies('week'),
        TMDbService.getPopularMovies(),
      ]);

      setTrendingMovies(trending.slice(0, 10));
      setPopularMovies(popular.slice(0, 10));
    } catch (error) {
      console.error('Error loading movies:', error);
      Alert.alert('Error', 'Failed to load movies. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMovies();
    setRefreshing(false);
  };

  const handlePress = (movie: Movie) => {
    navigation.navigate('MovieDetail', { movie });
  };

  const renderMovieCard = ({ item }: { item: Movie }) => (
    <TouchableOpacity style={styles.card} onPress={() => handlePress(item)}>
      <View style={styles.poster}>
        {item.poster_path ? (
          <Image
           source={item.poster_path ? { uri: `https://image.tmdb.org/t/p/w500${item.poster_path}` } : undefined}
            style={styles.posterImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.posterPlaceholderText}>🎬</Text>
          </View>
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.meta}>
        {item.year} • ⭐ {item.rating.toFixed(1)}
      </Text>
      <Text style={styles.genres} numberOfLines={1}>
        {item.genres.slice(0, 2).join(', ')}
      </Text>
      {item.director && (
        <Text style={styles.director} numberOfLines={1}>
          {item.director}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderSection = (title: string, data: Movie[], isHorizontal: boolean = true) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{data.length} movies</Text>
      </View>
      
      {isHorizontal ? (
        <FlatList
          data={data}
          keyExtractor={(item) => `${title}-${item.id}`}
          renderItem={renderMovieCard}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => `${title}-${item.id}`}
          renderItem={renderMovieCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.verticalList}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F0E4C1" />
          <Text style={styles.loadingText}>Loading featured movies...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <FlatList
        data={[1]} // Dummy data to use FlatList for scroll + refresh
        keyExtractor={() => 'home'}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#F0E4C1"
          />
        }
        renderItem={() => (
          <View>
            <View style={styles.header}>
              <Text style={styles.heading}>Movie Discovery</Text>
              <Text style={styles.subheading}>Find your next favorite film</Text>
            </View>

            {trendingMovies.length > 0 && renderSection('trending this week', trendingMovies)}
            {popularMovies.length > 0 && renderSection('popular movies', popularMovies.slice(0, 6), false)}
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const CARD_W = width * 0.55;
const GRID_CARD_W = (width - 48) / 2; // Account for padding and gap

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#111C2A' 
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#F0E4C1',
    opacity: 0.7,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heading: {
    color: '#F0E4C1',
    fontSize: 28,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  subheading: {
    color: '#F0E4C1',
    opacity: 0.7,
    marginTop: 4,
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F0E4C1',
    fontSize: 20,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  sectionCount: {
    color: '#F0E4C1',
    opacity: 0.5,
    fontSize: 12,
  },
  horizontalList: {
    paddingHorizontal: 16,
    gap: 14,
  },
  verticalList: {
    paddingHorizontal: 16,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  card: {
    width: CARD_W,
    borderRadius: 16,
    backgroundColor: 'rgba(240,228,193,0.06)',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.15)',
  },
  poster: {
    height: CARD_W * 1.2,
    borderRadius: 12,
    backgroundColor: 'rgba(240,228,193,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  posterPlaceholderText: { 
    fontSize: 48 
  },
  title: { 
    color: '#F0E4C1', 
    fontSize: 16, 
    fontWeight: '700',
    marginBottom: 4,
    lineHeight: 20,
  },
  meta: { 
    color: '#F0E4C1', 
    opacity: 0.7, 
    marginBottom: 4,
    fontSize: 12,
  },
  genres: { 
    color: '#511619', 
    fontWeight: '700', 
    textTransform: 'lowercase',
    fontSize: 12,
    marginBottom: 2,
  },
  director: {
    color: '#F0E4C1',
    opacity: 0.6,
    fontSize: 11,
    fontStyle: 'italic',
  },
});

// Update grid cards to be smaller
StyleSheet.flatten([
  styles.card,
  {
    width: GRID_CARD_W,
  }
]);