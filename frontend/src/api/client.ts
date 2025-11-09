// API Client Configuration
// =======================
// This module sets up the Axios HTTP client for communicating with the Django backend.
// It handles CSRF protection, base URL resolution, and request/response interceptors.

import axios from 'axios';                                 // HTTP client library for API requests

/**
 * Derive fallback API URL based on environment and browser context.
 *
 * @returns {string} The fallback API URL
 */
const deriveFallbackApi = (): string => {
  // Use local development server in development mode
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000/api';
  }

  // Use current window origin if available (for production deployments)
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin.replace(/\/$/, '')}/api`;
  }

  // Default fallback for unknown environments
  return 'http://127.0.0.1:8000/api';
};

/**
 * Resolve the base API URL from environment variables or fallback.
 *
 * This function handles URL normalization and protocol detection:
 * - Uses VITE_API_BASE_URL if configured
 * - Falls back to derived URL from environment
 * - Ensures proper /api pathname
 * - Handles HTTPS protocol detection for security
 *
 * @returns {string} The resolved base API URL
 */
const resolveBaseURL = () => {
  // Get configured API base URL from environment variables
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const fallback = deriveFallbackApi();
  const source = configured.length > 0 ? configured : fallback;

  try {
    // Parse the URL to manipulate components
    const url = new URL(source);
    
    // Ensure /api pathname is present
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/api';
    }
    
    // Handle protocol detection for security
    if (typeof window !== 'undefined') {
      try {
        const { protocol, host } = window.location;
        // Upgrade to HTTPS if page is secure and API URL is HTTP
        if (protocol === 'https:' && url.protocol === 'http:' && url.host === host) {
          url.protocol = 'https:';
        }
      } catch (error) {
        // Silently ignore location access errors
      }
    }
    
    // Remove trailing slash for consistency
    const normalised = url.toString().replace(/\/$/, '');
    return normalised;
  } catch (error) {
    // Return fallback if URL parsing fails
    return fallback;
  }
};

/**
 * Extract CSRF token from browser cookies.
 *
 * CSRF (Cross-Site Request Forgery) protection requires a token for
 * state-changing requests (POST, PUT, PATCH, DELETE).
 *
 * @returns {string | null} The CSRF token or null if not found
 */
export const getCSRFToken = (): string | null => {
  // Skip if not in browser environment
  if (typeof document === 'undefined') return null;
  
  const name = 'csrftoken';                                    // Django's default CSRF cookie name
  const cookieValue = document.cookie
    .split('; ')                                           // Split cookies into array
    .find((row) => row.startsWith(`${name}=`))             // Find CSRF cookie
    ?.split('=')[1];                                        // Extract token value
  
  return cookieValue || null;                                   // Return token or null
};

/**
 * Ensure CSRF token is available by fetching from server if missing.
 *
 * This function should be called before making authenticated requests
 * to ensure the CSRF cookie is set.
 *
 * @returns {Promise<void>} Promise that resolves when token is ensured
 */
export const ensureCSRFToken = async (): Promise<void> => {
  const token = getCSRFToken();
  if (token) return;                                       // Token already exists, no action needed
  
  try {
    // Fetch CSRF token from Django endpoint
    await axios.get(`${apiBaseUrl}/csrf/`, { withCredentials: true });
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
  }
};

// Export resolved base URL for use in other modules
export const apiBaseUrl = resolveBaseURL();

/**
 * Main Axios instance for API communication.
 *
 * Configured with:
 * - Dynamic base URL resolution
 * - Cookie-based authentication support
 * - 30-second timeout for requests
 * - JSON content type acceptance
 * - CSRF token injection for state-changing requests
 */
const apiClient = axios.create({
  baseURL: apiBaseUrl,                                      // Use resolved base URL
  withCredentials: true,                                     // Send cookies for authentication
  timeout: 30000,                                           // 30 second timeout
  headers: {
    Accept: 'application/json',                                 // Expect JSON responses
  },
});

/**
 * Request interceptor to automatically add CSRF tokens to requests.
 *
 * This interceptor runs before each request and adds the CSRF token
 * to headers for state-changing HTTP methods.
 */
apiClient.interceptors.request.use(
  (config) => {
    // Check if request method requires CSRF protection
    if (config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        // Add CSRF token to request headers
        config.headers['X-CSRFToken'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    // Pass through request configuration errors
    return Promise.reject(error);
  }
);

export default apiClient;                                      // Export configured Axios instance
