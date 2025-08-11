import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS } from '../../utils/colors';
import Button from '../common/Button';

const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>filmatch</Text>
          <Text style={styles.subtitle}>
            find your perfect movie match through letterboxd
          </Text>
        </View>

        <View style={styles.buttonContainer}>
          <Button
            title="sign in"
            onPress={() => navigation.navigate('SignIn')}
            style={styles.button}
          />
          <Button
            title="sign up"
            onPress={() => navigation.navigate('SignUp')}
            style={[styles.button, styles.signUpButton]}
            textStyle={styles.signUpButtonText}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 80,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  button: {
    width: '100%',
  },
  signUpButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.button,
  },
  signUpButtonText: {
    color: COLORS.text,
  },
});

export default WelcomeScreen;
