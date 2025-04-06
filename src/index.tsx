import { Buffer } from 'buffer'; // Re-import Buffer
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './styles/style.css';
import './styles/cs16.css';
import './components/CaseOpener.css';
import logger from './logger'; // Import the logger

// Assign Buffer and render React app only if in a browser environment
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    logger.error('Failed to find the root element'); // Log error if root not found
    throw new Error('Failed to find the root element');
  }

  logger.info('Application starting, rendering React root...'); // Add startup log message

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
