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

const GENDER_OPTIONS = ["female", "male", "non-binary", "prefer not to say"];
const INTERESTED_OPTIONS = ["women", "men", "non-binary", "everyone"];
const MAX_BIO = 160;
const MAX_PHOTOS = 3;

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
    photos: ["", "", ""],
    email: "",
  });

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
          ? profile.photos.slice(0, MAX_PHOTOS) 
          : [];
        
        const photosFilled = [...existingPhotos];
        while (photosFilled.length < MAX_PHOTOS) {
          photosFilled.push("");
        }

        const d: Draft = {
          displayName: profile?.displayName || "",
          age: profile?.age ? String(profile.age) : "",
          city: (profile as any)?.city || "",
          gender: (profile as any)?.gender || "",
          interestedIn: interestedArray,
          bio: profile?.bio || "",
          photos: photosFilled,
          email: user.email || "",
        };
        setDraft(d);
      } catch (e) {
        console.error("Error loading profile:", e);
        Alert.alert("error", "failed to load profile.");
      }
    })();
  }, []);

  const setPhotoAt = (idx: number, url: string) => {
    setDraft((prev) => {
      const next = [...prev.photos];
      next[idx] = url;
      return { ...prev, photos: next };
    });
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
      bioCount <= MAX_BIO
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
      Alert.alert("required", "please select who you'd like to match with.");
      return;
    }
    if (bioCount > MAX_BIO) {
      Alert.alert("bio too long", `bio must be ≤ ${MAX_BIO} characters.`);
      return;
    }

    const photosClean = draft.photos
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, MAX_PHOTOS);

    const patch = {
      displayName: draft.displayName.trim(),
      age: ageNum,
      city: draft.city.trim(),
      gender: draft.gender,
      interestedIn: draft.interestedIn,
      bio: draft.bio.trim() || undefined,
      photos: photosClean,
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

        <Text style={styles.label}>interested in (select all that apply)</Text>
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

        <Text style={styles.label}>photos (up to {MAX_PHOTOS})</Text>
        <View style={styles.photosGrid}>
          {draft.photos.map((url, idx) => (
            <View key={idx} style={styles.photoBox}>
              {url ? (
                <Image source={{ uri: url }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>{idx + 1}</Text>
                </View>
              )}
              <TextInput
                value={url}
                onChangeText={(t) => setPhotoAt(idx, t)}
                style={styles.photoInput}
                placeholder="image url"
                placeholderTextColor="rgba(240,228,193,0.5)"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (!isProfileValid() || saving) && { opacity: 0.6 }]}
          onPress={save}
          disabled={!isProfileValid() || saving}
        >
          <Text style={styles.saveText}>{saving ? "saving…" : "save changes"}</Text>
        </TouchableOpacity>
      </ScrollView>
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

  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  photoBox: {
    width: PHOTO_SIZE - 7,
  },
  photoPreview: {
    width: '100%',
    height: PHOTO_SIZE * 1.3,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(240,228,193,0.05)',
  },
  photoPlaceholder: {
    width: '100%',
    height: PHOTO_SIZE * 1.3,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(240,228,193,0.05)',
    borderWidth: 2,
    borderColor: 'rgba(240,228,193,0.2)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    color: 'rgba(240,228,193,0.4)',
    fontSize: 32,
    fontWeight: 'bold',
  },
  photoInput: {
    backgroundColor: "rgba(240,228,193,0.06)",
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#F0E4C1",
    fontSize: 13,
  },

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
});