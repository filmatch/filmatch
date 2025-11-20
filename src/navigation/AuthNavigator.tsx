// src/navigation/AuthNavigator.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, reload, sendEmailVerification, type User } from 'firebase/auth';

import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';

import WelcomeScreen from '../components/WelcomeScreen';
import AuthScreen from '../components/AuthScreen';
import SetUpProfileScreen from '../screens/SetUpProfileScreen';
import EditPreferencesScreen from '../screens/EditPreferencesScreen';
import MainApp from './MainApp';

const AUTH_DOMAIN = (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');
const REQUIRE_VERIFIED = (process.env.EXPO_PUBLIC_REQUIRE_VERIFIED || 'true') === 'true';
const actionCodeSettings = { url: `https://${AUTH_DOMAIN}/verify-complete`, handleCodeInApp: false };

type AuthState = 'loading' | 'unauthenticated' | 'verify' | 'setupProfile' | 'setupPreferences' | 'authenticated';
const Stack = createStackNavigator();

const DefaultFallbackScreen = () => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color="#F0E4C1" />
    <Text style={styles.dim}>checking app state...</Text>
  </View>
);

export default function AuthNavigator() {
  const [state, setState] = useState<AuthState>('loading');
  const [subStep, setSubStep] = useState<'welcome' | 'auth'>('welcome');
  const [note, setNote] = useState('');
  const auth = getAuth();

  const needsVerification = (u: User) =>
    u.providerData?.some((p) => p?.providerId === 'password') && !u.emailVerified;

  const routeAfterAuth = async (u: User) => {
    // ⚠️ Optimization: Prevent re-running heavy checks if we're already on a setup/verify screen.
    if (state === 'setupProfile' || state === 'setupPreferences' || state === 'verify') {
        console.log(`⏭️ Already on a setup/verify screen: ${state}, skipping routing...`);
        return;
    }
    
    // CRITICAL: Set to loading first to clear the screen during checks
    setState('loading');
    
    // 1. Check for Email Verification
    if (REQUIRE_VERIFIED && needsVerification(u)) {
      setState('verify');
      return;
    }
    
    try {
      await FirestoreService.createUserProfileIfMissing(u.uid);
      const profile = await FirestoreService.getUserProfile(u.uid);
      
      if (!profile) {
        console.log('❌ No profile found, routing to setup');
        setState('setupProfile');
        return;
      }

      console.log('📋 Profile data:', {
        hasProfile: profile.hasProfile,
        hasPreferences: profile.hasPreferences,
        age: profile.age,
        city: profile.city,
        gender: profile.gender,
        photos: profile.photos?.length || 0,
        genreRatings: profile.genreRatings?.length || 0,
        favorites: profile.favorites?.length || 0,
      });

      // 2. STRICT profile check - must have explicit hasProfile flag OR all required fields
      const hasProfile = profile.hasProfile === true || 
        (
          typeof profile.age === 'number' && 
          profile.age > 0 &&
          typeof profile.city === 'string' && 
          profile.city.length > 0 &&
          Array.isArray(profile.gender) && 
          profile.gender.length > 0 &&
          Array.isArray(profile.photos) && 
          profile.photos.length > 0
        );

      if (!hasProfile) {
        console.log('❌ Profile incomplete, routing to setup');
        setState('setupProfile');
        return;
      }

      // 3. STRICT preferences check - must have explicit hasPreferences flag OR preference data
      const hasPreferences = profile.hasPreferences === true ||
        (
          (Array.isArray(profile.genreRatings) && profile.genreRatings.length > 0) ||
          (Array.isArray(profile.favorites) && profile.favorites.length > 0)
        );

      if (!hasPreferences) {
        console.log('❌ Preferences incomplete, routing to preferences');
        setState('setupPreferences');
        return;
      }

      // 4. Both profile and preferences are complete
      console.log('✅ Setup complete, routing to main app');
      setState('authenticated');
    } catch (error) {
      console.error('❌ Error in routeAfterAuth:', error);
      // Default to profile setup on error to be safe
      setState('setupProfile');
    }
  };

  useEffect(() => {
    let isInitialRoutingComplete = false;
    
    const unsub = FirebaseAuthService.onAuthStateChanged(async (u) => {
      // 💡 Skip if already authenticated and this is not the first run
      if (u && isInitialRoutingComplete && state === 'authenticated') {
         console.log('⏭️ Auth change detected on authenticated user, ignoring re-route.');
         return;
      }

      if (!u) {
        setState('unauthenticated');
        isInitialRoutingComplete = true;
        return;
      }
      
      // Before routing, ensure user data is fresh
      try {
        await reload(u);
      } catch {}
      const cur = auth.currentUser;
      
      if (!cur) {
        setState('unauthenticated');
        isInitialRoutingComplete = true;
        return;
      }
      
      await routeAfterAuth(cur);
      isInitialRoutingComplete = true;
    });
    return unsub;
  }, []); // <--- FIX: Dependency array is now EMPTY: []

  // Render navigator for all states - loading will show Fallback screen
  return (
    <Stack.Navigator 
      key={state}
      screenOptions={{ headerShown: false }}
    >
      {state === 'unauthenticated' ? (
        <>
          {subStep === 'welcome' ? (
            <Stack.Screen name="Welcome">
              {() => <WelcomeScreen onGetStarted={() => setSubStep('auth')} />}
            </Stack.Screen>
          ) : (
            <Stack.Screen name="Auth">
              {() => (
                <AuthScreen
                  onAuthComplete={async () => {
                    const u = auth.currentUser;
                    if (!u) {
                      setState('unauthenticated');
                      setSubStep('auth');
                      return;
                    }
                    await routeAfterAuth(u);
                  }}
                  onBack={() => setSubStep('welcome')}
                />
              )}
            </Stack.Screen>
          )}
        </>
      ) : state === 'verify' ? (
        <Stack.Screen name="Verify">
          {() => (
            <View style={styles.center}>
              <Text style={styles.title}>check your inbox</Text>
              <Text style={styles.sub}>open the verification link, then tap refresh.</Text>
              {!!note && <Text style={styles.note}>{note}</Text>}

              <TouchableOpacity
                style={styles.primary}
                onPress={async () => {
                  try {
                    const u = auth.currentUser;
                    if (!u) {
                      setState('unauthenticated');
                      setSubStep('auth');
                      return;
                    }
                    setNote('');
                    await reload(u);
                    const done = async () => {
                      const uu = auth.currentUser;
                      if (!uu) {
                        setState('unauthenticated');
                        setSubStep('auth');
                        return;
                      }
                      if (!REQUIRE_VERIFIED || !needsVerification(uu)) await routeAfterAuth(uu);
                      else {
                        setNote('still not verified – open the email link, then tap refresh');
                        setTimeout(() => setNote(''), 3000);
                      }
                    };
                    if (Platform.OS === 'android') setTimeout(done, 400);
                    else await done();
                  } catch (e: any) {
                    setNote(e?.message || 'could not refresh – try again');
                    setTimeout(() => setNote(''), 3000);
                  }
                }}
              >
                <Text style={styles.primaryText}>i verified – refresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondary}
                onPress={async () => {
                  try {
                    const u = auth.currentUser;
                    if (!u) {
                      setState('unauthenticated');
                      setSubStep('auth');
                      return;
                    }
                    setNote('');
                    await reload(u);
                    if (!REQUIRE_VERIFIED || !needsVerification(u)) {
                      setNote('already verified – press refresh');
                      setTimeout(() => setNote(''), 2500);
                      return;
                    }
                    await sendEmailVerification(u, actionCodeSettings as any);
                    setNote('verification email resent');
                    setTimeout(() => setNote(''), 2500);
                  } catch (e: any) {
                    setNote(e?.code || e?.message || 'could not resend – try again later');
                    setTimeout(() => setNote(''), 3500);
                  }
                }}
              >
                <Text style={styles.secondaryText}>resend email</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  try {
                    await FirebaseAuthService.signOut();
                  } catch {}
                  setState('unauthenticated');
                  setSubStep('auth');
                }}
              >
                <Text style={styles.link}>sign out</Text>
              </TouchableOpacity>
            </View>
          )}
        </Stack.Screen>
      ) : state === 'setupProfile' ? (
        <Stack.Screen 
          name="SetUpProfile" 
          options={{
            gestureEnabled: false,
            headerShown: false, 
          }}
        >
          {() => (
            <SetUpProfileScreen 
              onComplete={() => {
                console.log('✅ Profile setup complete, triggering re-route check...');
                setState('loading'); // Trigger re-route logic
              }}
            />
          )}
        </Stack.Screen>
      ) : state === 'setupPreferences' ? (
        <Stack.Screen 
          name="EditPreferences"
          options={{
            gestureEnabled: false,
            headerShown: false,
          }}
        >
          {() => (
            <EditPreferencesScreen
              onComplete={() => {
                console.log('✅ Preferences complete, triggering re-route check...');
                setState('loading'); // Trigger re-route logic
              }}
              onBack={() => {
                console.log('⬅️ Going back to profile setup');
                setState('setupProfile');
              }}
            />
          )}
        </Stack.Screen>
      ) : state === 'authenticated' ? (
        <Stack.Screen name="MainApp" component={MainApp} />
      ) : (
        // Any other state (including 'loading') shows fallback
        <Stack.Screen name="Fallback" component={DefaultFallbackScreen} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#111C2A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  dim: { color: '#F0E4C1', opacity: 0.8, textTransform: 'lowercase' },
  title: { color: '#F0E4C1', fontSize: 22, fontWeight: '700', textAlign: 'center', textTransform: 'lowercase' },
  sub: { color: '#F0E4C1', opacity: 0.7, textAlign: 'center', textTransform: 'lowercase' },
  note: { color: '#F0E4C1', opacity: 0.75, textAlign: 'center', textTransform: 'lowercase' },
  primary: {
    backgroundColor: '#511619',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryText: { color: '#F0E4C1', fontSize: 16, fontWeight: '700', textTransform: 'lowercase' },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.3)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  secondaryText: { color: '#F0E4C1', fontSize: 15, fontWeight: '600', textTransform: 'lowercase' },
  link: { color: '#F0E4C1', opacity: 0.7, textTransform: 'lowercase', marginTop: 12 },
});