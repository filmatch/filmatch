// src/screens/ChatScreen.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  getFirestore,
} from 'firebase/firestore';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { NotificationService } from '../services/NotificationService';
import TMDbService from '../services/TMDbService'; // Import TMDbService
import ProfileCard from '../components/ProfileCard'; // Import Shared Card

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
};

const fmtTime = (timestamp: any) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const mins = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${mins}`;
};

export default function ChatScreen() {
  const route = useRoute();
  const navigation = useNavigation<any>();
  const { chatId } = route.params as any;
  const currentUser = FirebaseAuthService.getCurrentUser();
  const db = getFirestore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<any | null>(null);
  const flatListRef = useRef<FlatList>(null);
  
  const [profileModalVisible, setProfileModalVisible] = useState(false);

  useEffect(() => {
    if (!currentUser || !chatId) return;
    loadOtherUserProfile();
    NotificationService.clearChatNotification(currentUser.uid, chatId).catch((err) => {
      console.log('Could not clear notification:', err);
    });
    
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
          const loadedMessages: Message[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            loadedMessages.push({
              id: doc.id,
              text: data.text,
              senderId: data.senderId,
              createdAt: data.createdAt,
            });
          });

          setMessages(loadedMessages);
          setLoading(false);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        },
        (error) => {
          console.error('Error loading messages:', error);
          setLoading(false);
        }
      );

      return () => unsubscribe();
  }, [chatId, currentUser]);

  const loadOtherUserProfile = async () => {
    if (!currentUser || !chatId) return;

    try {
      const userIds = chatId.replace('chat_', '').split('_');
      const otherUserId = userIds.find(id => id !== currentUser.uid);
      
      if (!otherUserId) return;

      let profile = await FirestoreService.getUserProfile(otherUserId);
      if (profile) {
        // Automatically fetch missing posters for the profile card
        profile = await TMDbService.enrichProfile(profile);
        setOtherUser(profile);
      }
    } catch (error) {
      console.error('Error loading other user:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !currentUser || !chatId || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);
      
      const chatData = {
          lastMessage: messageText,
          lastMessageTime: serverTimestamp(),
          lastSenderId: currentUser.uid, 
          participants: chatId.replace('chat_', '').split('_')
      };

      if (!chatDoc.exists()) {
        await setDoc(chatRef, { ...chatData, createdAt: serverTimestamp() });
      } else {
        await updateDoc(chatRef, chatData);
      }

      const messagesRef = collection(db, 'chats', chatId, 'messages');
      await addDoc(messagesRef, {
        text: messageText,
        senderId: currentUser.uid,
        createdAt: serverTimestamp(),
      });

      if (otherUser) {
        const currentUserProfile = await FirestoreService.getUserProfile(currentUser.uid);
        await NotificationService.createMessageNotification(
          otherUser.uid,
          currentUser.uid,
          currentUserProfile?.displayName || 'Someone',
          currentUserProfile?.photos?.[0],
          messageText,
          chatId
        );
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      setInputText(messageText); 
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.senderId === currentUser?.uid;
    const showTime = index === 0 || 
      (messages[index - 1]?.senderId !== item.senderId);

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.text}
          </Text>
          {showTime && (
            <Text
              style={[
                styles.messageTime,
                isMyMessage ? styles.myMessageTime : styles.theirMessageTime,
              ]}
            >
              {fmtTime(item.createdAt)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F0E4C1" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        
        {/* OPEN PROFILE MODAL ON CLICK */}
        <TouchableOpacity style={styles.headerProfile} onPress={() => setProfileModalVisible(true)}>
            {otherUser?.photos?.[0] ? (
            <Image source={{ uri: otherUser.photos[0] }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
            <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>
                {otherUser?.displayName?.[0]?.toUpperCase() || '?'}
                </Text>
            </View>
            )}
            
            <Text style={styles.headerName}>
            {otherUser?.displayName || 'Chat'}
            </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>no messages yet</Text>
            <Text style={styles.emptyHint}>say hi to start the conversation</Text>
          </View>
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} 
        style={styles.keyboardView}
      >
        <View style={styles.inputContainer}>
            <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="type a message..."
            placeholderTextColor="rgba(240,228,193,0.5)"
            style={styles.input}
            multiline
            maxLength={500}
            editable={!sending}
            />
            <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={[
                styles.sendButton,
                (!inputText.trim() || sending) && styles.sendButtonDisabled,
            ]}
            >
            {sending ? (
                <ActivityIndicator size="small" color="#F0E4C1" />
            ) : (
                <Text style={styles.sendButtonText}>send</Text>
            )}
            </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* NEW MODAL USING SHARED PROFILE CARD */}
      <Modal 
         visible={profileModalVisible} 
         animationType="fade" 
         transparent={true}
         onRequestClose={() => setProfileModalVisible(false)}
      >
         <TouchableOpacity 
             style={styles.modalOverlay} 
             activeOpacity={1} 
             onPress={() => setProfileModalVisible(false)}
         >
            <View style={styles.modalCenter} onStartShouldSetResponder={() => true}>
                 <ProfileCard 
                    profile={otherUser} 
                    isPreview={true} 
                    onClose={() => setProfileModalVisible(false)} 
                 />
            </View>
         </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },
  keyboardView: { backgroundColor: '#0D1621' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,228,193,0.1)',
    backgroundColor: '#111C2A',
  },
  backButton: { paddingRight: 12 },
  backText: { color: '#F0E4C1', fontSize: 28, fontWeight: '300' },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(240,228,193,0.1)', marginRight: 10 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'rgba(240,228,193,0.6)', fontSize: 16, fontWeight: '700' },
  headerName: { color: '#F0E4C1', fontSize: 18, fontWeight: '700', textTransform: 'lowercase' },

  messagesList: { padding: 16, flexGrow: 1 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', marginBottom: 8, textTransform: 'lowercase' },
  emptyHint: { color: 'rgba(240,228,193,0.7)', fontSize: 14, textTransform: 'lowercase' },

  messageContainer: { marginBottom: 8, maxWidth: '75%' },
  myMessageContainer: { alignSelf: 'flex-end' },
  theirMessageContainer: { alignSelf: 'flex-start' },

  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  myMessageBubble: { backgroundColor: '#511619', borderBottomRightRadius: 4 },
  theirMessageBubble: { backgroundColor: 'rgba(240,228,193,0.12)', borderBottomLeftRadius: 4 },

  messageText: { fontSize: 15, lineHeight: 20 },
  myMessageText: { color: '#F0E4C1' },
  theirMessageText: { color: '#F0E4C1' },

  messageTime: { fontSize: 10, marginTop: 4, opacity: 0.7 },
  myMessageTime: { color: '#F0E4C1', textAlign: 'right' },
  theirMessageTime: { color: '#F0E4C1', textAlign: 'left' },

  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#0D1621', borderTopWidth: 1, borderTopColor: 'rgba(240,228,193,0.1)', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: 'rgba(240,228,193,0.08)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, paddingTop: 10, color: '#F0E4C1', fontSize: 15, maxHeight: 100, marginRight: 8, borderWidth: 1, borderColor: 'rgba(240,228,193,0.15)' },
  sendButton: { backgroundColor: '#511619', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center', minWidth: 70 },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#F0E4C1', fontWeight: '700', fontSize: 14, textTransform: 'lowercase' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,28,42,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCenter: { justifyContent: 'center', alignItems: 'center' },
});