// src/components/CustomAlert.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../theme';

const DESTRUCTIVE_RED = '#511619';

type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type CustomAlertProps = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  onRequestClose?: () => void;
};

export default function CustomAlert({
  visible,
  title,
  message,
  buttons,
  onRequestClose,
}: CustomAlertProps) {
  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) button.onPress();
    if (onRequestClose) onRequestClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onRequestClose}
      >
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          <View style={styles.content}>
            <Text style={styles.title}>{title}</Text>
            {message && <Text style={styles.message}>{message}</Text>}
          </View>
          
          <View style={styles.actions}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'cancel' && styles.cancelBtn,
                  button.style === 'destructive' && styles.destructiveBtn,
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.9}
              >
                <Text style={[
                  styles.buttonText,
                  button.style === 'cancel' && styles.cancelButtonText,
                  button.style === 'destructive' && styles.destructiveButtonText
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17,28,42,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.20)',
    backgroundColor: '#0F1926',
    overflow: 'hidden',
  },
  content: {
    paddingVertical: 32,
    paddingHorizontal: 28,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
    textTransform: 'lowercase',
  },
  message: {
    color: 'rgba(240,228,193,0.86)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    textTransform: 'lowercase',
  },
  actions: {
    gap: 12,
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  button: {
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.15)',
  },
  cancelBtn: {
    backgroundColor: DESTRUCTIVE_RED,
    borderColor: DESTRUCTIVE_RED,
  },
  destructiveBtn: {
    backgroundColor: 'rgba(240,228,193,0.08)',
    borderColor: 'rgba(240,228,193,0.15)',
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  cancelButtonText: {
    color: '#F0E4C1',
  },
  destructiveButtonText: {
    color: COLORS.text,
  },
});