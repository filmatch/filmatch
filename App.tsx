import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';

// Navigation
import AuthNavigator from './src/navigation/AuthNavigator';
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
  // We keep the state logic, but only to avoid rendering NavigationContainer
  // until Firebase auth state is loaded, not to choose the navigator.
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // We only need to know if the state has been loaded.
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // This still runs in the background
      if (initializing) setInitializing(false);
    });

    return unsubscribe; 
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
          {/* 💡 FIX: The AuthNavigator is now the single root component. 
          It contains all logic for checking profile and rendering MainApp internally. */}
          <AuthNavigator />
        </NavigationContainer>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}