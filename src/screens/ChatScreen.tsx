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
  deleteDoc, // <--- Added deleteDoc
  getFirestore,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { NotificationService } from '../services/NotificationService';
import TMDbService from '../services/TMDbService';
import { MatchingService } from '../services/MatchingService';
import ProfileCard from '../components/ProfileCard';
import CustomAlert from '../components/CustomAlert';
import { COLORS } from '../theme';

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
  const [menuVisible, setMenuVisible] = useState(false);
  
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

  useEffect(() => {
    if (!currentUser || !chatId) return;
    loadOtherUserProfile();
    
    // Mark chat as read in Firestore
    const markAsRead = async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
            readBy: arrayUnion(currentUser.uid),
            markedUnreadBy: arrayRemove(currentUser.uid)
        });
      } catch (error) {
        console.log('Error marking chat as read:', error);
      }
    };
    markAsRead();

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

      const [otherProfile, myProfile] = await Promise.all([
        FirestoreService.getUserProfile(otherUserId),
        FirestoreService.getUserProfile(currentUser.uid)
      ]);

      if (otherProfile) {
        let compatibility = 0;
        if (myProfile) {
          compatibility = MatchingService.calculateCompatibility(myProfile, otherProfile);
        }

        let enriched = await TMDbService.enrichProfile(otherProfile);
        
        const finalComp = compatibility > 0 ? compatibility : ((otherProfile as any).compatibility || 0);

        enriched = { ...enriched, compatibility: finalComp };
        
        setOtherUser(enriched);
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
          participants: chatId.replace('chat_', '').split('_'),
          markedUnreadBy: [],
          readBy: [currentUser.uid]
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
      console.error('⚠️ Error sending message:', error);
      setInputText(messageText); 
    } finally {
      setSending(false);
    }
  };

  // --- REPORTING & BLOCKING LOGIC ---

  const handleReportPress = () => {
    setAlert({
      visible: true,
      title: 'report user',
      message: 'select a reason',
      buttons: [
        { text: 'inappropriate', style: 'destructive', onPress: () => { submitReport('inappropriate'); }},
        { text: 'spam', style: 'destructive', onPress: () => { submitReport('spam'); }},
        { text: 'harassment', style: 'destructive', onPress: () => { submitReport('harassment'); }},
        { text: 'cancel', style: 'cancel', onPress: () => setAlert({ ...alert, visible: false }) },
      ]
    });
  };

  const submitReport = async (reason: string) => {
    if (!currentUser || !otherUser) return;
    try {
      await addDoc(collection(db, 'user_reports'), {
        reporterId: currentUser.uid,
        reportedUserId: otherUser.uid,
        reason: reason,
        createdAt: serverTimestamp(),
        status: 'PENDING'
      });
      setAlert({
        visible: true,
        title: 'report sent',
        message: 'we will review this user',
        buttons: [{ 
          text: 'ok', 
          onPress: () => {
            setAlert({ ...alert, visible: false });
            setTimeout(() => {
              setAlert({
                visible: true,
                title: 'block this user?',
                message: 'they will disappear from matches',
                buttons: [
                  { text: 'no', style: 'cancel', onPress: () => setAlert({ ...alert, visible: false }) },
                  { text: 'block', style: 'destructive', onPress: () => { setAlert({ ...alert, visible: false }); executeBlock(); }}
                ]
              });
            }, 300);
          }
        }]
      });
    } catch (error) {
      setAlert({ visible: true, title: 'error', message: 'could not submit report', buttons: [{ text: 'ok', onPress: () => setAlert({ ...alert, visible: false }) }]});
    }
  };

  const handleBlockPress = () => {
    setMenuVisible(false);
    setTimeout(() => {
      setAlert({
        visible: true,
        title: 'block this user?',
        message: 'they will disappear from your matches',
        buttons: [
          { text: 'cancel', style: 'cancel', onPress: () => setAlert({ ...alert, visible: false }) },
          { text: 'block', style: 'destructive', onPress: () => { setAlert({ ...alert, visible: false }); executeBlock(); }}
        ]
      });
    }, 200);
  };

  const executeBlock = async () => {
    if (!currentUser || !otherUser) return;
    try {
      await setDoc(doc(db, 'user_blocks', `${currentUser.uid}_${otherUser.uid}`), {
        blockerId: currentUser.uid,
        blockedId: otherUser.uid,
        createdAt: serverTimestamp()
      });
      setAlert({
        visible: true,
        title: 'user blocked',
        message: 'they have been removed from your matches',
        buttons: [{ text: 'ok', onPress: () => { setAlert({ ...alert, visible: false }); navigation.goBack(); }}]
      });
    } catch (error) {
      console.error(error);
      setAlert({ visible: true, title: 'error', message: 'could not block user', buttons: [{ text: 'ok', onPress: () => setAlert({ ...alert, visible: false }) }]});
    }
  };

  // --- UNMATCH LOGIC ---

  const handleRemoveMatch = () => {
    if (!currentUser || !otherUser) return;
    setProfileModalVisible(false); // Close profile first

    setTimeout(() => {
        setAlert({
            visible: true,
            title: 'remove match?',
            message: `unmatch with ${otherUser.displayName || 'this user'}?`,
            buttons: [
              { 
                text: 'remove', 
                style: 'destructive', 
                onPress: async () => {
                  setAlert({ ...alert, visible: false });
                  try {
                    const sortedIds = [currentUser.uid, otherUser.uid].sort();
                    const matchId = `match_${sortedIds[0]}_${sortedIds[1]}`;
                    await deleteDoc(doc(db, 'matches', matchId));
                    navigation.goBack(); // Return to matches list
                  } catch (e) {
                    console.error('Error removing match:', e);
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
    }, 300);
  };

  const renderCardFooter = () => (
    <View style={styles.modalButtons}>
      <TouchableOpacity style={[styles.modalBtn, styles.secondaryBtn]} onPress={handleRemoveMatch}>
        <Text style={styles.modalBtnText}>remove match</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn]} onPress={() => setProfileModalVisible(false)}>
        <Text style={styles.modalBtnText}>close</Text>
      </TouchableOpacity>
    </View>
  );

  // --- RENDER ---

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.senderId === currentUser?.uid;
    const showTime = true;

    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer]}>
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.theirMessageBubble]}>
          <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.theirMessageText]}>{item.text}</Text>
          {showTime && <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.theirMessageTime]}>{fmtTime(item.createdAt)}</Text>}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.text} />
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
        
        <TouchableOpacity style={styles.headerProfile} onPress={() => setProfileModalVisible(true)}>
            {otherUser?.photos?.[0] ? (
            <Image source={{ uri: otherUser.photos[0] }} style={styles.headerAvatar} contentFit="cover" />
            ) : (
            <View style={[styles.headerAvatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{otherUser?.displayName?.[0]?.toUpperCase() || '?'}</Text>
            </View>
            )}
            <Text style={styles.headerName}>{otherUser?.displayName || 'Chat'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionsButton} onPress={() => setMenuVisible(true)}>
            <Text style={styles.optionsText}>⋮</Text>
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0} style={styles.keyboardView}>
        <View style={styles.inputContainer}>
            <TextInput 
              value={inputText} 
              onChangeText={setInputText} 
              placeholder="type a message..." 
              placeholderTextColor="rgba(240,228,193,0.5)" 
              style={styles.input} 
              multiline 
              maxLength={500} 
            />
            <TouchableOpacity onPress={handleSend} disabled={!inputText.trim() || sending} style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}>
            {sending ? <ActivityIndicator size="small" color={COLORS.text} /> : <Text style={styles.sendButtonText}>send</Text>}
            </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={profileModalVisible} animationType="fade" transparent={true} onRequestClose={() => setProfileModalVisible(false)}>
         <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setProfileModalVisible(false)}>
            <View style={styles.modalCenter} onStartShouldSetResponder={() => true}>
                 <ProfileCard 
                   // Hide intent by masking it undefined
                   profile={otherUser ? { ...otherUser, relationshipIntent: undefined } : null} 
                   isPreview={false}
                   footer={renderCardFooter()} // <--- Pass the footer here
                   onClose={() => setProfileModalVisible(false)} 
                 />
            </View>
         </TouchableOpacity>
      </Modal>

      <CustomAlert 
        visible={menuVisible} 
        title="options"
        message={otherUser?.displayName || 'Chat'}
        buttons={[
          { text: 'report user', style: 'destructive', onPress: handleReportPress },
          { text: 'block user', style: 'destructive', onPress: handleBlockPress },
          { text: 'cancel', style: 'cancel', onPress: () => setMenuVisible(false) }
        ]}
        onRequestClose={() => setMenuVisible(false)}
      />

      <CustomAlert visible={alert.visible} title={alert.title} message={alert.message} buttons={alert.buttons} onRequestClose={() => setAlert({ ...alert, visible: false })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  keyboardView: { backgroundColor: '#0D1621' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(240,228,193,0.1)', backgroundColor: COLORS.bg },
  backButton: { paddingRight: 12 },
  backText: { color: COLORS.text, fontSize: 28, fontWeight: '300' },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerAvatar: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(240,228,193,0.1)', marginRight: 10 },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'rgba(240,228,193,0.6)', fontSize: 16, fontWeight: '700' },
  headerName: { color: COLORS.text, fontSize: 18, fontWeight: '700', textTransform: 'lowercase' },

  optionsButton: { paddingLeft: 10, paddingRight: 5 },
  optionsText: { color: COLORS.text, fontSize: 24, fontWeight: 'bold' },

  messagesList: { padding: 16, flexGrow: 1 },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginBottom: 8, textTransform: 'lowercase' },
  emptyHint: { color: 'rgba(240,228,193,0.7)', fontSize: 14, textTransform: 'lowercase' },

  messageContainer: { marginBottom: 8, maxWidth: '75%' },
  myMessageContainer: { alignSelf: 'flex-end' },
  theirMessageContainer: { alignSelf: 'flex-start' },

  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  myMessageBubble: { backgroundColor: COLORS.button, borderBottomRightRadius: 4 },
  theirMessageBubble: { backgroundColor: 'rgba(240,228,193,0.12)', borderBottomLeftRadius: 4 },

  messageText: { fontSize: 15, lineHeight: 20 },
  myMessageText: { color: COLORS.text },
  theirMessageText: { color: COLORS.text },

  messageTime: { fontSize: 10, marginTop: 4, opacity: 0.7 },
  myMessageTime: { color: COLORS.text, textAlign: 'right' },
  theirMessageTime: { color: COLORS.text, textAlign: 'left' },

  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#0D1621', borderTopWidth: 1, borderTopColor: 'rgba(240,228,193,0.1)', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: 'rgba(240,228,193,0.08)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, paddingTop: 10, color: COLORS.text, fontSize: 15, maxHeight: 100, marginRight: 8, borderWidth: 1, borderColor: 'rgba(240,228,193,0.15)' },
  sendButton: { backgroundColor: COLORS.button, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, justifyContent: 'center', alignItems: 'center', minWidth: 70 },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: COLORS.text, fontWeight: '700', fontSize: 14, textTransform: 'lowercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(17,28,42,0.95)', justifyContent: 'center', alignItems: 'center' },
  modalCenter: { justifyContent: 'center', alignItems: 'center' },
  
  // Added styles for the modal buttons
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