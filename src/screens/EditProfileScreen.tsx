// src/screens/EditProfileScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Dimensions,
  Modal,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { FirebaseAuthService } from "../services/FirebaseAuthService";
import { FirestoreService } from "../services/FirestoreService";
import * as ImagePicker from 'expo-image-picker';
import { FirebaseStorageService } from '../services/FirebaseStorageService';
import DraggableFlatList, {
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// --- GRID DIMENSIONS ---
const { width } = Dimensions.get('window');
const SCREEN_PADDING = 20;
const COLUMN_COUNT = 3;
const GAP = 12; 
const PHOTO_SIZE = (width - (SCREEN_PADDING * 2) - (GAP * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

type Draft = {
  displayName: string;
  age: string;
  city: string;
  gender: string;
  interestedIn: string[];
  bio: string;
  photos: string[];
  email: string;
};

type GridItem = {
  id: string;
  type: 'photo' | 'add';
  uri?: string;
};

const GENDER_OPTIONS = ["female", "male", "nonbinary", "other"];
const INTERESTED_OPTIONS = ["female", "male", "nonbinary", "other"];
const MAX_BIO = 160;
const MAX_PHOTOS = 6;

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    displayName: "",
    age: "",
    city: "",
    gender: "",
    interestedIn: [],
    bio: "",
    photos: [],
    email: "",
  });
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const bioCount = useMemo(() => draft.bio.length, [draft.bio]);

  const gridData: GridItem[] = useMemo(() => {
    const items: GridItem[] = draft.photos.map((uri, index) => ({
      id: `photo-${uri}-${index}`,
      type: 'photo',
      uri,
    }));
    if (draft.photos.length < MAX_PHOTOS) {
      items.push({ id: 'add-btn', type: 'add' });
    }
    return items;
  }, [draft.photos]);

  useEffect(() => {
    (async () => {
      try {
        const user = FirebaseAuthService.getCurrentUser();
        if (!user) {
          Alert.alert("error", "no user.");
          return;
        }
        const profile = await FirestoreService.getUserProfile(user.uid);

        const interestedArray = Array.isArray((profile as any)?.genderPreferences)
          ? (profile as any).genderPreferences
          : Array.isArray((profile as any)?.interestedIn)
          ? (profile as any).interestedIn
          : [];

        const existingPhotos = profile?.photos && Array.isArray(profile.photos) 
          ? profile.photos.filter(p => p && p.trim())
          : [];

        setDraft({
          displayName: profile?.displayName || "",
          age: profile?.age ? String(profile.age) : "",
          city: (profile as any)?.city || "",
          gender: (profile as any)?.gender || "",
          interestedIn: interestedArray,
          bio: profile?.bio || "",
          photos: existingPhotos,
          email: user.email || "",
        });
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const handlePhotoUpload = async (index?: number) => {
     try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled) processUpload(result.assets[0].uri, index);
    } catch (error) { Alert.alert("Error", "Failed"); }
  };

  const handleTakePhoto = async (index?: number) => {
     try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });
      if (!result.canceled) processUpload(result.assets[0].uri, index);
    } catch (error) { Alert.alert("Error", "Failed"); }
  };

  const processUpload = async (localUri: string, index?: number) => {
    const user = FirebaseAuthService.getCurrentUser();
    if (!user) return;
    setUploading(true);
    try {
      const targetIndex = index !== undefined ? index : draft.photos.length;
      const downloadURL = await FirebaseStorageService.uploadProfilePhoto(localUri, user.uid, targetIndex);
      setDraft((prev) => {
        const newPhotos = [...prev.photos];
        if (index !== undefined && index < newPhotos.length) newPhotos[index] = downloadURL;
        else newPhotos.push(downloadURL);
        return { ...prev, photos: newPhotos };
      });
    } catch (e) { Alert.alert("Error", "Upload failed."); } 
    finally { setUploading(false); }
  };

  const showPhotoOptions = () => {
    Alert.alert("Add Photo", "Choose an option", [
      { text: "Take Photo", onPress: () => handleTakePhoto() },
      { text: "Choose from Library", onPress: () => handlePhotoUpload() },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const removePhoto = (index: number) => {
    if (draft.photos.length <= 1) {
      Alert.alert("Cannot remove", "Keep at least one photo.");
      return;
    }
    setDraft((prev) => {
      const newPhotos = [...prev.photos];
      newPhotos.splice(index, 1);
      return { ...prev, photos: newPhotos };
    });
    setSelectedPhotoIndex(null);
  };

  const save = async () => {
    const user = FirebaseAuthService.getCurrentUser();
    if (!user) return;
    setSaving(true);
    try {
      await FirestoreService.saveUserProfile(user.uid, {
        displayName: draft.displayName.trim(),
        age: Number(draft.age.trim()),
        city: draft.city.trim(),
        gender: draft.gender,
        genderPreferences: draft.interestedIn,
        bio: draft.bio.trim(),
        photos: draft.photos,
      });
      Alert.alert("Saved", "Profile updated.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (e) { Alert.alert("Error", "Could not save."); } 
    finally { setSaving(false); }
  };

  const onDragEnd = ({ data }: { data: GridItem[] }) => {
    const newPhotos = data.filter((item) => item.type === 'photo').map((item) => item.uri!);
    setDraft((prev) => ({ ...prev, photos: newPhotos }));
  };

  // --- MANUAL OVERRIDE RENDER FUNCTION ---
  const renderGridItem = ({ item, drag, isActive, getIndex }: RenderItemParams<GridItem>) => {
    if (item.type === 'add') {
      return (
        <View style={[styles.photoSlotWrapper, { marginBottom: GAP, marginRight: GAP }]}>
          <TouchableOpacity
            style={[styles.photoSlot, styles.emptyPhotoSlot]}
            onPress={showPhotoOptions}
            disabled={uploading}
          >
            <Text style={styles.plusIcon}>{uploading ? '...' : '+'}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const isFirst = getIndex() === 0;
    
    return (
      <TouchableOpacity
        onLongPress={drag}
        onPress={() => !isActive && setSelectedPhotoIndex(getIndex() || 0)}
        disabled={isActive || uploading}
        delayLongPress={100}
        activeOpacity={1} // Disable default press opacity
        style={[
          styles.photoSlotWrapper,
          { 
            marginBottom: GAP, 
            marginRight: GAP,
            // MANUAL GHOST LOGIC:
            transform: [{ scale: isActive ? 1.1 : 1 }],
            opacity: isActive ? 0.7 : 1,
            zIndex: isActive ? 9999 : 1,
            elevation: isActive ? 10 : 0,
          }
        ]}
      >
        <View style={[
          styles.photoContent,
          // MANUAL BORDER LOGIC:
          isActive && { 
            borderColor: '#F0E4C1', 
            borderWidth: 2,
            backgroundColor: '#111C2A', // Needed for shadow on Android
          }
        ]}>
          <Image source={{ uri: item.uri }} style={styles.photoImage} />
          
          {!isActive && isFirst && (
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>profile</Text>
            </View>
          )}
          {!isActive && (
            <View style={styles.dragHandle}>
              <Text style={styles.dragHandleText}>⋮⋮</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>edit profile</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>photos</Text>
          <Text style={styles.photoHint}>long press & drag to reorder</Text>
          
          <View style={styles.gridContainer}>
            <DraggableFlatList
              data={gridData}
              onDragEnd={onDragEnd}
              keyExtractor={(item) => item.id}
              renderItem={renderGridItem}
              numColumns={COLUMN_COUNT}
              scrollEnabled={false}
            />
          </View>

          {/* Form Inputs */}
          <Text style={styles.label}>email</Text>
          <View style={styles.emailBox}><Text style={styles.emailText}>{draft.email}</Text></View>

          <Text style={styles.label}>display name</Text>
          <TextInput
            value={draft.displayName}
            onChangeText={(t) => setDraft(p => ({ ...p, displayName: t }))}
            style={styles.input}
            placeholder="your name"
            placeholderTextColor="rgba(240,228,193,0.5)"
          />

          <Text style={styles.dualLabel}>age • city</Text>
          <View style={styles.row}>
            <TextInput
              value={draft.age}
              onChangeText={(t) => setDraft(p => ({ ...p, age: t.replace(/[^0-9]/g, "") }))}
              style={[styles.input, styles.inputHalf]}
              keyboardType="number-pad"
              placeholder="18+"
              placeholderTextColor="rgba(240,228,193,0.5)"
              maxLength={3}
            />
            <TextInput
              value={draft.city}
              onChangeText={(t) => setDraft(p => ({ ...p, city: t }))}
              style={[styles.input, styles.inputHalf]}
              placeholder="city"
              placeholderTextColor="rgba(240,228,193,0.5)"
            />
          </View>

          <Text style={styles.label}>gender</Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setDraft((p) => ({ ...p, gender: option }))}
                style={[styles.pill, draft.gender === option && styles.pillActive]}
              >
                <Text style={[styles.pillText, draft.gender === option && styles.pillTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>interested in</Text>
          <View style={styles.genderRow}>
            {INTERESTED_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setDraft(p => {
                  const has = p.interestedIn.includes(option);
                  return { ...p, interestedIn: has ? p.interestedIn.filter(x => x !== option) : [...p.interestedIn, option] };
                })}
                style={[styles.pill, draft.interestedIn.includes(option) && styles.pillActive]}
              >
                <Text style={[styles.pillText, draft.interestedIn.includes(option) && styles.pillTextActive]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>bio <Text style={styles.counter}>{bioCount}/{MAX_BIO}</Text></Text>
          <TextInput
            value={draft.bio}
            onChangeText={(t) => setDraft(p => ({ ...p, bio: t.slice(0, MAX_BIO) }))}
            style={[styles.input, styles.textarea]}
            multiline
            placeholder="write something..."
            placeholderTextColor="rgba(240,228,193,0.5)"
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={save}
            disabled={saving}
          >
            <Text style={styles.saveText}>{saving ? "saving…" : "save changes"}</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Photo Preview Modal */}
        <Modal
          visible={selectedPhotoIndex !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedPhotoIndex(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={styles.modalBackground} onPress={() => setSelectedPhotoIndex(null)} />
            <View style={styles.modalContent}>
              {selectedPhotoIndex !== null && (
                <>
                  <Image source={{ uri: draft.photos[selectedPhotoIndex] }} style={styles.modalImage} resizeMode="contain" />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removePhoto(selectedPhotoIndex)}
                  >
                    <Text style={styles.removeButtonText}>Remove Photo</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111C2A" },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingTop: 16, alignItems: 'center' },
  backButton: { padding: 4 },
  backText: { color: '#F0E4C1', fontSize: 16 },
  headerTitle: { color: '#F0E4C1', fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20, paddingBottom: 60 },

  gridContainer: { marginBottom: 10 },
  photoSlotWrapper: { width: PHOTO_SIZE, height: PHOTO_SIZE },
  photoSlot: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  photoContent: { flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(240,228,193,0.05)' },
  photoImage: { width: '100%', height: '100%' },
  
  emptyPhotoSlot: { borderWidth: 2, borderColor: 'rgba(240,228,193,0.2)', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  plusIcon: { color: 'rgba(240,228,193,0.4)', fontSize: 40, fontWeight: '300' },
  
  profileBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: 'rgba(81, 22, 25, 0.9)', paddingHorizontal: 6, borderRadius: 4 },
  profileBadgeText: { color: '#F0E4C1', fontSize: 10, fontWeight: '700' },
  dragHandle: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 6, borderRadius: 4 },
  dragHandleText: { color: '#F0E4C1', fontSize: 14, fontWeight: 'bold' },

  label: { color: "#F0E4C1", fontSize: 15, marginTop: 20, marginBottom: 8, fontWeight: "600", textTransform: 'lowercase' },
  dualLabel: { color: "#F0E4C1", fontSize: 15, marginTop: 20, marginBottom: 8, fontWeight: "600", textTransform: 'lowercase' },
  photoHint: { color: 'rgba(240,228,193,0.5)', fontSize: 12, textAlign: 'center', marginBottom: 15 },
  emailBox: { backgroundColor: "rgba(240,228,193,0.04)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(240,228,193,0.1)" },
  emailText: { color: "rgba(240,228,193,0.6)", fontSize: 16 },
  input: { backgroundColor: "rgba(240,228,193,0.06)", borderRadius: 12, padding: 14, color: "#F0E4C1", fontSize: 16, borderWidth: 1, borderColor: "rgba(240,228,193,0.15)" },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  inputHalf: { flex: 1, marginHorizontal: 5 },
  counter: { fontSize: 12, color: 'rgba(240,228,193,0.4)' },

  genderRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  pill: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(240,228,193,0.2)", backgroundColor: "rgba(240,228,193,0.05)", margin: 4 },
  pillActive: { backgroundColor: "#511619", borderColor: "#511619" },
  pillText: { color: "rgba(240,228,193,0.7)", fontWeight: "600" },
  pillTextActive: { color: "#F0E4C1" },

  saveBtn: { backgroundColor: "#511619", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 30 },
  saveText: { color: "#F0E4C1", fontWeight: "bold", fontSize: 16, textTransform: 'lowercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalContent: { width: '90%', alignItems: 'center' },
  modalImage: { width: '100%', height: 400, borderRadius: 12, marginBottom: 20 },
  removeButton: { backgroundColor: '#511619', padding: 12, borderRadius: 8 },
  removeButtonText: { color: '#F0E4C1', fontWeight: 'bold' },
});