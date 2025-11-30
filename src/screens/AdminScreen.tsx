// src/screens/AdminScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, Image, Modal, ScrollView } from 'react-native';
import { getFirestore, collection, query, where, getDocs, doc, writeBatch, getDoc, orderBy, limit } from 'firebase/firestore';
import { SafeAreaView } from 'react-native-safe-area-context';

// Theme Colors
const COLORS = {
  bg: '#111C2A',
  text: '#F0E4C1',
  button: '#511619',
  border: 'rgba(240, 228, 193, 0.12)',
  cardBg: 'rgba(240, 228, 193, 0.05)',
  chatBubble: 'rgba(240, 228, 193, 0.1)',
};

export default function AdminScreen() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Chat Modal State
  const [chatVisible, setChatVisible] = useState(false);
  const [chatLogs, setChatLogs] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  
  const db = getFirestore();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const q = query(collection(db, "user_reports"), where("status", "==", "PENDING"));
      const querySnapshot = await getDocs(q);
      const rawReports = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const enrichedReports = await Promise.all(rawReports.map(async (report: any) => {
        if (!report.reportedUserId) return report;
        
        let userData = null;

        // METHOD 1: Direct Lookup (Standard)
        // Checks if there is a doc at: users/jFeGV...
        const userRef = doc(db, "users", report.reportedUserId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          userData = userSnap.data();
          console.log("Found user via Direct ID:", userData?.displayName);
        } else {
          // METHOD 2: Query Lookup (Backup)
          // Checks if there is a doc where field 'uid' == jFeGV...
          console.log("Direct lookup failed, trying query for uid:", report.reportedUserId);
          const qUser = query(collection(db, "users"), where("uid", "==", report.reportedUserId));
          const querySnap = await getDocs(qUser);
          if (!querySnap.empty) {
            userData = querySnap.docs[0].data();
            console.log("Found user via Query:", userData?.displayName);
          }
        }

        return { ...report, offender: userData };
      }));
      
      setReports(enrichedReports);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (reportId: string, userId: string, action: 'BAN' | 'DISMISS') => {
    try {
      const batch = writeBatch(db);
      const reportRef = doc(db, "user_reports", reportId);

      if (action === 'BAN') {
        batch.update(reportRef, { status: "RESOLVED", outcome: "BANNED" });
        
        // Try to ban by direct ID first
        const userRef = doc(db, "users", userId);
        batch.update(userRef, { isBanned: true });

        Alert.alert("Banned", "User has been banned.");
      } else {
        batch.update(reportRef, { status: "REJECTED" });
        Alert.alert("Dismissed", "Report ignored.");
      }
      await batch.commit();
      fetchReports();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const viewChatLogs = async (reporterId: string, offenderId: string) => {
    if (!reporterId || !offenderId) {
      Alert.alert("Error", "Missing user IDs to find chat.");
      return;
    }
    setLoadingChat(true);
    setChatVisible(true);
    setChatLogs([]);

    try {
      // 1. Construct Chat ID (Same logic as SwipeScreen)
      const sortedIds = [reporterId, offenderId].sort();
      const chatId = `chat_${sortedIds[0]}_${sortedIds[1]}`;

      // 2. Fetch last 10 messages
      const msgsRef = collection(db, 'chats', chatId, 'messages');
      const q = query(msgsRef, orderBy('createdAt', 'desc'), limit(10));
      const snap = await getDocs(q);

      if (snap.empty) {
        setChatLogs([]); 
      } else {
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
        setChatLogs(logs);
      }
    } catch (e) {
      console.log(e);
      Alert.alert("Notice", "No active chat found between these users.");
      setChatVisible(false);
    } finally {
      setLoadingChat(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.text} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>admin dashboard</Text>
      
      {reports.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>no pending reports.</Text></View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 20 }}
          renderItem={({ item }) => {
            const name = item.offender?.displayName || "Unknown User";
            const bio = item.offender?.bio || "No bio available";
            const photo = item.offender?.photos?.[0] || null;

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.reasonLabel}>REPORT REASON:</Text>
                  <Text style={styles.reason}>{item.reason}</Text>
                </View>
                
                <View style={styles.evidenceContainer}>
                    {photo ? (
                        <Image source={{ uri: photo }} style={styles.offenderPhoto} />
                    ) : (
                        <View style={[styles.offenderPhoto, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                             <Text style={{color: 'white', fontSize: 10}}>NO IMG</Text>
                        </View>
                    )}
                    <View style={{flex: 1}}>
                        <Text style={styles.offenderName}>{name}</Text>
                        <Text style={styles.offenderBio} numberOfLines={2}>"{bio}"</Text>
                    </View>
                </View>

                {/* VIEW CHAT BUTTON */}
                <TouchableOpacity 
                  style={styles.chatBtn}
                  onPress={() => viewChatLogs(item.reporterId, item.reportedUserId)}
                >
                  <Text style={styles.chatBtnText}>view chat logs</Text>
                </TouchableOpacity>
                
                <Text style={styles.idLabel}>ID: {item.reportedUserId}</Text>
                
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.btn, styles.dismissBtn]} onPress={() => handleAction(item.id, item.reportedUserId, 'DISMISS')}>
                    <Text style={styles.btnText}>dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, styles.banBtn]} onPress={() => handleAction(item.id, item.reportedUserId, 'BAN')}>
                    <Text style={styles.btnText}>ban user</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* CHAT LOGS MODAL */}
      <Modal visible={chatVisible} animationType="slide" transparent={true} onRequestClose={() => setChatVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>chat logs (last 10)</Text>
            {loadingChat ? <ActivityIndicator color={COLORS.text} /> : (
              <ScrollView style={{ maxHeight: 300, width: '100%' }}>
                {chatLogs.length === 0 ? (
                  <Text style={{ color: COLORS.text, textAlign: 'center', opacity: 0.5, marginVertical: 20 }}>No messages found.</Text>
                ) : (
                  chatLogs.map((msg) => (
                    <View key={msg.id} style={styles.logItem}>
                       <Text style={styles.logSender}>{msg.senderId?.slice(0,5)}... :</Text>
                       <Text style={styles.logText}>{msg.text}</Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setChatVisible(false)}>
              <Text style={styles.btnText}>close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', color: COLORS.text, marginVertical: 20, textTransform: 'lowercase', textAlign: 'center' },
  emptyText: { color: COLORS.text, opacity: 0.5, fontStyle: 'italic' },
  
  card: { backgroundColor: COLORS.cardBg, padding: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  
  cardHeader: { marginBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(240,228,193,0.1)', paddingBottom: 10 },
  reasonLabel: { color: COLORS.text, opacity: 0.5, fontSize: 10, fontWeight: 'bold' },
  reason: { fontSize: 18, fontWeight: 'bold', textTransform: 'uppercase', color: '#F0E4C1' }, 
  
  evidenceContainer: { flexDirection: 'row', gap: 12, marginBottom: 15 },
  offenderPhoto: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#333' },
  offenderName: { color: COLORS.text, fontWeight: 'bold', fontSize: 16 },
  offenderBio: { color: COLORS.text, opacity: 0.7, fontSize: 12, fontStyle: 'italic', marginTop: 2 },

  idLabel: { color: COLORS.text, opacity: 0.3, fontSize: 10, marginBottom: 10, fontFamily: 'monospace' },
  
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dismissBtn: { backgroundColor: 'rgba(240, 228, 193, 0.1)' },
  banBtn: { backgroundColor: COLORS.button }, 
  btnText: { color: COLORS.text, fontWeight: 'bold', fontSize: 14, textTransform: 'lowercase' },

  chatBtn: { backgroundColor: 'rgba(30, 144, 255, 0.2)', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(14, 17, 19, 0.5)' },
  chatBtnText: { color: '#F0E4C1', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },

  // MODAL STYLES
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#1a2634', padding: 20, borderRadius: 16, alignItems: 'center' },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  closeModalBtn: { marginTop: 15, backgroundColor: COLORS.button, paddingHorizontal: 30, paddingVertical: 10, borderRadius: 8 },
  logItem: { width: '100%', flexDirection: 'row', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', paddingBottom: 4 },
  logSender: { color: COLORS.text, opacity: 0.5, fontSize: 12, width: 60 },
  logText: { color: COLORS.text, fontSize: 14, flex: 1 },
});