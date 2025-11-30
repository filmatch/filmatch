// src/navigation/AuthNavigator.tsx
import React, { useEffect, useState, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Alert } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, reload, sendEmailVerification, signOut, onAuthStateChanged, type User } from 'firebase/auth';

import { FirestoreService } from '../services/FirestoreService';

import WelcomeScreen from '../components/WelcomeScreen';
import AuthScreen from '../components/AuthScreen';
import SetUpProfileScreen from '../screens/SetUpProfileScreen';
import EditPreferencesScreen from '../screens/EditPreferencesScreen';
// ✅ Correct Import
import MainApp from './MainApp'; 
import KVKKScreen from '../screens/KVKKScreen'; 
import SettingsScreen from '../screens/SettingsScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';

const Stack = createStackNavigator();
const C = { bg: '#111C2A', text: '#F0E4C1', accent: '#511619' };

// --- 1. LOADING SCREEN ---
const LoadingScreen = () => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color={C.text} />
  </View>
);

// --- 2. VERIFICATION SCREEN (Waiting Room) ---
const VerificationScreen = ({ onRefresh, onLogout }: { onRefresh: () => void, onLogout: () => void }) => {
  const [sending, setSending] = useState(false);
  const auth = getAuth();

  const handleResend = async () => {
    if (auth.currentUser) {
      setSending(true);
      try {
        await sendEmailVerification(auth.currentUser);
        Alert.alert('Sent', 'Check your email (and spam folder)!');
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setSending(false);
      }
    }
  };

  return (
    <View style={styles.verifyContainer}>
      <Text style={styles.verifyTitle}>verify your email</Text>
      <Text style={styles.verifySub}>
        we sent a link to {auth.currentUser?.email || 'your email'}.{'\n'}please click it to continue.
      </Text>

      <TouchableOpacity onPress={onRefresh} style={styles.primaryBtn}>
        <Text style={styles.btnText}>i've verified (refresh)</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResend} disabled={sending} style={styles.secondaryBtn}>
        <Text style={styles.secondaryText}>{sending ? 'sending...' : 'resend email'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onLogout} style={styles.textBtn}>
        <Text style={styles.textBtnText}>sign out</Text>
      </TouchableOpacity>
    </View>
  );
};

// --- 3. MAIN NAVIGATOR LOGIC ---
export default function AuthNavigator() {
  const [state, setState] = useState<'loading' | 'unauth' | 'login' | 'verification' | 'setupProfile' | 'setupPrefs' | 'auth'>('loading');
  const auth = getAuth();
  
  const isExplicitLogout = useRef(false);

  // Use a ref to track state inside the listener without adding dependencies
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleUserLogout = async () => {
    isExplicitLogout.current = true;
    await signOut(auth);
    setState('unauth'); 
    setTimeout(() => { isExplicitLogout.current = false; }, 1000);
  };

  const checkUserStatus = async (user: User | null, shouldReload = false) => {
    // 1. SAFETY: If session dropped, go directly to LOGIN screen (skip welcome)
    if (!user) {
      setState('login');
      return;
    }

    try {
      if (shouldReload) {
        await reload(user);
      }
      
      // 2. Check Verification
      if (!user.emailVerified) {
        setState('verification');
        return;
      }

      // 3. Fetch Profile
      const profile = await FirestoreService.getUserProfile(user.uid);
      
      if (!profile || !profile.hasProfile) {
        setState('setupProfile');
        return;
      }
      
      if (!profile.hasPreferences) {
        setState('setupPrefs');
        return;
      }
      
      setState('auth');
    } catch (e) {
      console.error("Auth Check Error:", e);
      if (!user.emailVerified) {
        setState('verification');
      } else {
        setState('setupProfile');
      }
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // FIXED: Removed the 'if state !== auth' check. 
        // We now ALWAYS verify the user status when Firebase reports a user.
        // This ensures you land on the correct screen even if the state Ref is stale.
        await checkUserStatus(user, false);
      } else {
        // Use stateRef to avoid redirecting if we are intentionally on Login/Verification
        if (stateRef.current !== 'verification' && stateRef.current !== 'login' && !isExplicitLogout.current) {
           setState('unauth');
        }
      }
    });
    return unsub;
  }, []); // Empty dependency array prevents the infinite loop

  if (state === 'loading') return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      
      {/* CASE 1: Standard Unauth OR Direct Login */}
      {(state === 'unauth' || state === 'login') ? (
        <Stack.Screen 
          name="AuthStack" 
        >
          {() => (
            <Stack.Navigator 
              // Key forces re-render when switching between unauth/login states
              key={state}
              screenOptions={{ headerShown: false }} 
              initialRouteName={state === 'login' ? 'Auth' : 'Welcome'}
            >
              <Stack.Screen name="Welcome" component={WelcomeScreen} />
              <Stack.Screen name="Auth" component={AuthScreen} />
              <Stack.Screen name="KVKK" component={KVKKScreen} options={{ presentation: 'modal' }} />
            </Stack.Navigator>
          )}
        </Stack.Screen>
      ) : state === 'verification' ? (
        <Stack.Screen name="Verification">
          {() => (
            <VerificationScreen 
              onRefresh={() => {
                if (auth.currentUser) {
                  checkUserStatus(auth.currentUser, true);
                } else {
                  setState('login');
                }
              }} 
              onLogout={handleUserLogout} 
            />
          )}
        </Stack.Screen>
      ) : state === 'setupProfile' ? (
        <Stack.Screen name="SetUpProfile">
          {() => <SetUpProfileScreen onComplete={() => checkUserStatus(auth.currentUser!, true)} />}
        </Stack.Screen>
      ) : state === 'setupPrefs' ? (
        <Stack.Screen name="EditPreferences">
          {() => (
            <EditPreferencesScreen 
              onComplete={() => checkUserStatus(auth.currentUser!, true)} 
              onBack={() => setState('setupProfile')}
            />
          )}
        </Stack.Screen>
      ) : (
        <>
          <Stack.Screen name="MainApp" component={MainApp} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  verifyContainer: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  verifyTitle: { color: C.text, fontSize: 24, fontWeight: 'bold', marginBottom: 12, textTransform: 'lowercase' },
  verifySub: { color: 'rgba(240, 228, 193, 0.6)', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  primaryBtn: { backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 12 },
  btnText: { color: C.text, fontWeight: 'bold', fontSize: 16, textTransform: 'lowercase' },
  secondaryBtn: { borderColor: 'rgba(240, 228, 193, 0.2)', borderWidth: 1, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', marginBottom: 24 },
  secondaryText: { color: C.text, fontWeight: '600', fontSize: 16, textTransform: 'lowercase' },
  textBtn: { padding: 12 },
  textBtnText: { color: 'rgba(240, 228, 193, 0.5)', fontSize: 14, textTransform: 'lowercase' },
});