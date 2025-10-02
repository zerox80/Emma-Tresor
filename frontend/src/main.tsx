import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import apiClient from './api/client';
import { setupAuthInterceptor } from './api/authInterceptor';
import { useAuthStore } from './store/authStore';
import App from './App';
import './index.css';

// Setup automatic token refresh on 401 errors
setupAuthInterceptor(
  apiClient,
  () => useAuthStore.getState().refreshAccessToken(),
  () => useAuthStore.getState().logout(),
);

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
