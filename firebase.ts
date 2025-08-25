// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDDF_WKINlE9VGkNrD97erEMr_Ue8q4I7U",
  authDomain: "d-snake-7a80a.firebaseapp.com",
  projectId: "d-snake-7a80a",
  storageBucket: "d-snake-7a80a.firebasestorage.app",
  messagingSenderId: "945566931016",
  appId: "1:945566931016:web:56c7491532a28bb7fda07d",
  measurementId: "G-VX9230L88N"
};

/**
 * Initializes Firebase. Must be called and awaited before the
 * app is rendered.
 */
export const initFirebase = async () => {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
};
