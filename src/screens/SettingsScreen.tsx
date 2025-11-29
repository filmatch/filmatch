// src/screens/SettingsScreen.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { FirebaseAuthService } from '../services/FirebaseAuthService';
import { navigateNested, logTree } from '../navigation/RootNavigation';
import CustomAlert from '../components/CustomAlert';
import { COLORS } from '../theme';

export default function SettingsScreen() {
  const nav = useNavigation();
  const [alert, setAlert] = useState({ visible: false, title: '', message: '', buttons: [] });

  const handleSignOut = async () => {
    try {
      await FirebaseAuthService.signOut();
    } catch (error) {
      setAlert({
        visible: true,
        title: 'error',
        message: 'failed to sign out',
        buttons: [{ text: 'ok', onPress: () => setAlert({ ...alert, visible: false }) }]
      });
    }
  };

  const confirmSignOut = () => {
    setAlert({
      visible: true,
      title: 'sign out?',
      message: 'are you sure?',
      buttons: [
        { text: 'cancel', style: 'cancel', onPress: () => setAlert({ ...alert, visible: false }) },
        { text: 'sign out', style: 'destructive', onPress: () => { setAlert({ ...alert, visible: false }); handleSignOut(); } }
      ]
    });
  };

  const handleDeleteAccount = () => {
    setAlert({
      visible: true,
      title: 'delete account?',
      message: 'this action cannot be undone. all your data will be permanently removed.',
      buttons: [
        { text: 'cancel', style: 'cancel', onPress: () => setAlert({ ...alert, visible: false }) },
        { 
          text: 'delete', 
          style: 'destructive', 
          onPress: () => { 
            setAlert({ ...alert, visible: false });
            setTimeout(() => {
              setAlert({
                visible: true,
                title: 'notice',
                message: 'please contact support@filmatch.com to complete account deletion.',
                buttons: [{ text: 'ok', onPress: () => setAlert({ ...alert, visible: false }) }]
              });
            }, 300);
          }
        }
      ]
    });
  };

  const menuItems = [
    {
      label: 'edit profile',
      onPress: () => {
        logTree?.();
        navigateNested('MainApp', 'EditProfile');
      },
    },
    {
      label: 'edit preferences',
      onPress: () => {
        logTree?.();
        navigateNested('MainApp', 'EditPreferences');
      },
    },
    {
      label: 'blocked users',
      onPress: () => {
        // @ts-ignore
        nav.navigate('BlockedUsers');
      },
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => nav.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>account</Text>
          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={[
                  styles.menuItem,
                  index !== menuItems.length - 1 && styles.menuItemBorder
                ]} 
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <Text style={styles.menuText}>{item.label}</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.signOutButton} onPress={confirmSignOut}>
              <Text style={styles.signOutText}>sign out</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.deleteAccountRow} onPress={handleDeleteAccount}>
            <Text style={styles.deleteAccountText}>delete account</Text>
            <Text style={styles.deleteChevron}>›</Text>
          </TouchableOpacity>
          <Text style={styles.deleteHint}>this action cannot be undone</Text>
        </View>

        <Text style={styles.versionText}>v1.0.0</Text>
      </ScrollView>

      <CustomAlert 
        visible={alert.visible} 
        title={alert.title} 
        message={alert.message} 
        buttons={alert.buttons} 
        onRequestClose={() => setAlert({ ...alert, visible: false })} 
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.bg 
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,228,193,0.1)',
  },
  backBtn: { 
    padding: 8 
  },
  backText: { 
    color: COLORS.text, 
    fontSize: 24, 
    fontWeight: '300' 
  },
  headerTitle: { 
    color: COLORS.text, 
    fontSize: 18, 
    fontWeight: '700', 
    textTransform: 'lowercase' 
  },

  scrollContent: { 
    padding: 20,
    paddingBottom: 40,
  },

  section: {
    marginBottom: 28,
  },

  sectionLabel: {
    color: '#F0E4C1',
    opacity: 0.5,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  menuContainer: { 
    backgroundColor: 'rgba(240,228,193,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(240,228,193,0.08)',
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(240,228,193,0.05)',
  },
  menuText: { 
    color: COLORS.text, 
    fontSize: 15, 
    fontWeight: '500', 
    textTransform: 'lowercase' 
  },
  chevron: { 
    color: '#F0E4C1', 
    opacity: 0.4,
    fontSize: 18, 
  },

  buttonGroup: {
    gap: 12,
  },

  signOutButton: {
    backgroundColor: COLORS.button,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.button,
  },
  signOutText: { 
    color: COLORS.text, 
    fontSize: 15, 
    fontWeight: '700', 
    textTransform: 'lowercase' 
  },

  deleteAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  deleteAccountText: {
    color: '#F0E4C1',
    opacity: 0.5,
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'lowercase',
  },
  deleteChevron: {
    color: '#F0E4C1',
    opacity: 0.3,
    fontSize: 16,
  },
  deleteHint: {
    color: '#F0E4C1',
    opacity: 0.25,
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
  },

  versionText: { 
    textAlign: 'center', 
    color: '#F0E4C1', 
    opacity: 0.15,
    fontSize: 11, 
    marginTop: 20,
    fontWeight: '500',
  },
});