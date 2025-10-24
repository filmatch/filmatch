// src/navigation/MainApp.tsx
import React from 'react';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SearchScreen from '../screens/SearchScreen';
import MovieDetailScreen from '../screens/MovieDetailScreen';
import SwipeScreen from '../screens/SwipeScreen';
import MatchesScreen from '../screens/MatchesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import EditPreferencesScreen from '../screens/EditPreferencesScreen';
import ChatScreen from '../screens/ChatScreen';
import SetUpProfileScreen from '../screens/SetUpProfileScreen';

import { Movie } from '../types';
import { SearchIcon, HeartIcon, ChatIcon, ProfileIcon } from '../components/icons/MinimalIcons';

export type RootStackParamList = {
  MainTabs: undefined;
  MovieDetail: { movie: Movie };
  Chat: { chatId?: string } | undefined;
  EditPreferences: undefined;
  EditProfile: undefined;
  SetUpProfile: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<RootStackParamList>();

const BG = '#111C2A';
const ACTIVE = '#511619';
const INACTIVE = 'rgba(240, 228, 193, 0.7)';

function IconFor(routeName: string, active: boolean) {
  const props = { active, color: active ? ACTIVE : INACTIVE };
  switch (routeName.toLowerCase()) {
    case 'search':
      return <SearchIcon {...props} />;
    case 'match':
      return <HeartIcon {...props} />;
    case 'matches':
      return <ChatIcon {...props} />;
    default:
      return <ProfileIcon {...props} />;
  }
}

function MyTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  return (
    <SafeAreaView edges={['bottom']} style={{ backgroundColor: BG }}>
      <View
        style={{
          flexDirection: 'row',
          height: 64,
          backgroundColor: BG,
          borderTopWidth: 1,
          borderTopColor: 'rgba(240, 228, 193, 0.12)',
        }}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const label =
            (descriptors[route.key]?.options.tabBarLabel as string) ??
            (descriptors[route.key]?.options.title as string) ??
            route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              {IconFor(route.name, isFocused)}
              <Text
                style={{
                  marginTop: 6,
                  color: isFocused ? ACTIVE : INACTIVE,
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'lowercase',
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <MyTabBar {...props} />}>
      <Tab.Screen name="Search" component={SearchScreen} options={{ tabBarLabel: 'search' }} />
      <Tab.Screen name="Match" component={SwipeScreen} options={{ tabBarLabel: 'match' }} />
      <Tab.Screen name="Matches" component={MatchesScreen} options={{ tabBarLabel: 'matches' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'profile' }} />
    </Tab.Navigator>
  );
}

export default function MainApp() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: BG } }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="MovieDetail" component={MovieDetailScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SetUpProfile" component={SetUpProfileScreen} />
      <Stack.Screen name="EditPreferences" component={EditPreferencesScreen} />
    </Stack.Navigator>
  );
}
