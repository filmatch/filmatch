// src/components/icons/BellIcon.tsx
import React from 'react';
import { View } from 'react-native';

type Props = {
  active?: boolean;
  color?: string;
};

export const BellIcon = ({ active, color = '#F0E4C1' }: Props) => {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      {/* Bell body */}
      <View
        style={{
          position: 'absolute',
          top: 3,
          width: 14,
          height: 14,
          borderRadius: 7,
          borderWidth: active ? 2.5 : 2,
          borderColor: color,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
      />
      {/* Bell bottom */}
      <View
        style={{
          position: 'absolute',
          top: 17,
          width: 18,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
        }}
      />
      {/* Bell clapper */}
      <View
        style={{
          position: 'absolute',
          top: 19,
          width: 3,
          height: 3,
          borderRadius: 1.5,
          backgroundColor: color,
        }}
      />
      {/* Top handle */}
      <View
        style={{
          position: 'absolute',
          top: 1,
          width: 6,
          height: 3,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          borderWidth: active ? 2 : 1.5,
          borderColor: color,
          borderBottomWidth: 0,
        }}
      />
    </View>
  );
};