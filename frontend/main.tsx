import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './src/App';
import '@/styles/globals.css';

// Find the root element, with error handling
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element. The app cannot be rendered.');
}

// Create root and render app
const root = ReactDOM.createRoot(rootElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
