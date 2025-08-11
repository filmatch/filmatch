import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/colors';

const Input = ({ 
  label, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  style,
  ...props 
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(232, 226, 210, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 226, 210, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: COLORS.text,
  },
});

export default Input;
