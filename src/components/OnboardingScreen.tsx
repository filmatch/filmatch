// src/components/OnboardingScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';
import { navigateNested } from '../navigation/RootNavigation';

const C = { bg: '#111C2A', text: '#F0E4C1', dim: 'rgba(240,228,193,0.75)' };

type Props = { onComplete: () => void };

export default function OnboardingScreen({ onComplete }: Props) {
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const u = FirebaseAuthService.getCurrentUser();
      if (!u) { if (!cancelled) setNote('no user – please sign in'); return; }

      try {
        const profile: any = await FirestoreService.getUserProfile(u.uid);

        const hasProfile =
          !!profile?.hasProfile ||
          !!profile?.city ||
          !!profile?.gender ||
          typeof profile?.age === 'number' ||
          !!profile?.birthYear ||
          !!profile?.dateOfBirth;

        const hasPreferences =
          !!profile?.hasPreferences ||
          (Array.isArray(profile?.genreRatings) && profile.genreRatings.length > 0) ||
          (Array.isArray(profile?.favorites) && profile.favorites.length >= 1);

        if (hasProfile && hasPreferences) {
          onComplete();
          return;
        }
  onComplete();
        setTimeout(() => {
          if (cancelled) return;
          if (!hasProfile) {
            navigateNested('MainApp', 'SetUpProfile');
          } else if (!hasPreferences) {
            navigateNested('MainApp', 'EditPreferences');
          }
        }, 300);
      } catch (err) {
        console.error('Onboarding error:', err);
        onComplete();
      }
    })();

    return () => { cancelled = true; };
  }, [onComplete]);

  return (
    <View style={s.container}>
      <ActivityIndicator size="large" color={C.text} />
      <Text style={s.text}>checking your account…</Text>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  text: { color: C.text, opacity: 0.85, textTransform: 'lowercase', marginTop: 10 },
  note: { color: C.dim, textTransform: 'lowercase', marginTop: 6, textAlign: 'center' },
});