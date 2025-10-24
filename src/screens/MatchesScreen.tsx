// src/screens/MatchesScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';

type NewMatch = {
  id: string;
  name: string;
  photo?: string;
  age?: number;
  location?: string;
  compatibility: number; // %
  photos?: string[];
};

type ChatRow = {
  id: string;
  name: string;
  avatar?: string;
  lastMsg: string;
  lastMessageAt: number; // ms
  unread?: number;
};

const NEW_MATCHES_SEED: NewMatch[] = [
  {
    id: 'm1',
    name: 'alex',
    compatibility: 96,
    age: 27,
    location: 'istanbul',
    photo: 'https://placekitten.com/220/220',
    photos: ['https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=900&auto=format&fit=crop'],
  },
  {
    id: 'm2',
    name: 'jordan',
    compatibility: 90,
    age: 25,
    location: 'ankara',
    photo: 'https://placekitten.com/230/230',
    photos: ['https://images.unsplash.com/photo-1527980965255-d3b416303d12?q=80&w=900&auto=format&fit=crop'],
  },
  {
    id: 'm3',
    name: 'sam',
    compatibility: 88,
    age: 29,
    location: 'izmir',
    photo: 'https://placekitten.com/240/240',
    photos: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=900&auto=format&fit=crop'],
  },
];

const CHATS_SEED: ChatRow[] = [
  {
    id: 'c1',
    name: 'mia',
    lastMsg: 'see dune this weekend?',
    lastMessageAt: Date.now() - 1000 * 60 * 5,
    unread: 2,
    avatar: 'https://placekitten.com/250/250',
  },
  {
    id: 'c2',
    name: 'sam',
    lastMsg: 'parasite was amazing',
    lastMessageAt: Date.now() - 1000 * 60 * 50,
    avatar: 'https://placekitten.com/260/260',
  },
  {
    id: 'c3',
    name: 'lena',
    lastMsg: 'i loved moonlight',
    lastMessageAt: Date.now() - 1000 * 60 * 80,
    avatar: 'https://placekitten.com/270/270',
  },
];

