import React from 'react';                                 // Import React library for JSX
import ReactDOM from 'react-dom/client';                    // Import React DOM client for rendering
import { BrowserRouter } from 'react-router-dom';           // Import routing component

import apiClient, { ensureCSRFToken } from './api/client';  // Import API client and CSRF utility
import { setupAuthInterceptor } from './api/authInterceptor'; // Import auth interceptor for token refresh
import { useAuthStore } from './store/authStore';           // Import authentication state store
import App from './App';                                    // Import main App component
import './index.css';                                       // Import global CSS styles

// Setup authentication interceptor for automatic token refresh
setupAuthInterceptor(
  apiClient,                                               // Axios instance to intercept
  () => useAuthStore.getState().refreshAccessToken(),     // Token refresh function
  () => useAuthStore.getState().logout(),                 // Logout function on refresh failure
);

// Initialize CSRF token for API security
ensureCSRFToken().catch((error) => {
  console.error('Failed to initialize CSRF token:', error);
});

// Find the root DOM element for React app
const rootElement = document.getElementById('app');

// Ensure root element exists before rendering
if (!rootElement) {
  throw new Error('Root element #app not found');
}

// Create React root and render the application
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
