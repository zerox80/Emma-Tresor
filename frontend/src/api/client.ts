import axios from 'axios';

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
    if (typeof window !== 'undefined') {
      try {
        const { protocol, host } = window.location;
        if (protocol === 'https:' && url.protocol === 'http:' && url.host === host) {
          url.protocol = 'https:';
        }
      } catch (error) {
        // Fallback to resolved url below
      }
    }
    const normalised = url.toString().replace(/\/$/, '');
    return normalised;
  } catch (error) {
    // Falling back to default API base URL due to invalid VITE_API_BASE_URL
    return fallback;
  }
};

export const apiBaseUrl = resolveBaseURL();

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  timeout: 45000,
  headers: {
    Accept: 'application/json',
  },
});

export default apiClient;
