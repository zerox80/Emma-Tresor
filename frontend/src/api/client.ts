import axios from 'axios';

import { tokenStorage } from '../utils/tokenStorage';

const deriveFallbackApi = (): string => {
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000/api';
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }

  return 'http://127.0.0.1:8000/api';
};

const resolveBaseURL = () => {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const fallback = deriveFallbackApi();
  const source = configured.length > 0 ? configured : fallback;

  try {
    const url = new URL(source);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/api';
    }
    const normalised = url.toString().replace(/\/$/, '');
    return normalised;
  } catch (error) {
    console.warn('Falling back to default API base URL due to invalid VITE_API_BASE_URL', error);
    return fallback;
  }
};

const apiClient = axios.create({
  baseURL: `${resolveBaseURL()}`,
  withCredentials: true,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const headers = config.headers ?? {};
  const { access } = tokenStorage.getTokens();
  if (access) {
    headers.Authorization = `Bearer ${access}`;
  } else {
    delete headers.Authorization;
  }
  config.headers = headers;
  return config;
});

export default apiClient;
