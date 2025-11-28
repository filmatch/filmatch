import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
// 1. ADD THIS IMPORT
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); 
      if (initializing) setInitializing(false);
    });

    return unsubscribe; 
  }, []);

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111C2A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#F0E4C1" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 2. WRAP YOUR CONTENT IN SAFE AREA PROVIDER */}
      <SafeAreaProvider>
        <StatusBar style="light" />
        <AppErrorBoundary>
          <NavigationContainer ref={navigationRef}>
            <AuthNavigator />
          </NavigationContainer>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}