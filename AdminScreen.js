import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function AdminScreen() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const db = getFirestore();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      // 1. Get reports that are PENDING
      const q = query(collection(db, "user_reports"), where("status", "==", "PENDING"));
      const querySnapshot = await getDocs(q);
      
      const list = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() });
      });
      
      setReports(list);
    } catch (e) {
      console.log("Error fetching reports:", e);
      Alert.alert("Error", "Could not load reports");
    } finally {
      setLoading(false);
    }
  };

  const resolveReport = async (reportId, newStatus) => {
    try {
      // 2. Update the report status
      const reportRef = doc(db, "user_reports", reportId);
      await updateDoc(reportRef, { status: newStatus });
      
      Alert.alert("Success", `Report marked as ${newStatus}`);
      fetchReports(); // Refresh the list automatically
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#0000ff" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Admin Dashboard</Text>
      
      {reports.length === 0 ? (
        <View style={styles.center}>
            <Text style={{fontSize: 16, color: 'gray'}}>No pending reports! Good job.</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.reasonLabel}>Reason:</Text>
              <Text style={styles.reason}>{item.reason}</Text>
              
              <Text style={styles.idLabel}>Reported User ID:</Text>
              <Text style={styles.idText}>{item.reportedUserId}</Text>
              
              <View style={styles.row}>
                {/* Dismiss Button */}
                <TouchableOpacity 
                  style={[styles.btn, styles.dismissBtn]}
                  onPress={() => resolveReport(item.id, 'REJECTED')}>
                  <Text style={styles.btnText}>Dismiss</Text>
                </TouchableOpacity>

                {/* Ban/Resolve Button */}
                <TouchableOpacity 
                  style={[styles.btn, styles.banBtn]}
                  onPress={() => resolveReport(item.id, 'RESOLVED')}>
                  <Text style={styles.btnText}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#f2f2f2' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: '#333' },
  card: { padding: 20, backgroundColor: '#fff', marginBottom: 15, borderRadius: 12, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  reasonLabel: { fontSize: 12, color: '#888', textTransform: 'uppercase', fontWeight: 'bold' },
  reason: { fontSize: 18, fontWeight: '600', marginBottom: 10, color: '#333' },
  idLabel: { fontSize: 12, color: '#888' },
  idText: { fontSize: 14, color: '#555', fontFamily: 'monospace', marginBottom: 15, backgroundColor: '#eee', padding: 5, borderRadius: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  btn: { paddingVertical: 12, borderRadius: 8, width: '48%', alignItems: 'center' },
  dismissBtn: { backgroundColor: '#999' },
  banBtn: { backgroundColor: '#ff4444' },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});