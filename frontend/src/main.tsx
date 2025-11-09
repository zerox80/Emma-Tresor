import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import apiClient, { ensureCSRFToken } from './api/client';
import { setupAuthInterceptor } from './api/authInterceptor';
import { useAuthStore } from './store/authStore';
import App from './App';
import './index.css';

setupAuthInterceptor(
  apiClient,
  () => useAuthStore.getState().refreshAccessToken(),
  () => useAuthStore.getState().logout(),
);

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
