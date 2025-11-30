// src/screens/SetUpProfileScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, Modal, FlatList, Image, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { TextModerationService } from "../services/TextModerationService";
import { CloudinaryService } from "../services/CloudinaryService";

const C = { bg: '#111C2A', card: '#121D2B', text: '#F0E4C1', dim: 'rgba(240,228,193,0.75)', accent: '#511619' };

const GENDERS = ['female', 'male', 'nonbinary', 'other'] as const;
const INTENTS = ['friends', 'romance'] as const; // <--- NEW CONSTANT

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

// --- CLOUDINARY UPLOAD FUNCTION (OPTIMIZED) ---
const uploadToCloudinary = async (imageUri: string) => {
  const data = new FormData();
  
  // @ts-ignore - React Native expects this specific object format
  data.append('file', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'upload.jpg',
  });

  data.append('upload_preset', 'frkquqkj'); // Your Preset
  data.append('cloud_name', 'dhbzqhtr5');   // Your Cloud Name

  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/dhbzqhtr5/image/upload', {
      method: 'post',
      body: data,
    });
    const result = await res.json();
    
    // ⚡️ OPTIMIZATION: Inject auto-format and auto-quality
    if (result.secure_url) {
      return result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/');
    }
    return null;
  } catch (e) {
    console.error("Cloudinary Upload Error:", e);
    return null;
  }
};

export default function SetUpProfileScreen({ onComplete }: { onComplete: () => void }) {
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [genderPreferences, setGenderPreferences] = useState<string[]>([]);
  const [intent, setIntent] = useState<string[]>([]); // <--- NEW STATE
  const [city, setCity] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [cityOpen, setCityOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const ageNum = Number(age);
  const ageValid = Number.isFinite(ageNum) && ageNum >= 18 && ageNum <= 100;
  const genderValid = !!gender;
  const genderPrefValid = genderPreferences.length > 0;
  const intentValid = intent.length > 0; // <--- NEW VALIDATION
  const cityValid = city.trim().length > 0;
  const photosValid = photos.length > 0;
  const bioRemaining = 160 - bio.length;

  // Added intentValid to canContinue
  const canContinue = ageValid && genderValid && genderPrefValid && intentValid && cityValid && photosValid && !saving;

  const toggleGenderPref = (g: string) => {
    setGenderPreferences(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  };

  // <--- NEW TOGGLE FUNCTION
  const toggleIntent = (i: string) => {
    setIntent(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  };

  const pickImage = async () => {
    if (photos.length >= 6) {
      Alert.alert('limit reached', 'you can upload up to 6 photos');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('permission needed', 'we need access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotos(prev => [...prev, result.assets[0].uri]);
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos(prev => prev.filter(x => x !== uri));
  };

const save = async () => {
    if (!canContinue) return;

    // 1. Validate Text
    const errorMsg = TextModerationService.validateProfileFields("User", bio); // passing "User" as dummy name since this screen doesn't seem to set Display Name? 
    // If you add a display name input here, validate it too.
    if (errorMsg && errorMsg.includes("bio")) {
       Alert.alert("Content Warning", "Your bio contains inappropriate language.");
       return;
    }

    try {
      setSaving(true);
      setUploading(true);
      const u = FirebaseAuthService.getCurrentUser();
      if (!u) {
        Alert.alert('error', 'no user found. please log in again.');
        return;
      }
      
      console.log('Uploading', photos.length, 'photos to Cloudinary...');
      const photoUrls: string[] = [];
      
      // 2. Use new Cloudinary Service
      for (let i = 0; i < photos.length; i++) {
        // If the photo is already a remote URL (cloudinary), keep it. 
        // If it's a local file (file://), upload it.
        if (photos[i].startsWith('http')) {
            photoUrls.push(photos[i]);
        } else {
            const url = await CloudinaryService.uploadImage(photos[i]);
            if (url) photoUrls.push(url);
            else {
                // If upload returns null (rejected), stop the process
                setSaving(false);
                setUploading(false);
                return; 
            }
        }
      }
      const profileData: any = {
        age: ageNum,
        gender,
        genderPreferences,
        relationshipIntent: intent, // <--- SAVING INTENT
        city: city.trim(),
        photos: photoUrls,
        hasProfile: true,
      };
      
      if (bio.trim()) profileData.bio = bio.trim();
      
      await FirestoreService.saveUserProfile(u.uid, profileData);
      onComplete();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('error', 'failed to save profile. please try again.');
    } finally {
      setSaving(false);
      setUploading(false);
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

        {/* --- NEW INTENT SECTION --- */}
        <Text style={[s.label, { marginTop: 16 }]}>
          i'm here for <Text style={s.dim}>(pick at least 1)</Text>
        </Text>
        <View style={s.chips}>
          {INTENTS.map((i) => (
            <TouchableOpacity
              key={i}
              onPress={() => toggleIntent(i)}
              style={[s.chip, intent.includes(i) && s.chipOn]}
            >
              <Text style={[s.chipTxt, intent.includes(i) && s.chipTxtOn]}>{i}</Text>
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

        <Text style={[s.label, { marginTop: 16 }]}>
          photos <Text style={s.dim}>(add at least 1, max 6)</Text>
        </Text>
        <View style={s.photosGrid}>
          {photos.map((uri, idx) => (
            <View key={idx} style={s.photoBox}>
              <Image source={{ uri }} style={s.photo} />
              <TouchableOpacity onPress={() => removePhoto(uri)} style={s.removeBtn}>
                <Text style={s.removeTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 6 && (
            <TouchableOpacity onPress={pickImage} style={s.addPhotoBox}>
              <Text style={s.addPhotoTxt}>+</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <TouchableOpacity disabled={!canContinue} onPress={save} style={[s.primary, !canContinue && { opacity: 0.5 }]}>
        <Text style={s.primaryText}>
          {uploading ? 'uploading photos…' : saving ? 'saving…' : 'continue'}
        </Text>
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

  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoBox: {
    width: 100,
    height: 130,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeTxt: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  addPhotoBox: {
    width: 100,
    height: 130,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(240,228,193,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoTxt: {
    color: C.text,
    fontSize: 40,
    fontWeight: '300',
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