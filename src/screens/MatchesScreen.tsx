// src/screens/MatchesScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  doc, 
  deleteDoc, 
  getFirestore, 
  getDoc 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// IMPORT SERVICES
import TMDbService from '../services/TMDbService';
import ProfileCard from '../components/ProfileCard'; // <--- SHARED COMPONENT

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Types (Preserved)
type NewMatch = {
  uid: string;
  name: string;
  photo?: string;
  age?: number;
  city?: string;
  compatibility: number;
  photos?: string[];
  bio?: string;
  favorites?: any[];
  recentWatches?: any[];
  genreRatings?: any[];
};

type ChatRow = {
  id: string;
  chatId: string;
  name: string;
  avatar?: string;
  lastMsg: string;
  lastMessageAt: number;
  lastSenderId?: string;
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
  const auth = getAuth();
  const db = getFirestore();
  const currentUser = auth.currentUser;

  const [newMatches, setNewMatches] = useState<NewMatch[]>([]);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<NewMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMatches();
    
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    // Listen for Chats
    const chatsRef = collection(db, 'chats');
    const chatsQ = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(chatsQ, async (snapshot) => {
        const chatRows: ChatRow[] = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
          if (!otherUserId) continue;

          try {
            const otherUserProfileSnap = await getDoc(doc(db, 'users', otherUserId));
            if (otherUserProfileSnap.exists()) {
                const profile = otherUserProfileSnap.data();
                chatRows.push({
                    id: docSnap.id,
                    chatId: docSnap.id,
                    name: profile.displayName || 'unknown',
                    avatar: profile.photos?.[0],
                    lastMsg: data.lastMessage || 'no messages yet',
                    lastMessageAt: data.lastMessageTime?.toMillis() || data.createdAt?.toMillis() || Date.now(),
                    lastSenderId: data.lastSenderId,
                    unread: 0,
                    otherUserId,
                });
            }
          } catch (err) {}
        }
        // Sort chats by newest first
        chatRows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        setChats(chatRows);
      });

    return () => unsubscribe();
  }, [currentUser]);

  const loadMatches = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      if (!currentUser) return;

      const matchesRef = collection(db, 'matches');
      const q1 = query(matchesRef, where('user1Id', '==', currentUser.uid));
      const q2 = query(matchesRef, where('user2Id', '==', currentUser.uid));
      
      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const matchedUserIds = new Set<string>();
      snapshot1.forEach(doc => matchedUserIds.add((doc.data() as any).user2Id));
      snapshot2.forEach(doc => matchedUserIds.add((doc.data() as any).user1Id));
      
      const matchProfiles: NewMatch[] = [];

      for (const matchedUserId of matchedUserIds) {
        try {
          const snap = await getDoc(doc(db, 'users', matchedUserId));
          if (snap.exists()) {
            const matchedProfile = snap.data();
            
            // Basic data structure
            matchProfiles.push({
              uid: matchedProfile.uid,
              name: matchedProfile.displayName || 'anonymous',
              age: matchedProfile.age,
              city: matchedProfile.city,
              compatibility: 85, // You can use MatchingService.calculateCompatibility here if available
              photo: matchedProfile.photos?.[0],
              photos: matchedProfile.photos || [],
              bio: matchedProfile.bio,
              favorites: matchedProfile.favorites || [],
              recentWatches: matchedProfile.recentWatches || [],
              genreRatings: matchedProfile.genreRatings,
            });
          }
        } catch (err) {}
      }

      setNewMatches(matchProfiles);
    } catch (error) {
      Alert.alert('error', 'failed to load matches');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => loadMatches(true);

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.name.toLowerCase().includes(q));
  }, [chats, searchQuery]);

  const onPressNewMatch = async (item: NewMatch) => {
    // 1. Show modal immediately with existing data
    setSelected(item);
    setModalOpen(true);

    // 2. Fetch missing posters in the background using TMDbService
    const enriched = await TMDbService.enrichProfile(item);
    
    // 3. Update state if the modal is still open for this user
    if (enriched && enriched.uid === item.uid) {
        setSelected(enriched);
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
    if (!selected || !currentUser) return;
    Alert.alert('remove match', `remove ${selected.name}?`, [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setNewMatches((prev) => prev.filter((m) => m.uid !== selected.uid));
            setModalOpen(false);
            const sortedIds = [currentUser.uid, selected.uid].sort();
            const matchId = `match_${sortedIds[0]}_${sortedIds[1]}`;
            // NOTE: This assumes match IDs are constructed deterministically. 
            // If they are random, you might need to query for the match doc ID first.
            await deleteDoc(doc(db, 'matches', matchId));
          } catch (e) {}
          setSelected(null);
        },
      },
    ]);
  };

  const isUnread = (chat: ChatRow) => chat.lastSenderId && chat.lastSenderId !== currentUser?.uid;

  // Custom Footer for the ProfileCard
  const renderCardFooter = () => (
    <View style={styles.modalButtons}>
        <TouchableOpacity style={[styles.modalBtn, styles.secondaryBtn]} onPress={onRemoveMatch}>
            <Text style={styles.modalBtnText}>remove</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn]} onPress={onStartChat}>
            <Text style={styles.modalBtnText}>chat</Text>
        </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#F0E4C1" />
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
        {newMatches.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>new matches</Text>
            <FlatList
              data={newMatches}
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
                    <Text style={styles.compPillText}>{item.compatibility || 0}%</Text>
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

        <View style={styles.searchWrap}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="search chats…"
            placeholderTextColor="rgba(240,228,193,0.5)"
            style={styles.searchInput}
          />
        </View>

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
                <Text style={[styles.chatName, isUnread(c) && styles.boldText]} numberOfLines={1}>{c.name}</Text>
                <Text style={[styles.chatLast, isUnread(c) && styles.boldText]} numberOfLines={1}>{c.lastMsg}</Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.chatTime}>{fmtTime(c.lastMessageAt)}</Text>
                {isUnread(c) && <View style={styles.unreadDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* NEW MODAL USING SHARED PROFILE CARD */}
      <Modal 
        visible={modalOpen} 
        animationType="fade" 
        transparent={true}
        onRequestClose={() => setModalOpen(false)}
      >
        <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setModalOpen(false)}
        >
            <View style={styles.modalCenter} onStartShouldSetResponder={() => true}>
                 <ProfileCard 
                    profile={selected} 
                    footer={renderCardFooter()} 
                 />
            </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
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
  rightCol: { marginLeft: 'auto', alignItems: 'flex-end' },
  chatTime: { color: 'rgba(240,228,193,0.4)', fontSize: 11 },
  
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#511619', marginTop: 6 },
  boldText: { fontWeight: 'bold', color: '#F0E4C1' },

  emptyMatches: { padding: 20, alignItems: 'center' },
  emptyText: { color: '#F0E4C1', fontWeight: 'bold' },
  emptyHint: { color: 'rgba(240,228,193,0.5)', fontSize: 12, marginTop: 4 },

  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,228,193,0.1)' },
  placeholderText: { color: 'rgba(240,228,193,0.3)', fontSize: 24, fontWeight: 'bold' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,28,42,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCenter: { justifyContent: 'center', alignItems: 'center' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 10, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  primaryBtn: { backgroundColor: '#511619', borderColor: '#511619' },
  secondaryBtn: { borderColor: 'rgba(240,228,193,0.3)' },
  modalBtnText: { color: '#F0E4C1', fontWeight: '700', fontSize: 16, textTransform: 'lowercase' },
});