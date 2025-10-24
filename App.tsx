// App.tsx
import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { View, Text } from 'react-native';
import AuthNavigator from './src/navigation/AuthNavigator';
import { navigationRef } from './src/navigation/RootNavigation';



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
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef}> 
        <AuthNavigator />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}