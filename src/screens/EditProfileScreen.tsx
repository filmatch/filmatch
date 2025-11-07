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
  PanResponder,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useNavigation } from "@react-navigation/native";
import { FirebaseAuthService } from "../services/FirebaseAuthService";
import { FirestoreService } from "../services/FirestoreService";

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

const GENDER_OPTIONS = ["female", "male", "nonbinary", "other"];
const INTERESTED_OPTIONS = ["female", "male", "nonbinary", "other"];
const MAX_BIO = 160;
const MAX_PHOTOS = 6;

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const bioCount = useMemo(() => draft.bio.length, [draft.bio]);

  useEffect(() => {
    (async () => {
      try {
        const user = FirebaseAuthService.getCurrentUser();
        if (!user) {
          Alert.alert("error", "no user. please sign in again.");
          return;
        }
        const profile = await FirestoreService.getUserProfile(user.uid);

        const interestedArray = Array.isArray((profile as any)?.interestedIn)
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

  const handlePhotoUpload = (index: number) => {
    // Placeholder for image picker - to be implemented
    Alert.alert("upload photo", "image picker will be implemented here");
    // TODO: Implement expo-image-picker
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

  const movePhoto = (fromIndex: number, toIndex: number) => {
    setDraft((prev) => {
      const newPhotos = [...prev.photos];
      const [moved] = newPhotos.splice(fromIndex, 1);
      newPhotos.splice(toIndex, 0, moved);
      return { ...prev, photos: newPhotos };
    });
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

  const renderPhotoSlot = (index: number) => {
    const photo = draft.photos[index];
    const isLastSlot = index >= draft.photos.length && draft.photos.length < MAX_PHOTOS;
    
    if (photo) {
      return (
        <TouchableOpacity
          key={index}
          style={styles.photoSlot}
          onPress={() => setSelectedPhotoIndex(index)}
          onLongPress={() => setDraggedIndex(index)}
        >
          <Image source={{ uri: photo }} style={styles.photoImage} />
          {index === 0 && (
            <View style={styles.profileBadge}>
              <Text style={styles.profileBadgeText}>profile</Text>
            </View>
          )}
        </TouchableOpacity>
      );
    } else if (isLastSlot) {
      return (
        <TouchableOpacity
          key={index}
          style={[styles.photoSlot, styles.emptyPhotoSlot]}
          onPress={() => handlePhotoUpload(index)}
        >
          <Text style={styles.plusIcon}>+</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
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
        {/* Profile Photo Display */}
        {draft.photos.length > 0 && (
          <View style={styles.profilePhotoContainer}>
            <Image source={{ uri: draft.photos[0] }} style={styles.profilePhoto} />
          </View>
        )}

        {/* Photos Grid */}
        <Text style={styles.label}>photos (up to {MAX_PHOTOS})</Text>
        <View style={styles.photosGrid}>
          {Array.from({ length: Math.min(draft.photos.length + 1, MAX_PHOTOS) }).map((_, idx) => 
            renderPhotoSlot(idx)
          )}
        </View>
        <Text style={styles.photoHint}>tap and hold to rearrange • first photo is your profile photo</Text>

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

      {/* Photo Viewer Modal */}
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

  profilePhotoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profilePhoto: {
    width: (width - 60) / 4 - 6,
    height: (width - 60) / 4 - 6,
    borderRadius: 8,
    backgroundColor: 'rgba(240,228,193,0.05)',
  },
  
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

  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  photoSlot: {
    width: PHOTO_SIZE - 7,
    height: PHOTO_SIZE - 7,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(240,228,193,0.05)',
  },
  emptyPhotoSlot: {
    backgroundColor: 'rgba(240,228,193,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(240,228,193,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
  photoHint: {
    color: 'rgba(240,228,193,0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
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
  row: { flexDirection: "row", gap: 10 },
  inputHalf: { flex: 1 },

  genderRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  genderPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.3)",
    backgroundColor: "rgba(240,228,193,0.05)",
  },
  genderPillActive: { backgroundColor: "#511619", borderColor: "#511619" },
  genderText: {
    color: "rgba(240,228,193,0.8)",
    textTransform: "lowercase",
    fontWeight: "700",
    fontSize: 15,
  },
  genderTextActive: { color: "#F0E4C1" },

  interestedRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  interestedPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.3)",
    backgroundColor: "rgba(240,228,193,0.05)",
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

  // Modal styles
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
    gap: 16,
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
    gap: 12,
    justifyContent: 'center',
  },
  removeButton: {
    backgroundColor: '#511619',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
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