import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initFirebase } from './firebase'; // Import the async initializer
import audioManager from './sounds'; // Import the audio manager

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

/**
 * Main application bootstrap function.
 */
const main = async () => {
  // First, ensure all async initializations (like Firebase) are complete.
  await initFirebase();
  
  // Initialize the audio manager once, before React renders.
  // This needs to be done on the client, after the document is available.
  audioManager.init();

  // Then, render the React application.
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Run the bootstrap function to start the app.
main();