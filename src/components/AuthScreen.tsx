// src/components/AuthScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons'; // Import Icon
import { FirebaseAuthService } from '../services/FirebaseAuthService';

const C = {
  bg: '#111C2A',
  text: '#F0E4C1',
  sub: 'rgba(240,228,193,0.88)',
  faint: 'rgba(240,228,193,0.70)',
  panel: '#0F1926',
  stroke: 'rgba(240,228,193,0.20)',
  strokeSoft: 'rgba(240,228,193,0.16)',
  pillBg: '#0B1623',
  pillActive: '#511619',
  inputBg: '#0E1724',
  cta: '#511619',
};

type Props = { onAuthComplete?: () => void; onBack?: () => void };

export default function AuthScreen({ onAuthComplete, onBack }: Props) {
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<'signup' | 'signin'>('signup');
  
  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  
  // KVKK State
  const [isAgreed, setIsAgreed] = useState(false);
  
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleBack = () => {
    if (onBack) onBack();
    else navigation.goBack();
  };

  const openKVKK = () => {
    // Navigate to the preview screen
    navigation.navigate('KVKK'); 
  };

  const submit = async () => {
    try {
      setErr(null);

      if (!email.trim() || !password) { setErr('enter email and password'); return; }

      if (tab === 'signup') {
        // Validation
        if (password !== confirm) { setErr('passwords do not match'); return; }
        if (!isAgreed) { setErr('you must accept the kvkk & privacy policy'); return; }

        setBusy(true);
        // Create Account Immediately
        await FirebaseAuthService.signUp(email.trim(), password, displayName.trim() || undefined);
        
        Alert.alert('account created', 'check your email for a verification link, then sign in.');
        setTab('signin'); 
        setPassword(''); 
        setConfirm('');
        return;
      }

      // Sign In
      setBusy(true);
      await FirebaseAuthService.signIn(email.trim(), password);
      if (onAuthComplete) onAuthComplete();
      
    } catch (e: any) {
      setErr(e?.message || e?.code || 'auth failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={s.root}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.backBtn}>
          <Text style={s.back}>← back</Text>
        </TouchableOpacity>

        <Text style={s.brand}>filmatch</Text>
        <Text style={s.heading}>{tab === 'signup' ? 'create your account' : 'welcome back'}</Text>

        <View style={s.card}>
          <View style={s.segment}>
            <TouchableOpacity
              style={[s.segBtn, tab === 'signup' && s.segActive]}
              onPress={() => setTab('signup')}
            >
              <Text style={[s.segText, tab === 'signup' && s.segTextActive]}>sign up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.segBtn, tab === 'signin' && s.segActive]}
              onPress={() => setTab('signin')}
            >
              <Text style={[s.segText, tab === 'signin' && s.segTextActive]}>sign in</Text>
            </TouchableOpacity>
          </View>

          {tab === 'signup' && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>display name</Text>
              <TextInput
                style={s.input}
                placeholder="what should we call you?"
                placeholderTextColor="#95A2AF"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={s.fieldWrap}>
            <Text style={s.label}>email</Text>
            <TextInput
              style={s.input}
              placeholder="your@email.com"
              placeholderTextColor="#95A2AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={s.fieldWrap}>
            <Text style={s.label}>password</Text>
            <TextInput
              style={s.input}
              placeholder="········"
              placeholderTextColor="#95A2AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType={tab === 'signup' ? 'next' : 'go'}
            />
          </View>

          {tab === 'signup' && (
            <View style={s.fieldWrap}>
              <Text style={s.label}>confirm password</Text>
              <TextInput
                style={s.input}
                placeholder="········"
                placeholderTextColor="#95A2AF"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                returnKeyType="done"
              />
            </View>
          )}

          {/* CHECKBOX ROW (Only for Sign Up) */}
          {tab === 'signup' && (
            <View style={s.checkboxRow}>
              <TouchableOpacity onPress={() => setIsAgreed(!isAgreed)} style={s.checkboxTouch}>
                 <Feather 
                    name={isAgreed ? "check-square" : "square"} 
                    size={20} 
                    color={isAgreed ? C.text : C.faint} 
                 />
              </TouchableOpacity>
              <View style={s.agreementTextContainer}>
                 <Text style={s.agreementText}>
                    i accept the{' '}
                    <Text style={s.linkText} onPress={openKVKK}>
                       kvkk & privacy policy
                    </Text>
                 </Text>
              </View>
            </View>
          )}

          {err ? <Text style={s.err}>{err}</Text> : null}

          <TouchableOpacity 
            style={[s.cta, (tab === 'signup' && !isAgreed) && s.ctaDisabled]} 
            onPress={submit} 
            disabled={busy || (tab === 'signup' && !isAgreed)} 
            activeOpacity={0.9}
          >
            {busy ? <ActivityIndicator color={C.text} /> : (
              <Text style={[s.ctaText, (tab === 'signup' && !isAgreed) && s.ctaTextDisabled]}>
                 {tab === 'signup' ? 'create account' : 'sign in'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { 
    flexGrow: 1,
    paddingHorizontal: 20, 
    paddingTop: 60,
    paddingBottom: 40,
  },
  backBtn: { marginBottom: 24 },
  back: { color: C.faint, textTransform: 'lowercase', fontSize: 16 },
  brand: { 
    color: C.text, fontSize: 56, fontWeight: '800', 
    textTransform: 'lowercase', textAlign: 'center', marginBottom: 8,
  },
  heading: { 
    color: C.sub, fontSize: 18, marginBottom: 32, 
    textTransform: 'lowercase', textAlign: 'center',
  },
  card: {
    borderRadius: 26, borderWidth: 1, borderColor: C.stroke,
    backgroundColor: C.panel, padding: 24,
  },
  segment: {
    flexDirection: 'row', backgroundColor: C.pillBg, borderRadius: 24,
    padding: 4, borderWidth: 1, borderColor: C.stroke, marginBottom: 24,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 20 },
  segActive: { backgroundColor: C.pillActive },
  segText: { color: C.sub, fontWeight: '700', textTransform: 'lowercase', fontSize: 16 },
  segTextActive: { color: C.text },

  fieldWrap: { marginBottom: 20 },
  label: { color: C.sub, fontSize: 14, textTransform: 'lowercase', marginBottom: 8, marginLeft: 4 },
  input: {
    height: 56, borderRadius: 18, backgroundColor: C.inputBg, borderWidth: 1,
    borderColor: C.strokeSoft, color: C.text, paddingHorizontal: 16, fontSize: 16,
  },
  
  // NEW CHECKBOX STYLES
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 },
  checkboxTouch: { padding: 4, marginRight: 8 },
  agreementTextContainer: { flex: 1 },
  agreementText: { color: C.faint, fontSize: 14, textTransform: 'lowercase' },
  linkText: { color: C.text, textDecorationLine: 'underline', fontWeight: 'bold' },

  err: { color: C.text, marginTop: -8, marginBottom: 16, textTransform: 'lowercase', fontSize: 14 },

  cta: {
    height: 64, backgroundColor: C.cta, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  ctaDisabled: { backgroundColor: 'rgba(81, 22, 25, 0.4)' },
  ctaText: { color: C.text, fontSize: 20, fontWeight: '800', textTransform: 'lowercase' },
  ctaTextDisabled: { color: 'rgba(240, 228, 193, 0.3)' },
});