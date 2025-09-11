import { logger } from './utils/logger';

// --- Hardcoded Configuration ---
// This file contains hardcoded values to ensure the application builds correctly
// in environments like AI Studio where .env files are not accessible.

// --- INSTRUCTIONS FOR MAINNET DEPLOYMENT ---
// When you are ready to build for your production URL (Mainnet):
// 1. Comment out the entire TESTNET CONFIGURATION block below.
// 2. Uncomment the entire MAINNET CONFIGURATION block below.
// 3. Fill in your actual Firebase mainnet credentials.
// 4. Run `npm run build:mainnet` from your local machine.

// --- TESTNET CONFIGURATION (for AI Studio & Dev Builds) ---
export const PI_SANDBOX = true;
export const BACKEND_URL = 'https://service-3d-snake-945566931016.us-west1.run.app/';
export const DUMMY_MODE = false;
export const FIREBASE_CONFIG = {
  apiKey: "", // Not needed for testnet deployment from AI Studio
  authDomain: "",
  projectId: "d-snake-7a80a", // Can use a real project ID for basic analytics
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
  measurementId: ""
};
// --- END OF TESTNET CONFIGURATION ---


/*
// --- MAINNET CONFIGURATION (for Production Builds) ---
export const PI_SANDBOX = false;
export const BACKEND_URL = 'https://your-mainnet-backend-url.run.app/'; // <-- IMPORTANT: Update this to your production backend URL
export const DUMMY_MODE = false;
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_MAINNET_API_KEY", // <-- IMPORTANT: Fill in your Mainnet Firebase credentials
  authDomain: "YOUR_MAINNET_AUTH_DOMAIN",
  projectId: "YOUR_MAINNET_PROJECT_ID",
  storageBucket: "YOUR_MAINNET_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MAINNET_MESSAGING_SENDER_ID",
  appId: "YOUR_MAINNET_APP_ID",
  measurementId: "YOUR_MAINNET_MEASUREMENT_ID"
};
// --- END OF MAINNET CONFIGURATION ---
*/


// --- Sanity Check & Logging for Debugging ---
// This block will run when the app loads, logging the configuration
// that was compiled into the application bundle.
logger.log('--- Environment Configuration (from hardcoded values) ---');
logger.log(`PI_SANDBOX: ${PI_SANDBOX}`);
logger.log(`BACKEND_URL: '${BACKEND_URL}'`);
logger.log(`DUMMY_MODE: ${DUMMY_MODE}`);
logger.log(`Firebase Project ID: '${FIREBASE_CONFIG.projectId || 'Not Found'}'`);
logger.log('---------------------------------');

if (!DUMMY_MODE && !BACKEND_URL) {
    logger.log('CRITICAL WARNING: BACKEND_URL is not set. Pi authentication and payment verification will fail.');
}
