import { initializeApp, getApps } from "firebase/app";
import { FIREBASE_CONFIG } from './config';

/**
 * Initializes Firebase. Must be called and awaited before the
 * app is rendered.
 */
export const initFirebase = async () => {
  if (!FIREBASE_CONFIG.apiKey) {
    console.warn("Firebase config is missing. This is expected in the AI Studio development environment. Please ensure your .env.local file is set up for local development and environment variables are configured for deployment.");
    // Prevent the app from initializing Firebase without a key
    return;
  }
  if (getApps().length === 0) {
    initializeApp(FIREBASE_CONFIG);
  }
};
