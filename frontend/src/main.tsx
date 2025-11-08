import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import apiClient, { ensureCSRFToken } from './api/client';
import { setupAuthInterceptor } from './api/authInterceptor';
import { useAuthStore } from './store/authStore';
import App from './App';
import './index.css';

/**
 * The entry point of the EmmaTresor React application.
 * This file is responsible for:
 *
 * 1.  **Setting up Authentication Interceptors:** Configures an Axios interceptor
 *     to automatically handle JWT token refreshes upon receiving 401 Unauthorized
 *     responses from the API. This ensures a smooth user experience by preventing
 *     premature logouts.
 *
 * 2.  **Initializing CSRF Token:** Fetches the Cross-Site Request Forgery (CSRF) token
 *     from the backend immediately upon application load. This token is crucial
 *     for securing state-changing requests (POST, PUT, DELETE) against CSRF attacks.
 *
 * 3.  **Rendering the React Application:** Renders the main `App` component into
 *     the DOM. The application is wrapped in `React.StrictMode` for development-time
 *     checks and `BrowserRouter` to enable client-side routing.
 *
 * This setup ensures that essential security measures and session management
 * are in place before the user interacts with the application.
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

/**
 * The DOM element where the React application will be mounted.
 * It is expected to have the ID 'app'.
 */
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
