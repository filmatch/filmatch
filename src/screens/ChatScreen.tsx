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
  Image,
  ActivityIndicator,
} from 'react-native';
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
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { NotificationService } from '../services/NotificationService';
import type { UserProfile } from '../types';

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
};

type RouteParams = {
  chatId: string;
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
  const { chatId } = route.params as RouteParams;
  const currentUser = FirebaseAuthService.getCurrentUser();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const flatListRef = useRef<FlatList>(null);

// In ChatScreen.tsx, in the useEffect around line 50
useEffect(() => {
  if (!currentUser || !chatId) return;

  // Load other user's profile
  loadOtherUserProfile();

  // Clear message notification for this chat when user opens it
  // Wrap in try-catch to prevent crashes
  NotificationService.clearChatNotification(currentUser.uid, chatId).catch((err) => {
    console.log('Could not clear notification:', err);
  });

  // Set up real-time message listener
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const messagesQuery = query(messagesRef, orderBy('createdAt', 'asc'));

  const unsubscribe = onSnapshot(
    messagesQuery,
    (snapshot) => {
      // ... rest of code
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

        // Scroll to bottom when new messages arrive
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
    // Extract other user ID from chatId format: chat_userId1_userId2
    const userIds = chatId.replace('chat_', '').split('_');
    const otherUserId = userIds.find(id => id !== currentUser.uid);
    
    if (!otherUserId) {
      console.error('Could not determine other user from chatId');
      return;
    }

    const profile = await FirestoreService.getUserProfile(otherUserId);
    setOtherUser(profile);
    
    // Set navigation title
    navigation.setOptions({
      title: profile?.displayName || 'Chat',
    });
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
    // Check if chat exists, create it if not
    const chatRef = doc(db, 'chats', chatId);
    const chatDoc = await getDoc(chatRef);
    
    if (!chatDoc.exists()) {
      // First message - create the chat document
      const sortedIds = chatId.replace('chat_', '').split('_');
      await setDoc(chatRef, {
        participants: sortedIds,
        createdAt: serverTimestamp(),
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
      });
      console.log('✅ Chat created with first message');
    } else {
      // Update existing chat's last message
      await updateDoc(chatRef, {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
      });
    }

    // Add message to messages subcollection
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    await addDoc(messagesRef, {
      text: messageText,
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
    });

    // Send notification to other user
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
      
      console.log('✅ Message notification sent');
    }

    console.log('✅ Message sent successfully');
  } catch (error) {
    console.error('❌ Error sending message:', error);
    setInputText(messageText); // Restore text on error
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        
        {otherUser?.photos?.[0] ? (
          <Image source={{ uri: otherUser.photos[0] }} style={styles.headerAvatar} />
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
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>no messages yet</Text>
            <Text style={styles.emptyHint}>say hi to start the conversation</Text>
          </View>
        }
      />

      {/* Input */}
      <KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={0}
  style={{ backgroundColor: '#0D1621' }}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111C2A',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,228,193,0.1)',
    backgroundColor: '#111C2A',
  },
  backButton: {
    paddingRight: 12,
  },
  backText: {
    color: '#F0E4C1',
    fontSize: 28,
    fontWeight: '300',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(240,228,193,0.1)',
    marginRight: 10,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: 'rgba(240,228,193,0.6)',
    fontSize: 16,
    fontWeight: '700',
  },
  headerName: {
    color: '#F0E4C1',
    fontSize: 18,
    fontWeight: '700',
    textTransform: 'lowercase',
  },

  messagesList: {
    padding: 16,
    flexGrow: 1,
  },

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#F0E4C1',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'lowercase',
  },
  emptyHint: {
    color: 'rgba(240,228,193,0.7)',
    fontSize: 14,
    textTransform: 'lowercase',
  },

  messageContainer: {
    marginBottom: 8,
    maxWidth: '75%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },

  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: '#511619',
    borderBottomRightRadius: 4,
  },
  theirMessageBubble: {
    backgroundColor: 'rgba(240,228,193,0.12)',
    borderBottomLeftRadius: 4,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#F0E4C1',
  },
  theirMessageText: {
    color: '#F0E4C1',
  },

  messageTime: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
  },
  myMessageTime: {
    color: '#F0E4C1',
    textAlign: 'right',
  },
  theirMessageTime: {
    color: '#F0E4C1',
    textAlign: 'left',
  },

  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#0D1621',
    borderTopWidth: 1,
    borderTopColor: 'rgba(240,228,193,0.1)',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    color: '#F0E4C1',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.15)',
  },
  sendButton: {
    backgroundColor: '#511619',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 70,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    color: '#F0E4C1',
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'lowercase',
  },
});