import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initFirebase } from './firebase'; // Import the async initializer
import audioManager from './sounds'; // Import the audio manager
import { piService } from './utils/pi';
import { logger } from './utils/logger';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/**
 * Main application bootstrap function.
 */
const main = async () => {
  try {
    // Initialize Pi SDK first, as it's critical for core functionality.
    await piService.initSdk();
  } catch (error) {
    // Log the error but allow the app to continue loading.
    // Some features might be disabled, but the game can still be playable.
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.log(`CRITICAL: Pi SDK initialization failed: ${errorMessage}`);
  }

  // Then, initialize other services.
  await initFirebase();
  audioManager.init();

  // Finally, render the React application.
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Run the bootstrap function to start the app.
main();