// src/screens/KVKKScreen.tsx
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';

const C = { bg: '#111C2A', card: '#121D2B', text: '#F0E4C1', dim: 'rgba(240,228,193,0.75)', accent: '#511619' };

export default function KVKKScreen({ navigation }: any) {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.closeBtn}>
           <Text style={s.closeText}>close</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>privacy policy</Text>
        <View style={{width: 40}} /> 
      </View>

      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.sub}>please read our data protection policy.</Text>

        <View style={s.card}>
          <Text style={s.sectionTitle}>1. data controller</Text>
          <Text style={s.text}>
            The [filmatch] application is responsible for the processing of users' personal data.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>2. personal data processed</Text>
          <Text style={s.text}>
            • Identity Info: Name, surname, email address{'\n'}
            • Profile Info: Age, gender, preferences, city, bio{'\n'}
            • Photos: Profile photos (max 6){'\n'}
            • Technical Data: Device ID, IP address, usage logs{'\n'}
            • Matching Data: Movie preferences, match history, messaging
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>3. purposes of processing</Text>
          <Text style={s.text}>
            • User account creation and management{'\n'}
            • Profile creation and verification{'\n'}
            • Finding suitable matches{'\n'}
            • Analyzing movie preferences{'\n'}
            • Security and fraud prevention{'\n'}
            • Fulfilling legal obligations
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>4. third parties</Text>
          <Text style={s.text}>
            Your data may be shared with the following parties:{'\n'}
            • Cloud storage providers (Firebase, Google Cloud){'\n'}
            • TMDB (The Movie Database) for content data{'\n'}
            • Legal authorities (in case of a court order)
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>5. data retention</Text>
          <Text style={s.text}>
            Your data is stored as long as your account is active. It is deleted within 90 days after account deletion.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>6. security</Text>
          <Text style={s.text}>
            Your data is protected using encryption, access controls, and SSL/TLS protocols.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>7. user rights</Text>
          <Text style={s.text}>
            Under data protection laws, you have the right to:{'\n'}
            • Request access to your data{'\n'}
            • Request correction of errors{'\n'}
            • Request deletion of your account{'\n'}
            • Object to data processing{'\n'}
            • Request data portability
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>8. contact</Text>
          <Text style={s.text}>
            For questions, you can contact us at:{'\n'}
            Email: [filmatch2@gmail.com]
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>9. age limit</Text>
          <Text style={s.text}>
            This application is designed for individuals aged 18 and over. Persons under 18 are prohibited from creating an account.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: 'rgba(240,228,193,0.1)'
  },
  closeBtn: { padding: 8 },
  closeText: { color: C.dim, fontSize: 16, textTransform: 'lowercase' },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '700', textTransform: 'lowercase' },
  
  wrap: { paddingHorizontal: 20, paddingVertical: 24 },
  sub: { color: C.dim, textAlign: 'center', marginBottom: 20, textTransform: 'lowercase', fontSize: 14 },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 40,
  },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '700', textTransform: 'lowercase', marginBottom: 8 },
  text: { color: C.dim, fontSize: 13, lineHeight: 20, textTransform: 'lowercase' },
});