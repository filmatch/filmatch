import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCR48YkWEmgOqahh_Mf-zbn3oJ32u1bsM',
  authDomain: 'filmatch-7ae59.firebaseapp.com',
  projectId: 'filmatch-7ae59',
  storageBucket: 'filmatch-7ae59.appspot.com',
  messagingSenderId: '377595335531',
  appId: '1:377595335531:web:5619f92a50ea7b1b062b2e',
  measurementId: 'G-QEER58P7MJ',
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
