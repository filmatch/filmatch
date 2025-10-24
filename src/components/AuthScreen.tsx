// src/components/AuthScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
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

type Props = { onAuthComplete: () => void; onBack: () => void };

export default function AuthScreen({ onAuthComplete, onBack }: Props) {
  const [tab, setTab] = useState<'signup' | 'signin'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    try {
      setErr(null);
      setBusy(true);

      if (!email.trim() || !password) { setErr('enter email and password'); return; }

      if (tab === 'signup') {
        if (password !== confirm) { setErr('passwords do not match'); return; }
        await FirebaseAuthService.signUp(email.trim(), password, displayName.trim() || undefined);
        Alert.alert('account created', 'check your email for a verification link, then sign in.');
        setTab('signin'); setPassword(''); setConfirm('');
        return;
      }

      await FirebaseAuthService.signIn(email.trim(), password);
      onAuthComplete();
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
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.backBtn}>
          <Text style={s.back}>← back</Text>
        </TouchableOpacity>

        <Text style={s.brand}>filmatch</Text>
        <Text style={s.heading}>{tab === 'signup' ? 'create your account' : 'welcome back'}</Text>

        <View style={s.card}>
          {/* segmented control */}
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
                returnKeyType="go"
              />
            </View>
          )}

          {err ? <Text style={s.err}>{err}</Text> : null}

          <TouchableOpacity style={s.cta} onPress={submit} disabled={busy} activeOpacity={0.9}>
            {busy ? <ActivityIndicator color={C.text} /> : (
              <Text style={s.ctaText}>{tab === 'signup' ? 'create account' : 'sign in'}</Text>
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
  back: { 
    color: C.faint, 
    textTransform: 'lowercase', 
    fontSize: 16,
  },
  brand: { 
    color: C.text, 
    fontSize: 56, 
    fontWeight: '800', 
    textTransform: 'lowercase',
    textAlign: 'center',
    marginBottom: 8,
  },
  heading: { 
    color: C.sub, 
    fontSize: 18, 
    marginBottom: 32, 
    textTransform: 'lowercase',
    textAlign: 'center',
  },

  card: {
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.stroke,
    backgroundColor: C.panel,
    padding: 24,
  },

  segment: {
    flexDirection: 'row',
    backgroundColor: C.pillBg,
    borderRadius: 24,
    padding: 4,
    borderWidth: 1,
    borderColor: C.stroke,
    marginBottom: 24,
  },
  segBtn: { 
    flex: 1, 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderRadius: 20,
  },
  segActive: { backgroundColor: C.pillActive },
  segText: { 
    color: C.sub, 
    fontWeight: '700', 
    textTransform: 'lowercase',
    fontSize: 16,
  },
  segTextActive: { color: C.text },

  fieldWrap: {
    marginBottom: 20,
  },
  label: {
    color: C.sub,
    fontSize: 14,
    textTransform: 'lowercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 56,
    borderRadius: 18,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.strokeSoft,
    color: C.text,
    paddingHorizontal: 16,
    fontSize: 16,
  },

  err: { 
    color: C.text, 
    marginTop: -8,
    marginBottom: 16, 
    textTransform: 'lowercase',
    fontSize: 14,
  },

  cta: {
    height: 64,
    backgroundColor: C.cta,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { 
    color: C.text, 
    fontSize: 20, 
    fontWeight: '800', 
    textTransform: 'lowercase',
  },
});