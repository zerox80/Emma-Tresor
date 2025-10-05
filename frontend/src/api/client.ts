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

/**
 * Get CSRF token from cookie
 * Django's default CSRF cookie name is 'csrftoken'
 */
export const getCSRFToken = (): string | null => {
  if (typeof document === 'undefined') return null;
  
  const name = 'csrftoken';
  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];
  
  return cookieValue || null;
};

/**
 * Ensure CSRF token is available by fetching it from the backend
 */
export const ensureCSRFToken = async (): Promise<void> => {
  const token = getCSRFToken();
  if (token) return; // Token already exists
  
  try {
    // Fetch CSRF token from backend
    await axios.get(`${apiBaseUrl}/csrf/`, { withCredentials: true });
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
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

// Add CSRF token to all requests
apiClient.interceptors.request.use(
  (config) => {
    // Only add CSRF token for state-changing methods
    if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;
