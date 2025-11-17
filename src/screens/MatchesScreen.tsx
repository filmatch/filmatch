// src/screens/MatchesScreen.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { collection, query as firestoreQuery, where, onSnapshot, doc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { MatchingService } from '../services/MatchingService';
import type { UserProfile } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffMins < 1440) {
    return `${Math.floor(diffMins / 60)}h ago`;
  } else {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
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
  const photoScrollRef = useRef<FlatList>(null);

  useEffect(() => {
    loadCurrentUserProfile();
    loadMatches();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    console.log('💬 Setting up chat listener for user:', currentUser.uid);
    
    const chatsRef = collection(db, 'chats');
    const chatsQuery = firestoreQuery(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(
      chatsQuery, 
      async (snapshot) => {
        console.log('💬 Chat snapshot received, docs:', snapshot.docs.length);
        const chatRows: ChatRow[] = [];
        
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          console.log('💬 Processing chat:', docSnap.id, 'participants:', data.participants);
          const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
          if (!otherUserId) {
            console.log('⚠️ No other user found in chat:', docSnap.id);
            continue;
          }
          try {
            const otherUserProfile = await FirestoreService.getUserProfile(otherUserId);
            if (!otherUserProfile) {
              console.log('⚠️ Could not load profile for user:', otherUserId);
              continue;
            }
            
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
            
            console.log('✅ Added chat with:', otherUserProfile.displayName);
          } catch (err) {
            console.error('❌ Error fetching user profile for chat:', err);
          }
        }
        
        console.log('💬 Total chats loaded:', chatRows.length);
        setChats(chatRows);
      },
      (error) => {
        if (error.code !== 'permission-denied') {
          console.error('❌ Error in chat listener:', error);
        }
      }
    );

    return () => {
      console.log('💬 Cleaning up chat listener');
      unsubscribe();
    };
  }, [currentUser]);

  const loadCurrentUserProfile = async () => {
    if (!currentUser) return;
    try {
      const profile = await FirestoreService.getUserProfile(currentUser.uid);
      setCurrentUserProfile(profile);
    } catch (err) {
      console.error('Error loading current user profile:', err);
    }
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
      snapshot1.forEach(doc => {
        const data = doc.data();
        matchedUserIds.push(data.user2Id);
      });
      
      snapshot2.forEach(doc => {
        const data = doc.data();
        matchedUserIds.push(data.user1Id);
      });
      const matchProfiles: NewMatch[] = [];
      
      for (const matchedUserId of matchedUserIds) {
        try {
          const matchedProfile = await FirestoreService.getUserProfile(matchedUserId);
          
          if (matchedProfile) {
            const compatibility = MatchingService.calculateCompatibility(userProfile, matchedProfile);
            
            matchProfiles.push({
              uid: matchedProfile.uid,
              name: matchedProfile.displayName || 'anonymous',
              age: matchedProfile.age,
              city: matchedProfile.city,
              compatibility,
              photo: matchedProfile.photos?.[0],
              photos: matchedProfile.photos || [],
              bio: matchedProfile.bio,
              favorites: matchedProfile.favorites?.map(f => ({
                id: String(f.id),
                title: f.title,
                poster: (f as any).poster,
              })),
              recentWatches: matchedProfile.recentWatches?.map(r => ({
                id: String(r.id),
                title: r.title,
              })),
              genreRatings: matchedProfile.genreRatings,
            });
          }
        } catch (err) {
          console.error('Error fetching matched user profile:', err);
        }
      }

      matchProfiles.sort((a, b) => b.compatibility - a.compatibility);
      setNewMatches(matchProfiles);
      
      console.log(`Loaded ${matchProfiles.length} real matches`);
    } catch (error) {
      console.error('error loading matches:', error);
      Alert.alert('error', 'failed to load matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => loadMatches(true);

  const sortedMatches = useMemo(
    () => [...newMatches].sort((a, b) => b.compatibility - a.compatibility),
    [newMatches]
  );
  
  const sortedChats = useMemo(
    () => [...chats].sort((a, b) => b.lastMessageAt - a.lastMessageAt), 
    [chats]
  );

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedChats;
    return sortedChats.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedChats, query]);

  const unreadTotal = useMemo(() => sortedChats.reduce((sum, c) => sum + (c.unread || 0), 0), [sortedChats]);
  
  useEffect(() => {
    navigation.getParent()?.setOptions({ tabBarBadge: unreadTotal || undefined } as any);
  }, [navigation, unreadTotal]);

  const onPressNewMatch = (item: NewMatch) => {
    setSelected(item);
    setCurrentPhotoIndex(0);
    setModalOpen(true);
  };

  const onStartChat = async () => {
    if (!selected || !currentUser || !currentUserProfile) return;
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

  const onLongPressChat = (id: string) => {
    Alert.alert('delete chat', 'this will delete the chat from your list.', [
      { text: 'cancel', style: 'cancel' },
      { text: 'delete', style: 'destructive', onPress: () => {
        setChats((prev) => prev.filter((c) => c.id !== id));
      }},
    ]);
  };

  const hasMatches = newMatches.length > 0;

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

  const handlePhotoScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentPhotoIndex(index);
  };

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F0E4C1"
            colors={['#F0E4C1']}
          />
        }
      >
        {/* new matches */}
        {hasMatches ? (
          <>
            <Text style={styles.sectionTitle}>new matches</Text>
            <FlatList
              data={sortedMatches}
              horizontal
              keyExtractor={(i) => i.uid}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.matchTile} onPress={() => onPressNewMatch(item)} activeOpacity={0.9}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.matchPhoto} />
                  ) : (
                    <View style={[styles.matchPhoto, styles.photoPlaceholder]}>
                      <Text style={styles.placeholderText}>{item.name[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={styles.matchName} numberOfLines={1}>
                    {item.name}
                  </Text>
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
            <Text style={styles.emptyHint}>check back later for new users</Text>
          </View>
        )}

        {/* search bar */}
        <View style={styles.searchWrap}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="search chats…"
            placeholderTextColor="rgba(240,228,193,0.6)"
            style={styles.searchInput}
          />
        </View>

        {/* chats */}
        <Text style={[styles.sectionTitle, { marginTop: 6 }]}>chats</Text>
        <View style={styles.chatsList}>
          {filteredChats.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={styles.chatRow}
              onPress={() => navigation.navigate('Chat', { chatId: c.chatId })}
              onLongPress={() => onLongPressChat(c.id)}
              activeOpacity={0.9}
            >
              {c.avatar ? (
                <Image source={{ uri: c.avatar }} style={styles.chatAvatar} />
              ) : (
                <View style={[styles.chatAvatar, styles.photoPlaceholder]}>
                  <Text style={styles.placeholderText}>{c.name[0]?.toUpperCase()}</Text>
                </View>
              )}

              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.chatLast} numberOfLines={1}>
                  {c.lastMsg}
                </Text>
              </View>

              <View style={styles.rightCol}>
                <Text style={styles.chatTime}>{fmtTime(c.lastMessageAt)}</Text>
                {c.unread ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{c.unread}</Text>
                  </View>
                ) : (
                  <View style={{ height: 22 }} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {filteredChats.length === 0 && (
          <View style={styles.emptyChats}>
            <Text style={styles.emptyText}>no chats yet</Text>
            <Text style={styles.emptyHint}>say hi to a match</Text>
          </View>
        )}
      </ScrollView>

      {/* DETAILED PROFILE MODAL */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
            >
              {/* Photos with swipe */}
              {selected?.photos && selected.photos.length > 0 ? (
                <View style={styles.photoContainer}>
                  <FlatList
                    ref={photoScrollRef}
                    data={selected.photos}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onScroll={handlePhotoScroll}
                    scrollEventThrottle={16}
                    renderItem={({ item }) => (
                      <Image 
                        source={{ uri: item }} 
                        style={styles.modalPhoto} 
                        resizeMode="cover" 
                      />
                    )}
                    keyExtractor={(item, idx) => `photo-${idx}`}
                    contentContainerStyle={{ gap: 10 }}
                  />
                  {/* Photo indicators */}
                  {selected.photos.length > 1 && (
                    <View style={styles.photoIndicators}>
                      {selected.photos.map((_, idx) => (
                        <View
                          key={idx}
                          style={[
                            styles.photoIndicator,
                            currentPhotoIndex === idx && styles.photoIndicatorActive
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.modalPhoto, styles.photoPlaceholder, { marginHorizontal: 18, marginVertical: 8 }]}>
                  <Text style={[styles.placeholderText, { fontSize: 40 }]}>
                    {selected?.name?.[0]?.toUpperCase() ?? '?'}
                  </Text>
                </View>
              )}

              {/* Header */}
              <View style={styles.modalHeader}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.modalName}>
                    {selected?.name}
                    {selected?.age ? `, ${selected.age}` : ''}
                  </Text>
                  {selected?.city && (
                    <Text style={styles.modalCity}>{selected.city}</Text>
                  )}
                </View>
                {typeof selected?.compatibility === 'number' && (
                  <View style={styles.compBadge}>
                    <Text style={styles.compText}>{selected.compatibility}%</Text>
                    <Text style={styles.compCaption}>match</Text>
                  </View>
                )}
              </View>

              {/* Bio */}
              {selected?.bio && (
                <View style={styles.bioSection}>
                  <Text style={styles.bioText}>{selected.bio}</Text>
                </View>
              )}

              {/* Favorite genres */}
              {topGenres.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>favorite genres</Text>
                  <View style={styles.genresWrap}>
                    {topGenres.map((g) => (
                      <View key={g} style={styles.chip}>
                        <Text style={styles.chipText}>{g}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Favorite films */}
              {selected?.favorites && selected.favorites.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>favorite films</Text>
                  <View style={styles.posterRow}>
                    {selected.favorites.slice(0, 4).map((fav) => (
                      <View key={fav.id} style={styles.posterTile}>
                        {fav.poster ? (
                          <Image source={{ uri: fav.poster }} style={styles.posterImg} />
                        ) : (
                          <View style={[styles.posterImg, styles.photoPlaceholder]}>
                            <Text style={styles.placeholderTextSmall}>no{'\n'}image</Text>
                          </View>
                        )}
                        <Text style={styles.posterCaption} numberOfLines={2}>
                          {fav.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Recent watches */}
              {selected?.recentWatches && selected.recentWatches.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>recent watches</Text>
                  <View style={styles.genresWrap}>
                    {selected.recentWatches.slice(0, 6).map((r) => (
                      <View key={r.id} style={styles.chip}>
                        <Text style={styles.chipText}>{r.title.toLowerCase()}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.secondaryBtn]}
                  onPress={onRemoveMatch}
                >
                  <Text style={styles.modalBtnText}>remove match</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, styles.primaryBtn]}
                  onPress={onStartChat}
                >
                  <Text style={styles.modalBtnText}>start chat</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                style={styles.closeTap}
              >
                <Text style={styles.closeText}>close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { color: '#F0E4C1', opacity: 0.7, marginTop: 12, textTransform: 'lowercase' },

  sectionTitle: {
    color: '#F0E4C1',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'lowercase',
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 12,
  },

  matchesRow: { paddingHorizontal: 12, paddingBottom: 4 },
  matchTile: { width: 84, marginHorizontal: 4, alignItems: 'center' },
  matchPhoto: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(240,228,193,0.2)',
    marginBottom: 6,
  },
  matchName: { color: '#F0E4C1', fontSize: 12, textAlign: 'center', textTransform: 'lowercase' },
  compPill: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#511619',
    minWidth: 44,
    alignItems: 'center',
  },
  compPillText: { color: '#F0E4C1', fontSize: 12, fontWeight: '800', textTransform: 'lowercase' },

  searchWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  searchInput: {
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F0E4C1',
    textTransform: 'lowercase',
  },

  chatsList: { paddingHorizontal: 12, paddingTop: 6 },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240,228,193,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.1)',
    padding: 12,
    marginBottom: 10,
  },
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(240,228,193,0.15)',
  },
  chatName: { color: '#F0E4C1', fontWeight: '700', fontSize: 16, textTransform: 'lowercase' },
  chatLast: { color: '#F0E4C1', opacity: 0.75, fontSize: 13, marginTop: 2, textTransform: 'lowercase' },

  rightCol: { alignItems: 'flex-end', justifyContent: 'space-between', height: 36 },
  chatTime: { color: 'rgba(240,228,193,0.7)', fontSize: 12, marginBottom: 4 },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#511619',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: '#F0E4C1', fontSize: 12, fontWeight: '700' },

  emptyMatches: { paddingHorizontal: 20, paddingVertical: 32, alignItems: 'center' },
  emptyChats: { paddingHorizontal: 20, paddingTop: 20, alignItems: 'center' },
  emptyText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', marginBottom: 8, textTransform: 'lowercase' },
  emptyHint: { color: 'rgba(240,228,193,0.8)', fontSize: 14, marginBottom: 12, textTransform: 'lowercase' },

  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.95)', 
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#111C2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  photoContainer: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 8,
  },
  modalPhoto: { 
    width: SCREEN_WIDTH - 72, 
    height: 280, 
    backgroundColor: 'rgba(240,228,193,0.1)',
    borderRadius: 14,
  },
  photoIndicators: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  photoIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(240,228,193,0.3)',
  },
  photoIndicatorActive: {
    backgroundColor: '#F0E4C1',
    width: 24,
  },
  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    justifyContent: 'space-between', 
    padding: 16,
    paddingBottom: 8,
  },
  modalName: { 
    color: '#F0E4C1', 
    fontSize: 24, 
    fontWeight: '800', 
    textTransform: 'lowercase',
    marginBottom: 4,
  },
  modalCity: {
    color: 'rgba(240,228,193,0.8)',
    fontSize: 14,
    textTransform: 'lowercase',
  },

  compBadge: { 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    backgroundColor: '#511619', 
    borderRadius: 16, 
    minWidth: 70, 
    alignItems: 'center',
  },
  compText: { 
    color: '#F0E4C1', 
    fontSize: 24, 
    fontWeight: '900',
  },
  compCaption: {
    color: 'rgba(240,228,193,0.85)',
    fontSize: 10,
    textTransform: 'lowercase',
    marginTop: -2,
  },

  bioSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bioText: {
    color: '#F0E4C1',
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.95,
  },

  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionLabel: {
    color: '#F0E4C1',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'lowercase',
    marginBottom: 10,
  },

  genresWrap: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(240,228,193,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.26)',
  },
  chipText: { 
    color: '#F0E4C1', 
    fontWeight: '700', 
    fontSize: 13, 
    textTransform: 'lowercase',
  },

  posterRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    width: '100%',
  },
  posterTile: { 
    flex: 1,
    marginRight: 10,
  },
  posterImg: { 
    width: '100%', 
    aspectRatio: 2/3,
    borderRadius: 8, 
    backgroundColor: 'rgba(240,228,193,0.1)',
  },
  posterCaption: { 
    color: '#F0E4C1', 
    fontSize: 11, 
    marginTop: 6,
    textAlign: 'center',
  },

  modalButtons: { 
    flexDirection: 'row', 
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  modalBtn: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center', 
    borderWidth: 1,
  },
  primaryBtn: { 
    backgroundColor: '#511619', 
    borderColor: '#511619',
  },
  secondaryBtn: { 
    backgroundColor: 'transparent', 
    borderColor: 'rgba(240,228,193,0.3)',
  },
  modalBtnText: { 
    color: '#F0E4C1', 
    fontSize: 16, 
    fontWeight: '700', 
    textTransform: 'lowercase',
  },

  closeTap: { 
    marginTop: 12, 
    alignItems: 'center',
    paddingVertical: 8,
  },
  closeText: { 
    color: 'rgba(240,228,193,0.9)', 
    fontSize: 16, 
    textTransform: 'lowercase',
  },

  photoPlaceholder: { 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  placeholderText: { 
    color: 'rgba(240,228,193,0.6)', 
    fontSize: 16, 
    fontWeight: '800', 
    textTransform: 'uppercase',
  },
  placeholderTextSmall: {
    color: 'rgba(240,228,193,0.5)',
    fontSize: 9,
    textAlign: 'center',
  },
});