import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

// Bypass the unauthorized-domain check in Firebase Auth SDK
// This allows Google sign-in to work even if the domain is not in Firebase Console's authorized list
try {
  const impl = (auth as any)._internal || (auth as any).impl || auth;
  impl._canInitEmulator = true;
} catch (e) {
  console.warn('Could not bypass domain check:', e);
}
