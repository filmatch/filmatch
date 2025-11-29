// src/components/WelcomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
// 1. Add this import
import { useNavigation } from '@react-navigation/native';

const C = {
  bg: '#111C2A',
  text: '#F0E4C1',
  sub: 'rgba(240,228,193,0.86)',
  faint: 'rgba(240,228,193,0.70)',
  panel: '#0F1926',
  stroke: 'rgba(240,228,193,0.20)',
  cta: '#511619',
};

// 2. We don't strictly need Props anymore, but we can keep it optional
type Props = { onGetStarted?: () => void };

export default function WelcomeScreen({ onGetStarted }: Props) {
  // 3. Initialize the navigation hook
  const navigation = useNavigation<any>();

  const handlePress = () => {
    // If a prop was passed, use it (backward compatibility)
    if (onGetStarted) {
      onGetStarted();
    } else {
      // 4. OTHERWISE, NAVIGATE MANUALLY
      // MAKE SURE 'Auth' MATCHES THE NAME IN YOUR AuthNavigator.tsx FILE
      navigation.navigate('Auth'); 
    }
  };

  return (
    <View style={s.root}>
      <Text style={s.brand}>filmatch</Text>
      <Text style={s.tag}>an app for people who talk through the credits.</Text>

      <View style={s.card}>
        <Text style={s.h1}>welcome to filmatch</Text>
        <Text style={s.h2}>
          connect through your taste in films.
        </Text>

        {/* 5. Update onPress to use our new handler */}
        <TouchableOpacity style={s.cta} onPress={handlePress} activeOpacity={0.9}>
          <Text style={s.ctaText}>get started</Text>
        </TouchableOpacity>

        <Text style={s.foot}>rate movies · find matches · start conversations</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: C.bg, 
    paddingTop: 80, 
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  brand: {
    color: C.text,
    fontSize: 56,
    fontWeight: '800',
    textTransform: 'lowercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  tag: { 
    color: C.sub, 
    fontSize: 16,
    textAlign: 'center',
    textTransform: 'lowercase',
    marginBottom: 80,
  },
  card: {
    flex: 1,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.stroke,
    backgroundColor: C.panel,
    paddingVertical: 48,
    paddingHorizontal: 32,
    justifyContent: 'center',
    marginBottom: 40,
  },
  h1: {
    color: C.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'lowercase',
  },
  h2: {
    color: C.sub,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    textTransform: 'lowercase',
  },
  cta: {
    alignSelf: 'stretch',
    backgroundColor: C.cta,
    borderRadius: 28,
    paddingVertical: 20,
    marginBottom: 32,
  },
  ctaText: {
    color: C.text,
    fontWeight: '800',
    fontSize: 20,
    textTransform: 'lowercase',
    textAlign: 'center',
  },
  foot: { 
    color: C.faint, 
    textAlign: 'center',
    fontSize: 14,
    textTransform: 'lowercase',
  },
});