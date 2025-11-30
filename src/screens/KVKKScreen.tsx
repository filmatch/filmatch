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
        <Text style={s.headerTitle}>privacy & terms</Text>
        <View style={{width: 40}} /> 
      </View>

      <ScrollView contentContainerStyle={s.wrap}>
        <Text style={s.sub}>please read our privacy policy and terms of use.</Text>

        <View style={s.card}>
          <Text style={s.sectionTitle}>1. data controller</Text>
          <Text style={s.text}>
the data controller under kvkk is nehir irem yılmaz, who operates the filmatch application.          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>2. personal data processed</Text>
          <Text style={s.text}>
            • identity info: name, surname, email address{'\n'}
            • profile info: age, gender, preferences, city, bio{'\n'}
            • photos: profile photos (max 6){'\n'}
            • technical data: device id, ip address, usage logs{'\n'}
            • matching data: movie preferences, match history, messaging
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>3. purposes of processing</Text>
          <Text style={s.text}>
            • user account creation and management{'\n'}
            • profile creation and verification{'\n'}
            • finding suitable matches{'\n'}
            • analyzing movie preferences{'\n'}
            • security and fraud prevention{'\n'}
            • fulfilling legal obligations
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>4. third parties</Text>
          <Text style={s.text}>
            your data may be shared with the following parties:{'\n'}
            • cloud storage providers (firebase, google cloud){'\n'}
            • image hosting providers (cloudinary) for storing and processing profile photos{'\n'}
            • tmdb (the movie database) for content data{'\n'}
            • legal authorities (in case of a court order)
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>5. data retention</Text>
          <Text style={s.text}>
            your data is stored as long as your account is active. it is deleted within 90 days after account deletion.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>6. security</Text>
          <Text style={s.text}>
            your data is protected using encryption, access controls, and ssl/tls protocols.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>7. user rights</Text>
          <Text style={s.text}>
            under data protection laws, you have the right to:{'\n'}
            • request access to your data{'\n'}
            • request correction of errors{'\n'}
            • request deletion of your account{'\n'}
            • object to data processing{'\n'}
            • request data portability
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>8. contact</Text>
          <Text style={s.text}>
            for questions, you can contact us at:{'\n'}
            email: filmatch2@gmail.com
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>9. age limit</Text>
          <Text style={s.text}>
            this application is designed for individuals aged 18 and over. persons under 18 are prohibited from creating an account.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>10. terms of use</Text>
          <Text style={s.text}>
            these terms govern your use of the filmatch application ('app'). by creating an account or using the app, you agree to these terms. if you do not agree, you must not use the app.{'\n\n'}
            the app is for individuals aged 18 and over. by using the app you confirm that you are at least 18 years old.{'\n\n'}
            you are responsible for all content you share on the app, including photos, bios, messages, usernames and other information. you must only upload and share content that you have the right to use and that complies with these terms and applicable laws.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>11. acceptable use</Text>
          <Text style={s.text}>
            you agree not to:{'\n'}
            • use the app for any illegal or unauthorized purpose{'\n'}
            • harass, threaten or abuse other users{'\n'}
            • attempt to access other accounts or our systems without permission{'\n'}
            • use the app to send spam, scams or unwanted advertising
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>12. prohibited content</Text>
          <Text style={s.text}>
            the following content is not allowed in profile photos, display names, bios or messages:{'\n'}
            • nudity or sexually explicit content{'\n'}
            • sexually suggestive content or requests for sexual content{'\n'}
            • any sexual content involving minors or content that appears to show minors{'\n'}
            • violent, gory or self-harm content{'\n'}
            • hate speech, slurs or symbols targeting protected groups{'\n'}
            • bullying, harassment, threats or doxxing{'\n'}
            • spam, scams or unwanted advertising{'\n'}
            • impersonation of other people or misleading identities{'\n\n'}
            we may use automated tools and/or manual review to detect and remove prohibited content. content that violates these rules may be blocked or deleted without notice.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>13. enforcement and bans</Text>
          <Text style={s.text}>
            if you violate these terms or our content rules, we may take actions including:{'\n'}
            • removing or blocking your content{'\n'}
            • temporarily suspending your account{'\n'}
            • permanently banning your account{'\n'}
            • notifying competent authorities when required by law, especially in cases involving minors or serious threats
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>14. reporting</Text>
          <Text style={s.text}>
            users can report profiles, photos or messages they believe violate these terms. we review reports and take appropriate action, but we are not obligated to respond individually to every report.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>15. changes</Text>
          <Text style={s.text}>
            we may update this privacy policy and these terms of use from time to time. when we make material changes, we will notify you in the app. continued use of the app after changes means you accept the updated version.
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
