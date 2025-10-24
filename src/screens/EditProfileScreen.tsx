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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { FirebaseAuthService } from "../services/FirebaseAuthService";
import * as FirestoreService from "../services/FirestoreService";

type Draft = {
  displayName: string;
  age: string;        // keep as string for input
  location: string;   // city
  pronouns: string[]; // store & edit as array
  bio: string;
  photos: string[];   // max 3 urls
};

// Pronouns shown SEPARATELY, multi-select
const PRONOUN_OPTIONS = ["she", "her", "he", "him", "they", "them", "prefer not to say"];
const MAX_BIO = 160;
const MAX_PHOTOS = 3;

export default function EditProfileScreen() {
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    displayName: "",
    age: "",
    location: "",
    pronouns: [],
    bio: "",
    photos: [""],
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

        const rawPronouns = (profile as any)?.pronouns;
        const pronounsArray: string[] =
          Array.isArray(rawPronouns)
            ? rawPronouns
            : typeof rawPronouns === "string" && rawPronouns.includes("/")
              ? rawPronouns.split("/").map((p: string) => p.trim()).filter(Boolean)
              : typeof rawPronouns === "string" && rawPronouns
                ? [rawPronouns]
                : [];

        const d: Draft = {
          displayName: profile?.displayName || "",
          age: profile?.age ? String(profile.age) : "",
          location: profile?.location || "",
          pronouns: pronounsArray,
          bio: profile?.bio || "",
          photos:
            profile?.photos && profile.photos.length
              ? profile.photos.slice(0, MAX_PHOTOS)
              : [""],
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

  const addPhotoField = () => {
    setDraft((p) =>
      p.photos.length >= MAX_PHOTOS ? p : { ...p, photos: [...p.photos, ""] }
    );
  };

  const removePhotoField = (idx: number) => {
    setDraft((p) => {
      const next = p.photos.filter((_, i) => i !== idx);
      return { ...p, photos: next.length ? next : [""] };
    });
  };

  const togglePronoun = (pronoun: string) => {
    setDraft((prev) => {
      const isSelected = prev.pronouns.includes(pronoun);
      const newPronouns = isSelected
        ? prev.pronouns.filter((p) => p !== pronoun)
        : [...prev.pronouns, pronoun];
      return { ...prev, pronouns: newPronouns };
    });
  };

  const isProfileValid = () => {
    const ageNum = draft.age.trim() ? Number(draft.age.trim()) : NaN;
    return (
      draft.displayName.trim().length > 0 &&
      draft.location.trim().length > 0 &&
      draft.pronouns.length > 0 &&
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
    if (!draft.location.trim()) {
      Alert.alert("required", "city is required.");
      return;
    }
    if (draft.pronouns.length === 0) {
      Alert.alert("required", "please choose your pronouns.");
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
      location: draft.location.trim(),
      pronouns: draft.pronouns, // store as array
      bio: draft.bio.trim() || undefined,
      photos: photosClean,
    };

    setSaving(true);
    try {
      await FirestoreService.saveUserProfile(user.uid, patch);
      Alert.alert("saved", "profile updated successfully.");
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

  const handleLocationChange = (text: string) =>
    setDraft((p) => ({ ...p, location: text }));

  const handleBioChange = (text: string) => {
    const truncated = text.slice(0, MAX_BIO);
    setDraft((p) => ({ ...p, bio: truncated }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.heading}>edit profile</Text>

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
            value={draft.location}
            onChangeText={handleLocationChange}
            style={[styles.input, styles.inputHalf]}
            placeholder="istanbul"
            placeholderTextColor="rgba(240,228,193,0.5)"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={50}
            blurOnSubmit={false}
            returnKeyType="next"
          />
        </View>

        <Text style={styles.label}>pronouns (select all that apply)</Text>
        <View style={styles.pronounsRow}>
          {PRONOUN_OPTIONS.map((pronoun) => {
            const isSelected = draft.pronouns.includes(pronoun);
            return (
              <TouchableOpacity
                key={pronoun}
                onPress={() => togglePronoun(pronoun)}
                style={[
                  styles.pronounPill,
                  isSelected && styles.pronounPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pronounText,
                    isSelected && styles.pronounTextActive,
                  ]}
                >
                  {pronoun}
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
        {draft.photos.map((url, idx) => (
          <View key={idx} style={styles.photoRow}>
            <TextInput
              value={url}
              onChangeText={(t) => setPhotoAt(idx, t)}
              style={[styles.input, styles.photoInput]}
              placeholder="https://…"
              placeholderTextColor="rgba(240,228,193,0.5)"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.smallBtn} onPress={() => removePhotoField(idx)}>
              <Text style={styles.smallBtnText}>remove</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={[styles.smallBtn, { alignSelf: "flex-start", marginBottom: 8 }]}
          onPress={addPhotoField}
          disabled={draft.photos.length >= MAX_PHOTOS}
        >
          <Text
            style={[
              styles.smallBtnText,
              draft.photos.length >= MAX_PHOTOS && { opacity: 0.5 },
            ]}
          >
            add another
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveBtn, (!isProfileValid() || saving) && { opacity: 0.6 }]}
          onPress={save}
          disabled={!isProfileValid() || saving}
        >
          <Text style={styles.saveText}>{saving ? "saving…" : "save"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#111C2A" },
  content: { padding: 20, paddingBottom: 40 },
  heading: {
    color: "#F0E4C1",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
    textTransform: "lowercase",
  },
  label: {
    color: "#F0E4C1",
    opacity: 0.9,
    marginTop: 14,
    marginBottom: 8,
    textTransform: "lowercase",
  },
  dualLabel: {
    color: "#F0E4C1",
    opacity: 0.9,
    marginTop: 14,
    marginBottom: 8,
    textTransform: "lowercase",
  },
  input: {
    backgroundColor: "rgba(240,228,193,0.06)",
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.2)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#F0E4C1",
    fontSize: 16,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  counter: { color: "rgba(240,228,193,0.7)" },
  row: { flexDirection: "row", gap: 10 },
  inputHalf: { flex: 1 },

  pronounsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pronounPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.3)",
    backgroundColor: "rgba(240,228,193,0.05)",
  },
  pronounPillActive: { backgroundColor: "#511619", borderColor: "#511619" },
  pronounText: {
    color: "rgba(240,228,193,0.8)",
    textTransform: "lowercase",
    fontWeight: "700",
  },
  pronounTextActive: { color: "#F0E4C1" },

  photoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  photoInput: { flex: 1 },
  smallBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(240,228,193,0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallBtnText: { color: "#F0E4C1", fontWeight: "700", textTransform: "lowercase" },

  saveBtn: {
    backgroundColor: "#511619",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 18,
  },
  saveText: { color: "#F0E4C1", fontWeight: "800", fontSize: 16, textTransform: "lowercase" },
});