const fmtTime = (ts: number) => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export default function MatchesScreen() {
  const navigation = useNavigation<any>();

  const [newMatches, setNewMatches] = useState<NewMatch[]>(NEW_MATCHES_SEED);
  const [chats, setChats] = useState<ChatRow[]>(CHATS_SEED);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<NewMatch | null>(null);

  const sortedMatches = useMemo(
    () => [...newMatches].sort((a, b) => b.compatibility - a.compatibility),
    [newMatches]
  );
  const sortedChats = useMemo(() => [...chats].sort((a, b) => b.lastMessageAt - a.lastMessageAt), [chats]);

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
    setModalOpen(true);
  };
  const onStartChat = () => {
    if (!selected) return;
    setModalOpen(false);
    navigation.navigate('Chat', { chatId: `thread_${selected.id}` });
  };
  const onRemoveMatch = () => {
    if (!selected) return;
    Alert.alert('remove match', `remove ${selected.name}?`, [
      { text: 'cancel', style: 'cancel' },
      {
        text: 'remove',
        style: 'destructive',
        onPress: () => {
          setNewMatches((prev) => prev.filter((m) => m.id !== selected.id));
          setModalOpen(false);
          setSelected(null);
        },
      },
    ]);
  };
  const onLongPressChat = (id: string) => {
    Alert.alert('delete chat', 'this will delete the chat from your list.', [
      { text: 'cancel', style: 'cancel' },
      { text: 'delete', style: 'destructive', onPress: () => setChats((prev) => prev.filter((c) => c.id !== id)) },
    ]);
  };

  const hasMatches = newMatches.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
        {/* new matches */}
        {hasMatches && (
          <>
            <Text style={styles.sectionTitle}>new matches</Text>
            <FlatList
              data={sortedMatches}
              horizontal
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.matchTile} onPress={() => onPressNewMatch(item)} activeOpacity={0.9}>
                  {item.photo ? (
                    <Image source={{ uri: item.photo }} style={styles.matchPhoto} />
                  ) : (
                    <View style={[styles.matchPhoto, styles.photoPlaceholder]}>
                      <Text style={styles.placeholderText}>{item.name[0]}</Text>
                    </View>
                  )}
                  <Text style={styles.matchName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {/* compatibility pill */}
                  <View style={styles.compPill}>
                    <Text style={styles.compPillText}>{item.compatibility}%</Text>
                  </View>
                </TouchableOpacity>
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.matchesRow}
            />
          </>
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
              onPress={() => navigation.navigate('Chat', { chatId: c.id })}
              onLongPress={() => onLongPressChat(c.id)}
              activeOpacity={0.9}
            >
              {c.avatar ? (
                <Image source={{ uri: c.avatar }} style={styles.chatAvatar} />
              ) : (
                <View style={[styles.chatAvatar, styles.photoPlaceholder]}>
                  <Text style={styles.placeholderText}>{c.name[0]}</Text>
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

              {/* RIGHT COLUMN: time over unread badge */}
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
            <TouchableOpacity
              onPress={() => navigation.getParent()?.navigate('Match' as never)}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>go to match</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* mini profile modal */}
      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => setModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {selected?.photos?.[0] || selected?.photo ? (
              <Image source={{ uri: selected?.photos?.[0] || selected?.photo! }} style={styles.modalPhoto} />
            ) : (
              <View style={[styles.modalPhoto, styles.photoPlaceholder]}>
                <Text style={styles.placeholderText}>{selected?.name?.[0] ?? '?'}</Text>
              </View>
            )}

            <View style={styles.modalHeader}>
              <Text style={styles.modalName}>
                {selected?.name}
                {selected?.age ? `, ${selected.age}` : ''}
                {selected?.location ? ` • ${selected.location}` : ''}
              </Text>
              {typeof selected?.compatibility === 'number' && (
                <View style={styles.compBadge}>
                  <Text style={styles.compText}>{selected.compatibility}%</Text>
                </View>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalBtn, styles.secondaryBtn]} onPress={onRemoveMatch}>
                <Text style={styles.modalBtnText}>remove match</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn]} onPress={onStartChat}>
                <Text style={styles.modalBtnText}>start chat</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setModalOpen(false)} style={styles.closeTap}>
              <Text style={styles.closeText}>close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },

  sectionTitle: {
    color: '#F0E4C1',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'lowercase',
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 12,
  },

  // new matches row
  matchesRow: { paddingHorizontal: 12, paddingBottom: 4 },
  matchTile: { width: 84, marginHorizontal: 4, alignItems: 'center' },
  matchPhoto: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.18)',
    marginBottom: 6,
  },
  matchName: { color: '#F0E4C1', fontSize: 12, textAlign: 'center', textTransform: 'lowercase' },
  // NEW: pill background for compatibility
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

  // search
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

  // chats list
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
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: 'rgba(240,228,193,0.08)',
  },
  chatName: { color: '#F0E4C1', fontWeight: '700', fontSize: 16, textTransform: 'lowercase' },
  chatLast: { color: '#F0E4C1', opacity: 0.75, fontSize: 13, marginTop: 2, textTransform: 'lowercase' },

  // right column (time over badge)
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

  // empty state
  emptyChats: { paddingHorizontal: 20, paddingTop: 20, alignItems: 'center' },
  emptyText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', marginBottom: 8, textTransform: 'lowercase' },
  emptyHint: { color: 'rgba(240,228,193,0.8)', fontSize: 14, marginBottom: 12, textTransform: 'lowercase' },
  ctaButton: { backgroundColor: '#511619', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  ctaText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },

  // modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1A2B3D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.2)',
    padding: 16,
  },
  modalPhoto: { width: '100%', height: 200, borderRadius: 12, marginBottom: 12, backgroundColor: 'rgba(240,228,193,0.1)' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalName: { color: '#F0E4C1', fontSize: 18, fontWeight: '800', textTransform: 'lowercase', flex: 1, paddingRight: 8 },

  compBadge: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#511619', borderRadius: 14, minWidth: 64, alignItems: 'center' },
  compText: { color: '#F0E4C1', fontSize: 16, fontWeight: '900', textTransform: 'lowercase' },

  modalButtons: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  primaryBtn: { backgroundColor: '#511619', borderColor: '#511619' },
  secondaryBtn: { backgroundColor: 'transparent', borderColor: 'rgba(240,228,193,0.3)' },
  modalBtnText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },

  closeTap: { marginTop: 12, alignItems: 'center' },
  closeText: { color: 'rgba(240,228,193,0.9)', fontSize: 14, textTransform: 'lowercase' },

  // placeholders
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: 'rgba(240,228,193,0.6)', fontSize: 16, fontWeight: '800', textTransform: 'uppercase' },
});
