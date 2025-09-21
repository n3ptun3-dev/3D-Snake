// Add this to the global scope to inform TypeScript about our pre-app logger
declare global {
    interface Window {
        preAppLogger?: {
            _queue: string[];
            log: (source: string, ...args: any[]) => void;
        };
        SNAKE_BUNDLE_PATH?: string;
    }
}

/**
 * Master switch for all application logging.
 * Set to `true` to enable console logs and remote logging to the spreadsheet.
 * Set to `false` for production to silence all logs.
 */
export const VERBOSE_LOGGING = false;

const log = (...args: any[]) => {
    // This function acts as a proxy to the pre-app logger defined in index.html.
    // It ensures that logs from this critical config file are queued up and sent
    // to the remote logger once the main application initializes.
    if (window.preAppLogger) {
        window.preAppLogger.log('[Config]', ...args);
    } else {
        // Fallback for environments where the pre-app logger might not exist (e.g. unit tests)
        console.log('[Config]', ...args);
    }
};


log('--- Executing config.ts v3.2 ---');

// The build script will replace `process.env.APP_ENV` with a literal string: "mainnet" or "testnet".
// This value is the single source of truth for the app's environment configuration.
const buildEnv = process.env.APP_ENV || 'testnet';
log(`Build environment detected: '${buildEnv}'`);

// Set configuration based on the build environment
const isMainnet = buildEnv === 'mainnet';

let backendUrl: string;
if (isMainnet) {
    backendUrl = 'https://pi-auth-service-mainnet-945566931016.europe-west1.run.app';
    log('Using MAINNET backend.');
} else {
    backendUrl = 'https://pi-auth-service-945566931016.europe-west1.run.app';
    log('Using TESTNET backend.');
}
export const BACKEND_URL = backendUrl;


// --- The rest of the config remains the same ---

// PI_SANDBOX is injected by the build script based on the build command (e.g., `... --no-sandbox`).
const piSandboxString = process.env.PI_SANDBOX || 'true';
export const PI_SANDBOX = piSandboxString === 'true';
log(`Final PI_SANDBOX value: ${PI_SANDBOX}`);


// DUMMY_MODE is for local development outside of Pi Browser. Injected by the build script.
const dummyModeString = process.env.DUMMY_MODE || 'false';
export const DUMMY_MODE = dummyModeString === 'true';
log(`Final DUMMY_MODE value: ${DUMMY_MODE}`);


export const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
};