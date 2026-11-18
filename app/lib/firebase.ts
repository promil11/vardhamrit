/**
 * Vardhamrit Luxury Tea - Firebase Phone Authentication Configuration
 * Provides 10,000 Free Phone SMS OTPs / month directly through Google Firebase.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { Platform } from 'react-native';

// Firebase configuration for Vardhamrit project
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyC_94RouPwh4vZKKLCzWcVZqZiauUXolaE',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'vardhamrit.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'vardhamrit',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'vardhamrit.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '651830530922',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:651830530922:web:11b2862af08fd740550b13',
};

// Initialize Firebase App singleton
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

let recaptchaVerifier: RecaptchaVerifier | null = null;

/**
 * Initializes invisible Recaptcha verifier for Phone Auth on Web
 */
export function getRecaptchaVerifier(containerId = 'recaptcha-container'): RecaptchaVerifier | null {
  if (Platform.OS !== 'web') {
    return null;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    if (!recaptchaVerifier) {
      recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: 'invisible',
        callback: () => {
          // reCAPTCHA solved - will proceed with submit
        },
        'expired-callback': () => {
          recaptchaVerifier = null;
        },
      });
      recaptchaVerifier.render();
    }
    return recaptchaVerifier;
  } catch (err) {
    console.warn('[Firebase] Recaptcha setup warning:', err);
    return null;
  }
}

/**
 * Dispatches Phone SMS OTP via Google Firebase
 */
export async function sendFirebasePhoneOtp(
  rawPhone: string,
  verifier?: RecaptchaVerifier | null
): Promise<ConfirmationResult> {
  const digits = rawPhone.replace(/[^0-9]/g, '');
  const clean10 = digits.length > 10 ? digits.slice(-10) : digits;
  const e164Phone = `+91${clean10}`;

  const activeVerifier = verifier || getRecaptchaVerifier();
  if (!activeVerifier && Platform.OS === 'web') {
    throw new Error('reCAPTCHA verifier is required for web phone authentication');
  }

  // @ts-ignore - verifier is optional on native platforms
  const confirmationResult = await signInWithPhoneNumber(auth, e164Phone, activeVerifier);
  return confirmationResult;
}

export { ConfirmationResult };
