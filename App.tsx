// App.tsx
import 'react-native-gesture-handler';
import React, { useEffect, useState, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text, ActivityIndicator } from 'react-native';
import { onAuthStateChanged, User } from 'firebase/auth';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications'; 

// Navigation
import AuthNavigator from './src/navigation/AuthNavigator';
import { navigationRef } from './src/navigation/RootNavigation';

// Config
import { auth } from './config/firebase'; 

// --- NOTIFICATION HANDLER CONFIG ---
// Fixed: Added shouldShowBanner and shouldShowList to satisfy newer expo-notifications types
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
  
  // Fixed: Initialized with null to satisfy TypeScript
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    // 1. Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); 
      if (initializing) setInitializing(false);
    });

    // 2. Notification Click Listener
responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log("🔔 NOTIFICATION CLICKED:", JSON.stringify(data));

      if (!navigationRef.isReady()) {
        console.log("❌ Navigation not ready yet");
        return;
      }
      if (data?.chatId) {
         console.log("➡️ Attempting to navigate to Chat:", data.chatId);
         // @ts-ignore
         navigationRef.navigate('Chat', { chatId: data.chatId });
      } 
      else if (data?.type === 'match') {
         console.log("➡️ Attempting to navigate to Matches");
         
         // TRY THIS: If 'Matches' is inside a Tab Navigator, you might need to navigate to the Tab first.
         // Example: navigationRef.navigate('MainTabs', { screen: 'Matches' });
         
         // @ts-ignore
         navigationRef.navigate('Matches'); 
      }
    });

    return () => {
      unsubscribeAuth();
      // Fixed: Used .remove() instead of removeNotificationSubscription
      if (responseListener.current) {
        responseListener.current.remove();
      }
    }; 
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