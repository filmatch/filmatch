// src/screens/KVKKScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const C = { bg: '#111C2A', card: '#121D2B', text: '#F0E4C1', dim: 'rgba(240,228,193,0.75)', accent: '#511619' };

export default function KVKKScreen({ navigation }: any) {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    if (!accepted) {
      Alert.alert('kvkk required', 'you must accept the privacy policy to continue');
      return;
    }
    navigation.replace('SetUpProfile');
  };

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>privacy & data protection</Text>
        <Text style={s.sub}>please read and accept our kvkk policy</Text>

        <View style={s.card}>
          <Text style={s.sectionTitle}>1. veri sorumlusu</Text>
          <Text style={s.text}>
            [filmatch] uygulaması, kullanıcıların kişisel verilerinin işlenmesinden sorumludur.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>2. işlenen kişisel veriler</Text>
          <Text style={s.text}>
            • Kimlik Bilgileri: Ad, soyadı, e-posta adresi{'\n'}
            • Profil Bilgileri: Yaş, cinsiyet, cinsel tercih, şehir, biyografi{'\n'}
            • Fotoğraflar: Profil fotoğrafları (maksimum 6 adet){'\n'}
            • Teknik Veriler: Cihaz kimliği, IP adresi, kullanım günlükleri{'\n'}
            • Eşleştirme Verileri: Film tercihleri, eşleşme geçmişi, mesajlaşma
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>3. verilerin işlenme amaçları</Text>
          <Text style={s.text}>
            • Kullanıcı hesabı oluşturma ve yönetimi{'\n'}
            • Profil oluşturma ve doğrulama{'\n'}
            • Uygun eşleşmeleri bulma{'\n'}
            • Film tercihleri analizi yapma{'\n'}
            • Güvenlik ve dolandırıcılık önleme{'\n'}
            • Hukuki yükümlülükleri yerine getirme
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>4. verilerin paylaşıldığı taraflar</Text>
          <Text style={s.text}>
            Verileriniz aşağıdaki taraflara paylaşılabilir:{'\n'}
            • Ödeme hizmeti sağlayıcıları{'\n'}
            • Bulut depolama (Firebase, Google Cloud){'\n'}
            • TMDB (The Movie Database){'\n'}
            • Hukuki makamlar (mahkeme kararı durumunda)
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>5. veri saklanma süresi</Text>
          <Text style={s.text}>
            Verileriniz hesabınız aktif olduğu sürece saklanır. Hesabı sildikten sonra 90 gün içinde silinir.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>6. güvenlik</Text>
          <Text style={s.text}>
            Verileriniz şifreleme, erişim kontrolleri ve SSL/TLS protokolü ile korunmaktadır.
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>7. kullanıcı hakları</Text>
          <Text style={s.text}>
            KVKK uyarınca aşağıdaki haklara sahipsiniz:{'\n'}
            • Bilgi sahibi olma hakkı{'\n'}
            • Erişim hakkı{'\n'}
            • Düzeltme hakkı{'\n'}
            • Silme hakkı{'\n'}
            • İşleme sınırlandırma hakkı{'\n'}
            • Veri taşınabilirliği hakkı
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>8. iletişim</Text>
          <Text style={s.text}>
            Sorularınız için bizimle iletişim kurabilirsiniz:{'\n'}
            E-posta: [filmatch2@gmail.com]
          </Text>

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>9. yaş sınırı</Text>
          <Text style={s.text}>
            Bu uygulama 18 yaş ve üzeri kişiler için tasarlanmıştır. 18 yaşından küçük kişilerin hesap açması yasaktır.
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => setAccepted(!accepted)}
          style={s.checkboxContainer}
        >
          <View style={[s.checkbox, accepted && s.checkboxChecked]}>
            {accepted && <Feather name="check" size={16} color={C.text} />}
          </View>
          <Text style={s.checkboxText}>
            kvkk aydınlatma metnini okudum ve anladım. rızamı veriyorum.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          onPress={handleAccept}
          disabled={!accepted}
          style={[s.button, !accepted && s.buttonDisabled]}
        >
          <Text style={s.buttonText}>continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  wrap: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 100 },
  title: { color: C.text, fontSize: 24, textAlign: 'center', textTransform: 'lowercase', fontWeight: '700' },
  sub: { color: C.dim, textAlign: 'center', marginTop: 6, textTransform: 'lowercase', fontSize: 14 },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: { color: C.text, fontSize: 14, fontWeight: '700', textTransform: 'lowercase', marginBottom: 8 },
  text: { color: C.dim, fontSize: 13, lineHeight: 20, textTransform: 'lowercase' },

  checkboxContainer: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(240,228,193,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: { backgroundColor: C.accent, borderColor: C.accent },
  checkboxText: { color: C.text, fontSize: 13, flex: 1, textTransform: 'lowercase', lineHeight: 20 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  button: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: C.text, fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
});