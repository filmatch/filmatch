// src/navigation/AuthNavigator.tsx
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { getAuth, reload, type User } from 'firebase/auth';

import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { FirestoreService } from '../services/FirestoreService';

import WelcomeScreen from '../components/WelcomeScreen';
import AuthScreen from '../components/AuthScreen';
import SetUpProfileScreen from '../screens/SetUpProfileScreen';
import EditPreferencesScreen from '../screens/EditPreferencesScreen';
import MainApp from './MainApp';
import KVKKScreen from '../screens/KVKKScreen'; // <--- Imported correctly

const Stack = createStackNavigator();

const LoadingScreen = () => (
  <View style={styles.center}>
    <ActivityIndicator size="large" color="#F0E4C1" />
  </View>
);

export default function AuthNavigator() {
  const [state, setState] = useState<'loading' | 'unauth' | 'setupProfile' | 'setupPrefs' | 'auth'>('loading');
  const auth = getAuth();

  const checkUserStatus = async (user: User) => {
    try {
      // Reload user to get fresh token/status
      await reload(user);
      
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
      console.error(e);
      // If error, default to profile setup to allow recovery
      setState('setupProfile');
    }
  };

  useEffect(() => {
    const unsub = FirebaseAuthService.onAuthStateChanged(async (user) => {
      if (user) {
        await checkUserStatus(user);
      } else {
        setState('unauth');
      }
    });
    return unsub;
  }, []);

  if (state === 'loading') return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {state === 'unauth' ? (
        // --- UNAUTHENTICATED STATE (Welcome, Login, Sign Up, KVKK) ---
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
          {/* KVKK MUST BE HERE because AuthScreen links to it */}
          <Stack.Screen 
            name="KVKK" 
            component={KVKKScreen} 
            options={{ presentation: 'modal' }} 
          />
        </>
      ) : state === 'setupProfile' ? (
        // --- PROFILE SETUP STATE ---
        <Stack.Screen name="SetUpProfile">
          {() => <SetUpProfileScreen onComplete={() => checkUserStatus(auth.currentUser!)} />}
        </Stack.Screen>
      ) : state === 'setupPrefs' ? (
        // --- PREFERENCES SETUP STATE ---
        <Stack.Screen name="EditPreferences">
          {() => (
            <EditPreferencesScreen 
              onComplete={() => checkUserStatus(auth.currentUser!)} 
              onBack={() => setState('setupProfile')}
            />
          )}
        </Stack.Screen>
      ) : (
        // --- LOGGED IN STATE ---
        <Stack.Screen name="MainApp" component={MainApp} />
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#111C2A', alignItems: 'center', justifyContent: 'center' }
});