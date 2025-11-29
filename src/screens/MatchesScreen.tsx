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
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  doc, 
  deleteDoc, 
  updateDoc,
  arrayUnion,
  arrayRemove,
  getFirestore, 
  getDoc 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

import TMDbService from '../services/TMDbService';
import ProfileCard from '../components/ProfileCard';
import CustomAlert from '../components/CustomAlert';
import { COLORS } from '../theme';

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
  unread?: boolean;
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
  const isFocused = useIsFocused();
  const auth = getAuth();
  const db = getFirestore();
  const currentUser = auth.currentUser;

  const [newMatches, setNewMatches] = useState<NewMatch[]>([]);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<NewMatch | null>(null);
  const [menuChat, setMenuChat] = useState<ChatRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  const [alert, setAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

  useEffect(() => {
    if (!currentUser) return;
    const blocksRef = collection(db, 'user_blocks');
    const q = query(blocksRef, where('blockerId', '==', currentUser.uid));
    const unsubscribeBlocks = onSnapshot(q, (snapshot) => {
      const newBlocks = new Set<string>();
      snapshot.forEach(doc => { 
        newBlocks.add(doc.data().blockedId); 
      });
      setBlockedUserIds(newBlocks);
    });
    return () => unsubscribeBlocks();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    
    // Only load matches if the screen is focused to ensure fresh data
    if (isFocused) {
      loadMatches();
    }

    const chatsRef = collection(db, 'chats');
    const chatsQ = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
    const unsubscribeChats = onSnapshot(chatsQ, async (snapshot) => {
      const chatRows: ChatRow[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
        if (!otherUserId) continue;
        if (blockedUserIds.has(otherUserId)) continue;

        try {
          const otherUserProfileSnap = await getDoc(doc(db, 'users', otherUserId));
          if (otherUserProfileSnap.exists()) {
            const profile = otherUserProfileSnap.data();
            const isLastSenderMe = data.lastSenderId === currentUser.uid;
            const explicitlyUnread = data.markedUnreadBy?.includes(currentUser.uid);
            const readBy = data.readBy || [];

            const isUnread = (!isLastSenderMe && !readBy.includes(currentUser.uid)) || explicitlyUnread;
            
            chatRows.push({
              id: docSnap.id,
              chatId: docSnap.id,
              name: profile.displayName || 'unknown',
              avatar: profile.photos?.[0],
              lastMsg: data.lastMessage || 'no messages yet',
              lastMessageAt: data.lastMessageTime?.toMillis() || data.createdAt?.toMillis() || Date.now(),
              lastSenderId: data.lastSenderId,
              unread: isUnread,
              otherUserId,
            });
          }
        } catch (err) {
          console.log('Error fetching chat user profile:', err);
        }
      }
      chatRows.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
      setChats(chatRows);
      setLoading(false);
    });
    return () => unsubscribeChats();
  }, [currentUser, blockedUserIds, isFocused]);

  const loadMatches = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
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
        if (blockedUserIds.has(matchedUserId)) continue;
        try {
          const snap = await getDoc(doc(db, 'users', matchedUserId));
          if (snap.exists()) {
            const matchedProfile = snap.data();
            matchProfiles.push({
              uid: matchedProfile.uid,
              name: matchedProfile.displayName || 'anonymous',
              age: matchedProfile.age,
              city: matchedProfile.city,
              compatibility: 85,
              photo: matchedProfile.photos?.[0],
              photos: matchedProfile.photos || [],
              bio: matchedProfile.bio,
              favorites: matchedProfile.favorites || [],
              recentWatches: matchedProfile.recentWatches || [],
              genreRatings: matchedProfile.genreRatings,
            });
          }
        } catch (err) {
          console.log('Error fetching match profile:', err);
        }
      }
      setNewMatches(matchProfiles);
    } catch (error) {
      console.log('Matches load error', error);
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

  const toggleReadStatus = async () => {
    if (!currentUser || !menuChat) return;
    try {
      const chatRef = doc(db, 'chats', menuChat.chatId);
      if (menuChat.unread) {
        await updateDoc(chatRef, { 
            markedUnreadBy: arrayRemove(currentUser.uid),
            readBy: arrayUnion(currentUser.uid)
        });
      } else {
        await updateDoc(chatRef, { markedUnreadBy: arrayUnion(currentUser.uid) });
      }
      setChats((prevChats) =>
        prevChats.map((c) =>
          c.chatId === menuChat.chatId ? { ...c, unread: !c.unread } : c
        )
      );
    } catch (error) {
      console.log('Error updating read status:', error);
    } finally {
      setMenuChat(null);
    }
  };

  const handleDeleteChat = () => {
    const chatIdToDelete = menuChat?.chatId;
    setMenuChat(null);
    if (!chatIdToDelete) return;

    setTimeout(() => {
      setAlert({
        visible: true,
        title: 'delete conversation?',
        message: 'this cannot be undone',
        buttons: [
          { 
            text: 'delete', 
            style: 'destructive', 
            onPress: async () => {
              setAlert({ ...alert, visible: false });
              try { 
                await deleteDoc(doc(db, 'chats', chatIdToDelete)); 
              } catch (e) { 
                console.log('Error deleting chat:', e); 
              }
            }
          },
          { 
            text: 'cancel', 
            style: 'cancel', 
            onPress: () => setAlert({ ...alert, visible: false }) 
          }
        ]
      });
    }, 200);
  };

  const onPressNewMatch = async (item: NewMatch) => {
    setSelectedMatch(item);
    setProfileModalOpen(true);
    const enriched = await TMDbService.enrichProfile(item);
    if (enriched && enriched.uid === item.uid) {
      setSelectedMatch({ ...enriched, compatibility: item.compatibility });
    }
  };

  const onStartChat = async () => {
    if (!selectedMatch || !currentUser) return;
    const sortedIds = [currentUser.uid, selectedMatch.uid].sort();
    const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;
    setProfileModalOpen(false);
    navigation.navigate('Chat', { chatId });
  };

  const onRemoveMatch = () => {
    if (!selectedMatch || !currentUser) return;
    const uidToRemove = selectedMatch.uid;
    const nameToRemove = selectedMatch.name;

    setAlert({
      visible: true,
      title: 'remove match?',
      message: `unmatch with ${nameToRemove}`,
      buttons: [
        { 
          text: 'remove', 
          style: 'destructive', 
          onPress: async () => {
            setAlert({ ...alert, visible: false });
            try {
              setNewMatches((prev) => prev.filter((m) => m.uid !== uidToRemove));
              setProfileModalOpen(false);
              const sortedIds = [currentUser.uid, uidToRemove].sort();
              const matchId = `match_${sortedIds[0]}_${sortedIds[1]}`;
              await deleteDoc(doc(db, 'matches', matchId));
              setSelectedMatch(null);
            } catch (e) {
              console.log('Error removing match:', e);
            }
          }
        },
        { 
          text: 'cancel', 
          style: 'cancel', 
          onPress: () => setAlert({ ...alert, visible: false }) 
        }
      ]
    });
  };

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
        <ActivityIndicator size="large" color={COLORS.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingBottom: 20, paddingTop: 12 }} 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.text} />}
      >
        {newMatches.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>new matches</Text>
            <FlatList
              data={newMatches}
              horizontal
              keyExtractor={(i) => i.uid}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.matchTile} 
                  onPress={() => onPressNewMatch(item)} 
                  activeOpacity={0.9}
                >
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

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>chats</Text>
        <View style={styles.chatsList}>
          {filteredChats.map((c) => (
            <TouchableOpacity 
              key={c.id} 
              style={styles.chatRow} 
              onPress={() => navigation.navigate('Chat', { chatId: c.chatId })} 
              onLongPress={() => setMenuChat(c)}
              activeOpacity={0.7} 
              delayLongPress={500}
            >
              {c.avatar ? (
                <Image source={{ uri: c.avatar }} style={styles.chatAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.chatAvatar, styles.photoPlaceholder]}>
                  <Text style={styles.placeholderText}>{c.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.chatName, c.unread && styles.boldText]} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={[styles.chatLast, c.unread && styles.boldText]} numberOfLines={1}>
                  {c.lastMsg}
                </Text>
              </View>
              <View style={styles.rightCol}>
                <Text style={styles.chatTime}>{fmtTime(c.lastMessageAt)}</Text>
                {c.unread && <View style={styles.unreadDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Modal 
        visible={profileModalOpen} 
        animationType="fade" 
        transparent={true} 
        onRequestClose={() => setProfileModalOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setProfileModalOpen(false)}
        >
          <View style={styles.modalCenter} onStartShouldSetResponder={() => true}>
            <ProfileCard profile={selectedMatch} footer={renderCardFooter()} />
          </View>
        </TouchableOpacity>
      </Modal>

      <CustomAlert 
        visible={!!menuChat} 
        title={menuChat?.name || 'Chat'}
        buttons={[
          { 
            text: menuChat?.unread ? 'mark as read' : 'mark as unread', 
            style: 'default', 
            onPress: toggleReadStatus 
          },
          { 
            text: 'delete chat', 
            style: 'destructive', 
            onPress: handleDeleteChat 
          },
          { 
            text: 'cancel', 
            style: 'cancel', 
            onPress: () => setMenuChat(null) 
          }
        ]}
        onRequestClose={() => setMenuChat(null)}
      />

      <CustomAlert 
        visible={alert.visible} 
        title={alert.title} 
        message={alert.message} 
        buttons={alert.buttons} 
        onRequestClose={() => setAlert({ ...alert, visible: false })} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bg 
  },
  
  sectionTitle: { 
    color: COLORS.text, 
    fontSize: 18, 
    fontWeight: '700', 
    marginLeft: 20, 
    marginBottom: 12, 
    marginTop: 16, 
    textTransform: 'lowercase' 
  },
  
  matchesRow: { 
    paddingHorizontal: 16 
  },
  matchTile: { 
    width: 80, 
    marginRight: 12, 
    alignItems: 'center' 
  },
  matchPhoto: { 
    width: 70, 
    height: 70, 
    borderRadius: 35, 
    backgroundColor: '#1a2634', 
    marginBottom: 6, 
    borderWidth: 2, 
    borderColor: COLORS.border 
  },
  matchName: { 
    color: COLORS.text, 
    fontSize: 12, 
    textAlign: 'center', 
    textTransform: 'lowercase' 
  },
  compPill: { 
    marginTop: 4, 
    backgroundColor: COLORS.button, 
    borderRadius: 10, 
    paddingHorizontal: 8, 
    paddingVertical: 2 
  },
  compPillText: { 
    color: COLORS.text, 
    fontSize: 10, 
    fontWeight: '700' 
  },

  searchWrap: { 
    paddingHorizontal: 20, 
    marginTop: 16 
  },
  searchInput: { 
    backgroundColor: 'rgba(240,228,193,0.08)', 
    borderRadius: 12, 
    padding: 12, 
    color: COLORS.text, 
    fontSize: 16 
  },

  chatsList: { 
    paddingHorizontal: 20, 
    marginTop: 8 
  },
  chatRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(240,228,193,0.05)', 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 8 
  },
  chatAvatar: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#1a2634', 
    marginRight: 12 
  },
  chatName: { 
    color: COLORS.text, 
    fontSize: 16, 
    fontWeight: '700', 
    textTransform: 'lowercase' 
  },
  chatLast: { 
    color: 'rgba(240,228,193,0.6)', 
    fontSize: 13, 
    marginTop: 2 
  },
  rightCol: { 
    marginLeft: 'auto', 
    alignItems: 'flex-end' 
  },
  chatTime: { 
    color: 'rgba(240,228,193,0.4)', 
    fontSize: 11 
  },
  
  unreadDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: COLORS.button, 
    marginTop: 6 
  },
  boldText: { 
    fontWeight: 'bold', 
    color: COLORS.text 
  },

  emptyMatches: { 
    padding: 20, 
    alignItems: 'center' 
  },
  emptyText: { 
    color: COLORS.text, 
    fontWeight: 'bold' 
  },
  emptyHint: { 
    color: 'rgba(240,228,193,0.5)', 
    fontSize: 12, 
    marginTop: 4 
  },

  photoPlaceholder: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(240,228,193,0.1)' 
  },
  placeholderText: { 
    color: 'rgba(240,228,193,0.3)', 
    fontSize: 24, 
    fontWeight: 'bold' 
  },

  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(17,28,42,0.95)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalCenter: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalButtons: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 10, 
    width: '100%' 
  },
  modalBtn: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center', 
    borderWidth: 1 
  },
  primaryBtn: { 
    backgroundColor: COLORS.button, 
    borderColor: COLORS.button 
  },
  secondaryBtn: { 
    borderColor: 'rgba(240,228,193,0.3)' 
  },
  modalBtnText: { 
    color: COLORS.text, 
    fontWeight: '700', 
    fontSize: 16, 
    textTransform: 'lowercase' 
  },
});