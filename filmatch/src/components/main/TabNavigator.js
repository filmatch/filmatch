import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';

function DummyHome() {
  return (
    <View>
      <Text>Home</Text>
    </View>
  );
}

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={DummyHome} />
    </Tab.Navigator>
  );
}
