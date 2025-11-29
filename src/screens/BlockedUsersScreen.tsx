import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  getDoc,
} from 'firebase/firestore';
import { FirebaseAuthService } from '../services/FirebaseAuthService';

export default function BlockedUsersScreen() {
  const navigation = useNavigation();
  const db = getFirestore();
  const currentUser = FirebaseAuthService.getCurrentUser();

  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // Listen to the 'user_blocks' collection in real-time
    const blocksRef = collection(db, 'user_blocks');
    const q = query(blocksRef, where('blockerId', '==', currentUser.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const blockedList: any[] = [];
      
      // Fetch user details for each blocked ID
      const promises = snapshot.docs.map(async (blockDoc) => {
        const data = blockDoc.data();
        const blockedId = data.blockedId;
        
        try {
          const userSnap = await getDoc(doc(db, 'users', blockedId));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            return {
              blockDocId: blockDoc.id, // We need this to delete the block later
              uid: blockedId,
              displayName: userData.displayName || 'Unknown',
              photo: userData.photos?.[0] || null,
            };
          }
        } catch (e) {
          console.log('Error fetching blocked user profile', e);
        }
        return null;
      });

      const results = await Promise.all(promises);
      const validResults = results.filter(r => r !== null);
      
      setBlockedUsers(validResults);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleUnblock = (user: any) => {
    Alert.alert(
      'Unblock User',
      `Are you sure you want to unblock ${user.displayName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: async () => {
            try {
              // Delete the document from user_blocks
              await deleteDoc(doc(db, 'user_blocks', user.blockDocId));
            } catch (error) {
              Alert.alert('Error', 'Could not unblock user.');
            }
          },
        },
      ]
    );
  };

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
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>blocked users</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>you haven't blocked anyone.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Image source={{ uri: item.photo }} style={styles.avatar} contentFit="cover" />
            <Text style={styles.name}>{item.displayName.toLowerCase()}</Text>
            
            <TouchableOpacity 
              style={styles.unblockBtn} 
              onPress={() => handleUnblock(item)}
            >
              <Text style={styles.unblockText}>unblock</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111C2A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,228,193,0.1)',
  },
  backBtn: { padding: 8 },
  backText: { color: '#F0E4C1', fontSize: 24, fontWeight: '300' },
  headerTitle: { color: '#F0E4C1', fontSize: 18, fontWeight: '700', textTransform: 'lowercase' },
  
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(240,228,193,0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', marginRight: 12 },
  name: { color: '#F0E4C1', fontSize: 16, flex: 1, textTransform: 'lowercase' },
  
  unblockBtn: {
    backgroundColor: 'rgba(240,228,193,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.2)',
  },
  unblockText: { color: '#F0E4C1', fontSize: 12, fontWeight: '700', textTransform: 'lowercase' },

  emptyContainer: { marginTop: 100, alignItems: 'center' },
  emptyText: { color: 'rgba(240,228,193,0.5)', fontSize: 16, textTransform: 'lowercase' },
});