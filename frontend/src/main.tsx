import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import apiClient, { ensureCSRFToken } from './api/client';
import { setupAuthInterceptor } from './api/authInterceptor';
import { useAuthStore } from './store/authStore';
import App from './App';
import './index.css';

/**
 * ----------------------------------------------------------------
 *               EmmaTresor React Application Entrypoint
 * ----------------------------------------------------------------
 *
 * This file configures and initializes the React application.
 *
 * Key Tasks:
 * 1.  **Authentication Interceptor:** Sets up an Axios interceptor
 *     to automatically handle JWT token refreshes on 401 Unauthorized
 *     responses. This provides a seamless user experience by preventing
 *     abrupt logouts.
 *
 * 2.  **CSRF Token Initialization:** Proactively fetches a CSRF token
 *     from the backend upon application load. This ensures that all
 *     subsequent state-changing requests (POST, PUT, DELETE) include
 *     the necessary CSRF protection.
 *
 * 3.  **React Root Rendering:** Renders the main `App` component into
 *     the DOM, wrapped in `React.StrictMode` for development checks
 *     and `BrowserRouter` for client-side routing.
 *
 * This setup ensures that critical security and session management
 * features are in place before any user interaction occurs.
 */

// Setup automatic token refresh on 401 errors
setupAuthInterceptor(
  apiClient,
  () => useAuthStore.getState().refreshAccessToken(),
  () => useAuthStore.getState().logout(),
);

// Initialize CSRF token before rendering
ensureCSRFToken().catch((error) => {
  console.error('Failed to initialize CSRF token:', error);
});

const rootElement = document.getElementById('app');

if (!rootElement) {
  throw new Error('Root element #app not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
