import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';

// Navigation
import AuthNavigator from './src/navigation/AuthNavigator';
import MainApp from './src/navigation/MainApp'; 
import { navigationRef } from './src/navigation/RootNavigation';

// Config
import { auth } from './config/firebase'; 

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error?: Error }> {
  constructor(p: any) { super(p); this.state = {}; }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#111C2A', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: '#F0E4C1', fontSize: 16, marginBottom: 8, textAlign: 'center' }}>
            Something crashed while rendering.
          </Text>
          <Text style={{ color: '#F0E4C1', opacity: 0.75, textAlign: 'center' }}>
            {String(this.state.error?.message || 'Unknown error')}
          </Text>
        </View>
      );
    }
    return this.props.children as any;
  }
}

export default function App() {
  // initializing: Are we still checking if the user is logged in?
  const [initializing, setInitializing] = useState(true);
  // user: The currently logged in user (or null)
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // This listener fires automatically when the app opens 
    // OR when you sign in/sign out.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (initializing) setInitializing(false);
    });

    return unsubscribe; // Cleanup when app closes
  }, []);

  if (initializing) {
    // Show a loading spinner while checking local storage for a user
    return (
      <View style={{ flex: 1, backgroundColor: '#111C2A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F0E4C1" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <AppErrorBoundary>
        <NavigationContainer ref={navigationRef}>
          {/* If user is logged in, show MainApp. Otherwise, show Auth (Login/Welcome) */}
          {user ? <MainApp /> : <AuthNavigator />}
        </NavigationContainer>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}