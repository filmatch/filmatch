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
  OpacityDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 60) / 3;

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

type PhotoItem = {
  id: string;
  uri: string;
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

  const photoItems: PhotoItem[] = useMemo(() => 
    draft.photos.map((uri, index) => ({
      id: `photo-${index}-${uri.slice(-10)}`,
      uri,
    })),
    [draft.photos]
  );

  useEffect(() => {
    (async () => {
      try {
        const user = FirebaseAuthService.getCurrentUser();
        if (!user) {
          Alert.alert("error", "no user. please sign in again.");
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

        const d: Draft = {
          displayName: profile?.displayName || "",
          age: profile?.age ? String(profile.age) : "",
          city: (profile as any)?.city || "",
          gender: (profile as any)?.gender || "",
          interestedIn: interestedArray,
          bio: profile?.bio || "",
          photos: existingPhotos,
          email: user.email || "",
        };
        setDraft(d);
      } catch (e) {
        console.error("Error loading profile:", e);
        Alert.alert("error", "failed to load profile.");
      }
    })();
  }, []);

  const handlePhotoUpload = async (index?: number) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need camera roll permissions to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const user = FirebaseAuthService.getCurrentUser();
      if (!user) {
        Alert.alert("Error", "No user found. Please sign in again.");
        return;
      }

      setUploading(true);

      const photoIndex = index !== undefined ? index : draft.photos.length;
      const downloadURL = await FirebaseStorageService.uploadProfilePhoto(
        result.assets[0].uri,
        user.uid,
        photoIndex
      );

      setDraft((prev) => {
        const newPhotos = [...prev.photos];
        if (index !== undefined && index < newPhotos.length) {
          newPhotos[index] = downloadURL;
        } else {
          newPhotos.push(downloadURL);
        }
        return { ...prev, photos: newPhotos };
      });

      Alert.alert("Success", "Photo uploaded successfully!");
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert("Error", "Failed to upload photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleTakePhoto = async (index?: number) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const user = FirebaseAuthService.getCurrentUser();
      if (!user) {
        Alert.alert("Error", "No user found. Please sign in again.");
        return;
      }

      setUploading(true);

      const photoIndex = index !== undefined ? index : draft.photos.length;
      const downloadURL = await FirebaseStorageService.uploadProfilePhoto(
        result.assets[0].uri,
        user.uid,
        photoIndex
      );

      setDraft((prev) => {
        const newPhotos = [...prev.photos];
        if (index !== undefined && index < newPhotos.length) {
          newPhotos[index] = downloadURL;
        } else {
          newPhotos.push(downloadURL);
        }
        return { ...prev, photos: newPhotos };
      });

      Alert.alert("Success", "Photo uploaded successfully!");
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      "Add Photo",
      "Choose an option",
      [
        { text: "Take Photo", onPress: () => handleTakePhoto() },
        { text: "Choose from Library", onPress: () => handlePhotoUpload() },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const removePhoto = (index: number) => {
    if (draft.photos.length <= 1) {
      Alert.alert("cannot remove", "you must have at least one photo");
      return;
    }

    setDraft((prev) => {
      const newPhotos = [...prev.photos];
      newPhotos.splice(index, 1);
      return { ...prev, photos: newPhotos };
    });
    setSelectedPhotoIndex(null);
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (selectedPhotoIndex === null) return;
    
    if (direction === 'prev' && selectedPhotoIndex > 0) {
      setSelectedPhotoIndex(selectedPhotoIndex - 1);
    } else if (direction === 'next' && selectedPhotoIndex < draft.photos.length - 1) {
      setSelectedPhotoIndex(selectedPhotoIndex + 1);
    }
  };

  const toggleInterested = (option: string) => {
    setDraft((prev) => {
      const isSelected = prev.interestedIn.includes(option);
      const newInterested = isSelected
        ? prev.interestedIn.filter((p) => p !== option)
        : [...prev.interestedIn, option];
      return { ...prev, interestedIn: newInterested };
    });
  };

  const isProfileValid = () => {
    const ageNum = draft.age.trim() ? Number(draft.age.trim()) : NaN;
    return (
      draft.displayName.trim().length > 0 &&
      draft.city.trim().length > 0 &&
      draft.gender.length > 0 &&
      draft.interestedIn.length > 0 &&
      Number.isFinite(ageNum) &&
      ageNum >= 18 &&
      ageNum <= 100 &&
      bioCount <= MAX_BIO &&
      draft.photos.length > 0
    );
  };

  const save = async () => {
    const user = FirebaseAuthService.getCurrentUser();
    if (!user) {
      Alert.alert("error", "no user. please sign in again.");
      return;
    }

    const ageNum = draft.age.trim() ? Number(draft.age.trim()) : NaN;
    if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 100) {
      Alert.alert("invalid age", "age must be between 18 and 100.");
      return;
    }
    if (!draft.city.trim()) {
      Alert.alert("required", "city is required.");
      return;
    }
    if (!draft.gender) {
      Alert.alert("required", "please select your gender.");
      return;
    }
    if (draft.interestedIn.length === 0) {
      Alert.alert("required", "please select at least one gender you'd like to match with.");
      return;
    }
    if (draft.photos.length === 0) {
      Alert.alert("required", "you must have at least one photo.");
      return;
    }
    if (bioCount > MAX_BIO) {
      Alert.alert("bio too long", `bio must be ≤ ${MAX_BIO} characters.`);
      return;
    }

    const patch = {
      displayName: draft.displayName.trim(),
      age: ageNum,
      city: draft.city.trim(),
      gender: draft.gender,
      genderPreferences: draft.interestedIn,
      interestedIn: draft.interestedIn,
      bio: draft.bio.trim() || undefined,
      photos: draft.photos,
    };

    setSaving(true);
    try {
      await FirestoreService.saveUserProfile(user.uid, patch);
      Alert.alert("saved", "profile updated successfully.", [
        { text: "ok", onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      console.error("Save error:", e);
      Alert.alert("error", "could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleNameChange = (text: string) =>
    setDraft((p) => ({ ...p, displayName: text }));

  const handleAgeChange = (text: string) => {
    const numbersOnly = text.replace(/[^0-9]/g, "");
    setDraft((p) => ({ ...p, age: numbersOnly }));
  };

  const handleCityChange = (text: string) =>
    setDraft((p) => ({ ...p, city: text }));

  const handleBioChange = (text: string) => {
    const truncated = text.slice(0, MAX_BIO);
    setDraft((p) => ({ ...p, bio: truncated }));
  };

  const onDragEnd = ({ data }: { data: PhotoItem[] }) => {
    setDraft((prev) => ({
      ...prev,
      photos: data.map(item => item.uri),
    }));
  };

  const renderPhotoItem = ({ item, drag, isActive, getIndex }: RenderItemParams<PhotoItem>) => {
    const index = getIndex();
    const isFirst = index === 0;
    
    return (
      <OpacityDecorator activeOpacity={0.9}>
        <TouchableOpacity
          onPress={() => !isActive && setSelectedPhotoIndex(index || 0)}
          onLongPress={drag}
          disabled={uploading}
          delayLongPress={100}
          style={[
            styles.photoSlot,
            isActive && styles.photoSlotActive,
            { marginRight: 10, marginBottom: 10 }
          ]}
        >
          <View style={[styles.photoContent, isActive && styles.photoContentActive]}>
            <Image source={{ uri: item.uri }} style={styles.photoImage} />
            {isFirst && !isActive && (
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
      </OpacityDecorator>
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

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.label}>photos (up to {MAX_PHOTOS})</Text>
          <Text style={styles.photoHint}>
            long press & drag to reorder • first photo is your profile photo
          </Text>
          
          <View style={styles.photosContainer}>
            <DraggableFlatList
              data={photoItems}
              onDragEnd={onDragEnd}
              keyExtractor={(item) => item.id}
              renderItem={renderPhotoItem}
              numColumns={3}
              scrollEnabled={false}
              containerStyle={styles.photosGrid}
              activationDistance={10}
              renderPlaceholder={() => (
                <View style={[styles.photoSlot, styles.placeholderSlot, { marginRight: 10, marginBottom: 10 }]} />
              )}
            />
            
            {draft.photos.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={[styles.photoSlot, styles.emptyPhotoSlot]}
                onPress={showPhotoOptions}
                disabled={uploading}
              >
                <Text style={styles.plusIcon}>{uploading ? '...' : '+'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.label}>email</Text>
          <View style={styles.emailBox}>
            <Text style={styles.emailText}>{draft.email || "no email"}</Text>
          </View>

          <Text style={styles.label}>display name</Text>
          <TextInput
            value={draft.displayName}
            onChangeText={handleNameChange}
            style={styles.input}
            placeholder="your name"
            placeholderTextColor="rgba(240,228,193,0.5)"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
          />

          <Text style={styles.dualLabel}>age • city</Text>
          <View style={styles.row}>
            <TextInput
              value={draft.age}
              onChangeText={handleAgeChange}
              style={[styles.input, styles.inputHalf]}
              keyboardType="number-pad"
              placeholder="age (18+)"
              placeholderTextColor="rgba(240,228,193,0.5)"
              maxLength={3}
            />
            <TextInput
              value={draft.city}
              onChangeText={handleCityChange}
              style={[styles.input, styles.inputHalf]}
              placeholder="istanbul"
              placeholderTextColor="rgba(240,228,193,0.5)"
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={50}
            />
          </View>

          <Text style={styles.label}>gender</Text>
          <View style={styles.genderRow}>
            {GENDER_OPTIONS.map((option) => {
              const isSelected = draft.gender === option;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setDraft((p) => ({ ...p, gender: option }))}
                  style={[
                    styles.genderPill,
                    isSelected && styles.genderPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.genderText,
                      isSelected && styles.genderTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>genders i'd like to match (pick at least one)</Text>
          <View style={styles.interestedRow}>
            {INTERESTED_OPTIONS.map((option) => {
              const isSelected = draft.interestedIn.includes(option);
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => toggleInterested(option)}
                  style={[
                    styles.interestedPill,
                    isSelected && styles.interestedPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.interestedText,
                      isSelected && styles.interestedTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>
            bio <Text style={styles.counter}>{bioCount}/{MAX_BIO}</Text>
          </Text>
          <TextInput
            value={draft.bio}
            onChangeText={handleBioChange}
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={4}
            placeholder="say something about your movie taste"
            placeholderTextColor="rgba(240,228,193,0.5)"
            maxLength={MAX_BIO}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.saveBtn, (!isProfileValid() || saving) && { opacity: 0.6 }]}
            onPress={save}
            disabled={!isProfileValid() || saving}
          >
            <Text style={styles.saveText}>{saving ? "saving…" : "save changes"}</Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={selectedPhotoIndex !== null}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedPhotoIndex(null)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackground}
              activeOpacity={1}
              onPress={() => setSelectedPhotoIndex(null)}
            />
            
            <View style={styles.modalContent}>
              {selectedPhotoIndex !== null && (
                <>
                  <Image 
                    source={{ uri: draft.photos[selectedPhotoIndex] }} 
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                  
                  <View style={styles.modalControls}>
                    {selectedPhotoIndex > 0 && (
                      <TouchableOpacity 
                        style={styles.navButton}
                        onPress={() => navigatePhoto('prev')}
                      >
                        <Text style={styles.navButtonText}>←</Text>
                      </TouchableOpacity>
                    )}
                    
                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={[
                          styles.removeButton,
                          draft.photos.length <= 1 && styles.removeButtonDisabled
                        ]}
                        onPress={() => removePhoto(selectedPhotoIndex)}
                        disabled={draft.photos.length <= 1}
                      >
                        <Text style={[
                          styles.removeButtonText,
                          draft.photos.length <= 1 && styles.removeButtonTextDisabled
                        ]}>
                          remove
                        </Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setSelectedPhotoIndex(null)}
                      >
                        <Text style={styles.closeButtonText}>close</Text>
                      </TouchableOpacity>
                    </View>
                    
                    {selectedPhotoIndex < draft.photos.length - 1 && (
                      <TouchableOpacity 
                        style={styles.navButton}
                        onPress={() => navigatePhoto('next')}
                      >
                        <Text style={styles.navButtonText}>→</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <Text style={styles.photoCounter}>
                    {selectedPhotoIndex + 1} / {draft.photos.length}
                  </Text>
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
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240, 228, 193, 0.2)',
  },
  backButton: { padding: 4 },
  backText: { color: '#F0E4C1', fontSize: 16 },
  headerTitle: { color: '#F0E4C1', fontSize: 18, fontWeight: 'bold', textTransform: 'lowercase' },

  content: { padding: 20, paddingBottom: 40 },
  
  label: {
    color: "#F0E4C1",
    fontSize: 15,
    opacity: 0.9,
    marginTop: 18,
    marginBottom: 10,
    textTransform: "lowercase",
    fontWeight: "600",
  },
  dualLabel: {
    color: "#F0E4C1",
    fontSize: 15,
    opacity: 0.9,
    marginTop: 18,
    marginBottom: 10,
    textTransform: "lowercase",
    fontWeight: "600",
  },

  photosContainer: {
    marginBottom: 8,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoSlot: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  photoSlotActive: {
    zIndex: 1000,
  },
  photoContent: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(240,228,193,0.05)',
  },
  photoContentActive: {
    transform: [{ scale: 1.05 }],
    shadowColor: '#F0E4C1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 20,
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(240,228,193,0.05)',
  },
  placeholderSlot: {
    backgroundColor: 'rgba(81, 22, 25, 0.5)',
    borderWidth: 3,
    borderColor: '#F0E4C1',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  emptyPhotoSlot: {
    backgroundColor: 'rgba(240,228,193,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(240,228,193,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  plusIcon: {
    color: 'rgba(240,228,193,0.4)',
    fontSize: 48,
    fontWeight: '300',
  },
  profileBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(81, 22, 25, 0.9)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  profileBadgeText: {
    color: '#F0E4C1',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  dragHandle: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dragHandleText: {
    color: '#F0E4C1',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: -2,
  },
  photoHint: {
    color: 'rgba(240,228,193,0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'lowercase',
  },

  emailBox: {
    backgroundColor: "rgba(240,228,193,0.04)",
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emailText: {
    color: "rgba(240,228,193,0.7)",
    fontSize: 16,
  },

  input: {
    backgroundColor: "rgba(240,228,193,0.06)",
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#F0E4C1",
    fontSize: 16,
  },
  textarea: { minHeight: 100, textAlignVertical: "top" },
  counter: { color: "rgba(240,228,193,0.6)", fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  inputHalf: { flex: 1, marginHorizontal: 5 },

  genderRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  genderPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.3)",
    backgroundColor: "rgba(240,228,193,0.05)",
    margin: 5,
  },
  genderPillActive: { backgroundColor: "#511619", borderColor: "#511619" },
  genderText: {
    color: "rgba(240,228,193,0.8)",
    textTransform: "lowercase",
    fontWeight: "700",
    fontSize: 15,
  },
  genderTextActive: { color: "#F0E4C1" },

  interestedRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -5 },
  interestedPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.3)",
    backgroundColor: "rgba(240,228,193,0.05)",
    margin: 5,
  },
  interestedPillActive: { backgroundColor: "#511619", borderColor: "#511619" },
  interestedText: {
    color: "rgba(240,228,193,0.8)",
    textTransform: "lowercase",
    fontWeight: "700",
    fontSize: 15,
  },
  interestedTextActive: { color: "#F0E4C1" },

  saveBtn: {
    backgroundColor: "#511619",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 24,
  },
  saveText: { 
    color: "#F0E4C1", 
    fontWeight: "800", 
    fontSize: 16, 
    textTransform: "lowercase",
    letterSpacing: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
  },
  modalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(240,228,193,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.3)',
  },
  navButtonText: {
    color: '#F0E4C1',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 10,
  },
  removeButton: {
    backgroundColor: '#511619',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginRight: 6,
  },
  removeButtonDisabled: {
    backgroundColor: 'rgba(81,22,25,0.3)',
  },
  removeButtonText: {
    color: '#F0E4C1',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  removeButtonTextDisabled: {
    opacity: 0.5,
  },
  closeButton: {
    backgroundColor: 'rgba(240,228,193,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.3)',
    marginLeft: 6,
  },
  closeButtonText: {
    color: '#F0E4C1',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  photoCounter: {
    color: 'rgba(240,228,193,0.6)',
    fontSize: 14,
    marginTop: 12,
    textTransform: 'lowercase',
  },
});