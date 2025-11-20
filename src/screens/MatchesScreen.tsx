// src/screens/MatchesScreen.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image'; // Hızlı resim
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { collection, query as firestoreQuery, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { MatchingService } from '../services/MatchingService';
import { TMDbService } from '../services/TMDbService';
import type { UserProfile } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BLURHASH = '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQfQ';

// Tipler
type NewMatch = {
  uid: string;
  name: string;
  photo?: string;
  age?: number;
  city?: string;
  compatibility: number;
  photos?: string[];
  bio?: string;
  favorites?: Array<{ id: string; title: string; poster?: string }>;
  recentWatches?: Array<{ id: string; title: string }>;
  genreRatings?: Array<{ genre: string; rating: number }>;
};

type ChatRow = {
  id: string;
  chatId: string;
  name: string;
  avatar?: string;
  lastMsg: string;
  lastMessageAt: number;
  unread?: number;
  otherUserId: string;
};

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export default function MatchesScreen() {
  const navigation = useNavigation<any>();
  const currentUser = FirebaseAuthService.getCurrentUser();

  const [newMatches, setNewMatches] = useState<NewMatch[]>([]);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<NewMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    loadCurrentUserProfile();
    loadMatches();
    
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    const chatsRef = collection(db, 'chats');
    const chatsQuery = firestoreQuery(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(
      chatsQuery, 
      async (snapshot) => {
        const chatRows: ChatRow[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
          if (!otherUserId) continue;

          try {
            const otherUserProfile = await FirestoreService.getUserProfile(otherUserId);
            if (!otherUserProfile) continue;
            
            chatRows.push({
              id: docSnap.id,
              chatId: docSnap.id,
              name: otherUserProfile.displayName || 'unknown',
              avatar: otherUserProfile.photos?.[0],
              lastMsg: data.lastMessage || 'no messages yet',
              lastMessageAt: data.lastMessageTime?.toMillis() || data.createdAt?.toMillis() || Date.now(),
              unread: 0,
              otherUserId,
            });
          } catch (err) {
            console.error('Error fetching chat profile:', err);
          }
        }
        setChats(chatRows);
      },
      (error) => {
        if (error.code !== 'permission-denied') console.error('Chat listener error:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const loadCurrentUserProfile = async () => {
    if (!currentUser) return;
    try {
      const profile = await FirestoreService.getUserProfile(currentUser.uid);
      setCurrentUserProfile(profile);
    } catch (err) {}
  };

  const resolvePoster = async (favItem: any) => {
    if (favItem.poster && favItem.poster.startsWith('http')) {
      return favItem.poster;
    }
    try {
      let cleanId = String(favItem.id);
      if (cleanId.includes('fav_')) {
        const parts = cleanId.split('_');
        if (parts[1]) cleanId = parts[1];
      }
      
      const movieId = Number(cleanId);
      if (!isNaN(movieId) && movieId > 0) {
        const details = await TMDbService.getMovieDetails(movieId);
        if (details?.poster_path) {
          return TMDbService.getPosterUrl(details.poster_path, 'w342');
        }
      }
    } catch (e) {}
    return null;
  };

  const loadMatches = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      if (!currentUser) return;

      const userProfile = await FirestoreService.getUserProfile(currentUser.uid);
      if (!userProfile) return;

      const matchesRef = collection(db, 'matches');
      const q1 = firestoreQuery(matchesRef, where('user1Id', '==', currentUser.uid));
      const q2 = firestoreQuery(matchesRef, where('user2Id', '==', currentUser.uid));
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const matchedUserIds: string[] = [];
      
      snapshot1.forEach(doc => matchedUserIds.push(doc.data().user2Id));
      snapshot2.forEach(doc => matchedUserIds.push(doc.data().user1Id));
      
      const matchProfiles: NewMatch[] = [];
      
      for (const matchedUserId of matchedUserIds) {
        try {
          const matchedProfile = await FirestoreService.getUserProfile(matchedUserId);
          
          if (matchedProfile) {
            const compatibility = MatchingService.calculateCompatibility(userProfile, matchedProfile);
            
            const processedFavorites = await Promise.all(
              (matchedProfile.favorites || []).map(async (f) => {
                const finalPoster = await resolvePoster(f);
                return {
                  id: String(f.id),
                  title: f.title,
                  poster: finalPoster || undefined,
                };
              })
            );

            matchProfiles.push({
              uid: matchedProfile.uid,
              name: matchedProfile.displayName || 'anonymous',
              age: matchedProfile.age,
              city: matchedProfile.city,
              compatibility,
              photo: matchedProfile.photos?.[0],
              photos: matchedProfile.photos || [],
              bio: matchedProfile.bio,
              favorites: processedFavorites,
              recentWatches: matchedProfile.recentWatches?.map(r => ({
                id: String(r.id),
                title: r.title,
              })),
              genreRatings: matchedProfile.genreRatings,
            });
          }
        } catch (err) {
          console.error('Error fetching match profile:', err);
        }
      }

      matchProfiles.sort((a, b) => b.compatibility - a.compatibility);
      setNewMatches(matchProfiles);
    } catch (error) {
      Alert.alert('error', 'failed to load matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => loadMatches(true);

  const sortedMatches = useMemo(() => [...newMatches], [newMatches]);
  const sortedChats = useMemo(() => [...chats].sort((a, b) => b.lastMessageAt - a.lastMessageAt), [chats]);
  
  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedChats;
    return sortedChats.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedChats, query]);

  const onPressNewMatch = (item: NewMatch) => {
    setSelected(item);
    setCurrentPhotoIndex(0); // Sıfırla
    setModalOpen(true);
  };

  const handlePhotoTap = () => {
    if (selected?.photos && selected.photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev + 1) % selected.photos!.length);
    }
  };

  const onStartChat = async () => {
    if (!selected || !currentUser) return;
    const sortedIds = [currentUser.uid, selected.uid].sort();
    const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
    setModalOpen(false);
    navigation.navigate('Chat', { chatId });
  };

  const onRemoveMatch = () => {
    if (!selected) return;
    Alert.alert('remove match', `remove ${selected.name}?`, [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'remove',
        style: 'destructive',
        onPress: () => {
          setNewMatches((prev) => prev.filter((m) => m.uid !== selected.uid));
          setModalOpen(false);
          setSelected(null);
        },
      },
    ]);
  };

  const topGenres = useMemo(() => {
    if (selected?.genreRatings?.length) {
      return [...selected.genreRatings]
        .filter((g) => g.rating > 0)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5)
        .map((g) => g.genre);
    }
    return [];
  }, [selected]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F0E4C1" />
          <Text style={styles.loadingText}>loading matches...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F0E4C1" />}
      >
        {/* NEW MATCHES LIST */}
        {newMatches.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>new matches</Text>
            <FlatList
              data={sortedMatches}
              horizontal
              keyExtractor={(i) => i.uid}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.matchTile} onPress={() => onPressNewMatch(item)} activeOpacity={0.9}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.matchPhoto} contentFit="cover" />
                  ) : (
                    <View style={[styles.matchPhoto, styles.photoPlaceholder]}>
                      <Text style={styles.placeholderText}>{item.name[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.matchName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.compPill}>
                    <Text style={styles.compPillText}>{item.compatibility}%</Text>
                  </View>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.matchesRow}
            />
          </>
        ) : (
          <View style={styles.emptyMatches}>
            <Text style={styles.emptyText}>no matches yet</Text>
            <Text style={styles.emptyHint}>keep swiping to find matches</Text>
          </View>
        )}

        {/* SEARCH BAR */}
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="search chats…"
            placeholderTextColor="rgba(240,228,193,0.5)"
            style={styles.searchInput}
          />
        </View>

        {/* CHATS LIST */}
        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>chats</Text>
        <View style={styles.chatsList}>
          {filteredChats.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.chatRow}
              onPress={() => navigation.navigate('Chat', { chatId: c.chatId })}
              activeOpacity={0.9}
            >
              {c.avatar ? (
                <Image source={{ uri: c.avatar }} style={styles.chatAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.chatAvatar, styles.photoPlaceholder]}>
                  <Text style={styles.placeholderText}>{c.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.chatName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.chatLast} numberOfLines={1}>{c.lastMsg}</Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.chatTime}>{fmtTime(c.lastMessageAt)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        
        {filteredChats.length === 0 && (
          <View style={styles.emptyChats}>
            <Text style={styles.emptyText}>no chats yet</Text>
          </View>
        )}
      </ScrollView>

      {/* --- DETAILED PROFILE MODAL --- */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              
              {/* PHOTOS (TAP TO CHANGE) */}
              {selected?.photos && selected.photos.length > 0 ? (
                <TouchableOpacity 
                  activeOpacity={0.95} 
                  onPress={handlePhotoTap}
                  style={styles.photoContainer}
                >
                  <Image 
                    source={{ uri: selected.photos[currentPhotoIndex] }} 
                    style={styles.modalPhoto} 
                    contentFit="cover"
                    transition={200}
                    placeholder={BLURHASH}
                  />
                  
                  {/* Indicators */}
                  {selected.photos.length > 1 && (
                    <View style={styles.photoIndicators}>
                      {selected.photos.map((_, idx) => (
                        <View key={idx} style={[styles.photoIndicator, currentPhotoIndex === idx && styles.photoIndicatorActive]} />
                      ))}
                    </View>
                  )}

                  {/* Tap Hint (Only on first photo) */}
                  {selected.photos.length > 1 && currentPhotoIndex === 0 && (
                    <View style={styles.tapHint}>
                      <Text style={styles.tapHintText}>tap for next photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.modalPhoto, styles.photoPlaceholder, { alignSelf: 'center', marginTop: 20, width: SCREEN_WIDTH - 40, height: 300, borderRadius: 16 }]}>
                   <Text style={[styles.placeholderText, { fontSize: 40 }]}>{selected?.name?.[0]}</Text>
                </View>
              )}

              {/* HEADER */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalName}>{selected?.name}{selected?.age ? `, ${selected.age}` : ''}</Text>
                  {selected?.city && <Text style={styles.modalCity}>{selected.city}</Text>}
                </View>
                <View style={styles.compBadge}>
                  <Text style={styles.compText}>{selected?.compatibility}%</Text>
                  <Text style={styles.compCaption}>match</Text>
                </View>
              </View>

              {/* BIO */}
              {selected?.bio && (
                <View style={styles.section}>
                  <Text style={styles.bioText}>{selected.bio}</Text>
                </View>
              )}

              {/* FAVORITE FILMS (4'LÜ GRID) */}
              {selected?.favorites && selected.favorites.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>favorite films</Text>
                  <View style={styles.posterRow}>
                    {selected.favorites.slice(0, 4).map((fav) => (
                      <View key={fav.id} style={styles.posterTile}>
                        {fav.poster ? (
                          <Image source={{ uri: fav.poster }} style={styles.posterImg} contentFit="cover" />
                        ) : (
                          <View style={[styles.posterImg, styles.photoPlaceholder]}>
                            <Text style={styles.placeholderTextSmall}>no{'\n'}img</Text>
                          </View>
                        )}
                        <Text style={styles.posterCaption} numberOfLines={1}>{fav.title}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* RECENT WATCHES */}
              {selected?.recentWatches && selected.recentWatches.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>recent watches</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {selected.recentWatches.slice(0, 6).map((r) => (
                      <View key={r.id} style={styles.chip}>
                        <Text style={styles.chipText}>{r.title.toLowerCase()}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* GENRES */}
              {topGenres.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>top genres</Text>
                  <View style={styles.genresWrap}>
                    {topGenres.map((g) => (
                      <View key={g} style={styles.chip}>
                        <Text style={styles.chipText}>{g}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* BUTTONS */}
              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalBtn, styles.secondaryBtn]} onPress={onRemoveMatch}>
                  <Text style={styles.modalBtnText}>remove</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn]} onPress={onStartChat}>
                  <Text style={styles.modalBtnText}>chat</Text>
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.closeTap}>
                <Text style={styles.closeText}>close</Text>
              </TouchableOpacity>

            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#F0E4C1', marginTop: 10 },

  sectionTitle: { color: '#F0E4C1', fontSize: 18, fontWeight: '700', marginLeft: 20, marginBottom: 12, marginTop: 16, textTransform: 'lowercase' },
  
  matchesRow: { paddingHorizontal: 16 },
  matchTile: { width: 80, marginRight: 12, alignItems: 'center' },
  matchPhoto: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#1a2634', marginBottom: 6, borderWidth: 2, borderColor: 'rgba(240,228,193,0.2)' },
  matchName: { color: '#F0E4C1', fontSize: 12, textAlign: 'center', textTransform: 'lowercase' },
  compPill: { marginTop: 4, backgroundColor: '#511619', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  compPillText: { color: '#F0E4C1', fontSize: 10, fontWeight: '700' },

  searchWrap: { paddingHorizontal: 20, marginTop: 16 },
  searchInput: { backgroundColor: 'rgba(240,228,193,0.08)', borderRadius: 12, padding: 12, color: '#F0E4C1', fontSize: 16 },

  chatsList: { paddingHorizontal: 20, marginTop: 8 },
  chatRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(240,228,193,0.05)', padding: 12, borderRadius: 16, marginBottom: 8 },
  chatAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1a2634', marginRight: 12 },
  chatName: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
  chatLast: { color: 'rgba(240,228,193,0.6)', fontSize: 13, marginTop: 2 },
  rightCol: { marginLeft: 'auto' },
  chatTime: { color: 'rgba(240,228,193,0.4)', fontSize: 11 },

  emptyMatches: { padding: 20, alignItems: 'center' },
  emptyChats: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#F0E4C1', fontWeight: 'bold' },
  emptyHint: { color: 'rgba(240,228,193,0.5)', fontSize: 12, marginTop: 4 },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#111C2A', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '90%', width: '100%' },
  
  photoContainer: { margin: 16, height: 300, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', position: 'relative' },
  modalPhoto: { width: '100%', height: 300 },
  
  photoIndicators: { position: 'absolute', bottom: 12, width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  photoIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  photoIndicatorActive: { backgroundColor: '#fff', width: 16 },

  tapHint: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(17,28,42,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  tapHintText: { color: '#F0E4C1', fontSize: 10, fontWeight: '600', textTransform: 'lowercase' },

  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  modalName: { color: '#F0E4C1', fontSize: 24, fontWeight: '800', textTransform: 'lowercase' },
  modalCity: { color: 'rgba(240,228,193,0.6)', fontSize: 14, textTransform: 'lowercase' },
  compBadge: { backgroundColor: '#511619', borderRadius: 12, padding: 8, alignItems: 'center' },
  compText: { color: '#F0E4C1', fontSize: 18, fontWeight: '900' },
  compCaption: { color: 'rgba(240,228,193,0.8)', fontSize: 10, textTransform: 'lowercase' },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: { color: '#F0E4C1', fontSize: 14, fontWeight: '700', marginBottom: 10, textTransform: 'lowercase', opacity: 0.8 },
  bioText: { color: '#F0E4C1', fontSize: 15, lineHeight: 22 },

  posterRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  posterTile: { width: (SCREEN_WIDTH - 40 - 24) / 4, alignItems: 'center' },
  posterImg: { width: '100%', aspectRatio: 2/3, borderRadius: 8, backgroundColor: '#1a2634' },
  posterCaption: { color: '#F0E4C1', fontSize: 9, marginTop: 4, textAlign: 'center', opacity: 0.8 },

  genresWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: 'rgba(240,228,193,0.1)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  chipText: { color: '#F0E4C1', fontSize: 12, fontWeight: '600', textTransform: 'lowercase' },

  modalButtons: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 10 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  primaryBtn: { backgroundColor: '#511619', borderColor: '#511619' },
  secondaryBtn: { borderColor: 'rgba(240,228,193,0.3)' },
  modalBtnText: { color: '#F0E4C1', fontWeight: '700', fontSize: 16, textTransform: 'lowercase' },

  closeTap: { alignItems: 'center', padding: 20 },
  closeText: { color: 'rgba(240,228,193,0.5)', fontSize: 14 },

  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,228,193,0.1)' },
  placeholderText: { color: 'rgba(240,228,193,0.3)', fontSize: 24, fontWeight: 'bold' },
  placeholderTextSmall: { color: 'rgba(240,228,193,0.3)', fontSize: 10, textAlign: 'center' },
});