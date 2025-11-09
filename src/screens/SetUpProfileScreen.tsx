// src/screens/SetUpProfileScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList
} from 'react-native';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';

const C = { bg: '#111C2A', card: '#121D2B', text: '#F0E4C1', dim: 'rgba(240,228,193,0.75)', accent: '#511619' };

const GENDERS = ['female', 'male', 'nonbinary', 'other'] as const;

const CITY_LIST = [
  'adana','adıyaman','afyonkarahisar','ağrı','amasya','ankara','antalya','artvin','aydın',
  'balıkesir','bilecik','bingöl','bitlis','bolu','burdur','bursa','çanakkale','çankırı','çorum',
  'denizli','diyarbakır','edirne','elazığ','erzincan','erzurum','eskişehir',
  'gaziantep','giresun','gümüşhane','hakkari','hatay','ısparta','mersin','istanbul','izmir',
  'kars','kastamonu','kayseri','kırklareli','kırşehir','kocaeli','konya','kütahya',
  'malatya','manisa','mardin','muğla','muş','nevşehir','niğde','ordu','osmaniye','rize','sakarya','samsun',
  'siirt','sinop','sivas','tekirdağ','tokat','trabzon','tunceli','şanlıurfa','uşak','van','yalova','yozgat',
  'zonguldak','aksaray','bayburt','karaman','kırıkkale','batman','şırnak','bartın','ardahan',
  'ığdır','karabük','kilis','düzce'
];

const SORTED_CITIES = [...CITY_LIST].sort((a, b) =>
  a.localeCompare(b, 'tr', { sensitivity: 'base' })
);

export default function SetUpProfileScreen({ navigation }: any) {
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [genderPreferences, setGenderPreferences] = useState<string[]>([]);
  const [city, setCity] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [cityOpen, setCityOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const ageNum = Number(age);
  const ageValid = Number.isFinite(ageNum) && ageNum >= 18 && ageNum <= 100;
  const genderValid = !!gender;
  const genderPrefValid = genderPreferences.length > 0;
  const cityValid = city.trim().length > 0;
  const bioRemaining = 160 - bio.length;

  // Bio is truly optional now - removed from canContinue check
  const canContinue = ageValid && genderValid && genderPrefValid && cityValid && !saving;

  const toggleGenderPref = (g: string) => {
    setGenderPreferences(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  const save = async () => {
    if (!canContinue) return;
    try {
      setSaving(true);
      const u = FirebaseAuthService.getCurrentUser();
      if (!u) return;
      await FirestoreService.createUserProfileIfMissing(u.uid);
      await FirestoreService.updateUserProfile(u.uid, {
        age: ageNum,
        gender,
        genderPreferences,
        city: city.trim(),
        bio: bio.trim() || undefined,
        hasProfile: true,
      });
      navigation.replace('EditPreferences');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>set up your profile</Text>
      <Text style={s.sub}>these help us personalize your matches</Text>

      <View style={s.card}>
        <Text style={s.label}>age</Text>
        <TextInput
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          placeholder="e.g. 24"
          placeholderTextColor={C.dim}
          keyboardAppearance="dark"
          style={[s.input, !ageValid && age.length > 0 ? s.inputError : null]}
        />
        {!ageValid && age.length > 0 && <Text style={s.err}>enter a number between 18–100</Text>}

        <Text style={[s.label, { marginTop: 16 }]}>gender</Text>
        <View style={s.chips}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => setGender(g === gender ? '' : g)}
              style={[s.chip, g === gender && s.chipOn]}
            >
              <Text style={[s.chipTxt, g === gender && s.chipTxtOn]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>
          genders i'd like to match <Text style={s.dim}>(pick at least 1)</Text>
        </Text>
        <View style={s.chips}>
          {GENDERS.map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => toggleGenderPref(g)}
              style={[s.chip, genderPreferences.includes(g) && s.chipOn]}
            >
              <Text style={[s.chipTxt, genderPreferences.includes(g) && s.chipTxtOn]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>city</Text>
        <TouchableOpacity onPress={() => setCityOpen(true)} style={s.picker}>
          <Text style={city ? s.pickerTxt : s.pickerPlaceholder}>{city || 'choose your city'}</Text>
        </TouchableOpacity>

        <Text style={[s.label, { marginTop: 16 }]}>
          bio <Text style={s.dim}>(optional, {bioRemaining} left)</Text>
        </Text>
        <TextInput
          value={bio}
          onChangeText={(t) => t.length <= 160 && setBio(t)}
          placeholder="say hi (max 160)"
          placeholderTextColor={C.dim}
          keyboardAppearance="dark"
          style={[s.input, s.multiline]}
          multiline
        />

        <Text style={[s.label, { marginTop: 16 }]}>photos</Text>
        <View style={s.photosBox}>
          <Text style={s.dim}>photo uploader coming next</Text>
        </View>
      </View>

      <TouchableOpacity disabled={!canContinue} onPress={save} style={[s.primary, !canContinue && { opacity: 0.5 }]}>
        <Text style={s.primaryText}>{saving ? 'saving…' : 'continue'}</Text>
      </TouchableOpacity>

      <Modal visible={cityOpen} transparent animationType="fade" onRequestClose={() => setCityOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>select your city</Text>
            <FlatList
              data={SORTED_CITIES}
              keyExtractor={(x) => x}
              initialNumToRender={20}
              getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setCity(item);
                    setCityOpen(false);
                  }}
                  style={s.cityItem}
                >
                  <Text style={s.cityTxt}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity onPress={() => setCityOpen(false)} style={s.modalClose}>
              <Text style={s.modalCloseTxt}>close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, backgroundColor: C.bg, padding: 20, paddingTop: 72 },
  title: { color: C.text, fontSize: 24, textAlign: 'center', textTransform: 'lowercase', fontWeight: '700' },
  sub: { color: C.dim, textAlign: 'center', marginTop: 6, textTransform: 'lowercase' },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: { color: C.text, textTransform: 'lowercase', marginBottom: 6, fontWeight: '600' },
  dim: { color: C.dim },
  input: {
    color: C.text,
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputError: { borderColor: '#A01D1D' },
  err: { color: '#F0E4C1', opacity: 0.8, marginTop: 6, textTransform: 'lowercase' },
  multiline: { height: 110, textAlignVertical: 'top' },

  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  chipOn: { backgroundColor: '#511619' },
  chipTxt: { color: C.text, textTransform: 'lowercase' },
  chipTxtOn: { color: C.text, fontWeight: '700' },

  picker: {
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  pickerTxt: { color: C.text, textTransform: 'lowercase', fontSize: 15 },
  pickerPlaceholder: { color: C.dim, textTransform: 'lowercase', fontSize: 15 },

  photosBox: {
    height: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(240,228,193,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primary: { backgroundColor: C.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
  primaryText: { color: C.text, fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    width: '100%',
    backgroundColor: C.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    maxHeight: '60%',
  },
  modalTitle: { color: C.text, fontSize: 16, fontWeight: '700', textTransform: 'lowercase', textAlign: 'center', marginBottom: 6 },

  cityItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  cityTxt: { color: C.text, textTransform: 'lowercase', fontSize: 15, textAlign: 'center' },

  modalClose: { paddingVertical: 12, alignSelf: 'center' },
  modalCloseTxt: { color: C.dim, textTransform: 'lowercase' },
});