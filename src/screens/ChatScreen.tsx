// src/screens/ChatScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getAuth } from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../../config/firebase';

type Message = {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any;
  createdAt: Date;
};

type ChatUser = {
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
};

export default function ChatScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const auth = getAuth();
  const currentUser = auth.currentUser;
  const chatId = route?.params?.chatId;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatUser, setChatUser] = useState<ChatUser | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!currentUser) {
      Alert.alert('error', 'you must be logged in to chat');
      navigation.goBack();
      return;
    }
    if (!chatId) {
      Alert.alert('error', 'invalid chat id');
      navigation.goBack();
      return;
    }
    initializeChat();
    const unsub = setupMessageListener();
    return () => unsub && unsub();
  }, [chatId, currentUser]);

  const initializeChat = async () => {
    try {
      // TODO: replace with real other user lookup
      const mockUser: ChatUser = {
        id: 'mock-user',
        displayName: 'alex',
        email: 'alex@example.com',
        photoURL: 'https://placekitten.com/200/200',
      };
      setChatUser(mockUser);

      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      if (currentUser && !chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [currentUser.uid, mockUser.id],
          createdAt: serverTimestamp(),
          lastMessage: null,
          lastMessageTime: null,
        });
      }
    } catch (e) {
      console.error('init chat error', e);
      Alert.alert('error', 'failed to initialize chat');
    }
  };

  const setupMessageListener = () => {
    if (!chatId) return;
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('timestamp', 'asc'));
    return onSnapshot(
      messagesQuery,
      (snapshot) => {
        const next: Message[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as any;
          next.push({
            id: d.id,
            text: data.text,
            senderId: data.senderId,
            senderName: (data.senderName || 'user') as string,
            timestamp: data.timestamp,
            createdAt: data.timestamp?.toDate() || new Date(),
          });
        });
        setMessages(next);
        setLoading(false);
        requestAnimationFrame(() => flatListRef.current?.scrollToEnd({ animated: true }));
      },
      (err) => {
        console.error('listen error', err);
        Alert.alert('error', 'failed to load messages');
        setLoading(false);
      }
    );
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser || !chatId || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text,
        senderId: currentUser.uid,
        senderName: (currentUser.displayName || 'you').toLowerCase(),
        timestamp: serverTimestamp(),
      });
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, { lastMessage: text, lastMessageTime: serverTimestamp() });
    } catch (e) {
      console.error('send error', e);
      Alert.alert('error', 'failed to send message');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === currentUser?.uid;
    const showTime =
      index === 0 || Math.abs(item.createdAt.getTime() - messages[index - 1].createdAt.getTime()) > 60_000;

    return (
      <View style={styles.msgBlock}>
        {showTime && <Text style={styles.timeStamp}>{fmtTime(item.createdAt)}</Text>}
        <View style={[styles.msgRow, isMe ? styles.rowMe : styles.rowThem]}>
          {/* removed avatars in bubbles for a cleaner look */}
          <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.msgText, isMe ? styles.textMe : styles.textThem]}>{item.text}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#e6edf3" />
          <Text style={styles.loadingText}>loading chat…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <StatusBar style="light" />

      {/* header (name + single photo) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹ back</Text>
        </TouchableOpacity>

        <View style={styles.headerMid}>
          <Image
            source={{ uri: chatUser?.photoURL || 'https://placekitten.com/160/160' }}
            style={styles.headerAvatarLg}
          />
          <Text style={styles.headerTitle}>{chatUser?.displayName || 'chat'}</Text>
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* content + input; dark keyboard; no gap */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(it) => it.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listPad}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>start the conversation</Text>
              <Text style={styles.emptyHint}>say hello to {chatUser?.displayName || 'your match'}!</Text>
            </View>
          }
        />

        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="type a message…"
            placeholderTextColor="rgba(230, 237, 243, 0.5)"
            multiline
            maxLength={500}
            editable={!sending}
            keyboardAppearance="dark"   // 👈 dark keyboard (iOS)
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendText}>send</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const C = {
  bg: '#0d1117',
  card: '#11161d',
  text: '#e6edf3',
  sub: 'rgba(230,237,243,0.7)',
  accent: '#1C6F75',
  me: '#2ea043',
  them: 'rgba(230,237,243,0.1)',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(230, 237, 243, 0.1)',
  },
  backText: { color: C.sub, fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
  headerMid: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatarLg: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(230,237,243,0.15)' },
  headerTitle: { color: C.text, fontSize: 16, fontWeight: '800', textTransform: 'lowercase' },

  listPad: { padding: 16, paddingBottom: 8 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: C.text, marginTop: 12, opacity: 0.7, textTransform: 'lowercase' },

  // empty
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginBottom: 6, textTransform: 'lowercase' },
  emptyHint: { color: C.sub, fontSize: 14, textTransform: 'lowercase' },

  msgBlock: { marginBottom: 10 },
  timeStamp: { color: C.sub, fontSize: 12, textAlign: 'center', marginBottom: 6 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMe: { justifyContent: 'flex-end' },
  rowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleMe: { backgroundColor: C.me, alignSelf: 'flex-end' },
  bubbleThem: { backgroundColor: C.them, alignSelf: 'flex-start' },
  msgText: { fontSize: 16, lineHeight: 20, textTransform: 'none' },
  textMe: { color: '#fff' },
  textThem: { color: C.text },

  inputRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(230, 237, 243, 0.1)',
    alignItems: 'flex-end',
    backgroundColor: C.bg,
  },
  textInput: {
    flex: 1,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: 'rgba(230, 237, 243, 0.2)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
    textTransform: 'none',
  },
  sendBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '800', fontSize: 14, textTransform: 'lowercase' },
});
