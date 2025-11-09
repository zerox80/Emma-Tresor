// Authentication Interceptor
// =========================
// This module handles automatic JWT token refresh when API requests fail due to expired tokens.
// It implements a queue system to prevent multiple simultaneous refresh attempts and ensures
// that pending requests are retried after successful token refresh.

import { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

// Global flag to track if a token refresh is currently in progress
// This prevents multiple simultaneous refresh attempts
let isRefreshing = false;

// Queue to hold pending requests that failed due to expired tokens
// Each request is represented by a promise with resolve/reject functions
let failedQueue: Array<{
  resolve: (value?: unknown) => void;    // Function to resolve the pending request
  reject: (reason?: unknown) => void;    // Function to reject the pending request
}> = [];

/**
 * Process all pending requests in the failed queue.
 *
 * This function is called after a token refresh attempt (either successful or failed)
 * to resolve or reject all pending requests that were waiting for the refresh to complete.
 *
 * @param {Error | null} error - Error from token refresh, null if successful
 */
const processQueue = (error: Error | null = null) => {
  // Process each pending request in the queue
  failedQueue.forEach((prom) => {
    if (error) {
      // If refresh failed, reject all pending requests with the error
      prom.reject(error);
    } else {
      // If refresh succeeded, resolve all pending requests
      prom.resolve();
    }
  });

  // Clear the queue after processing all requests
  failedQueue = [];
};

/**
 * Setup authentication interceptor for automatic token refresh.
 *
 * This function configures an Axios interceptor to handle 401 Unauthorized responses
 * by automatically attempting to refresh the JWT access token and retrying the original request.
 *
 * @param {AxiosInstance} axiosInstance - The Axios instance to intercept
 * @param {() => Promise<boolean>} refreshTokenFn - Function that attempts to refresh the access token
 * @param {() => Promise<void>} logoutFn - Function to call when refresh fails (logs out user)
 */
export const setupAuthInterceptor = (
  axiosInstance: AxiosInstance,
  refreshTokenFn: () => Promise<boolean>,
  logoutFn: () => Promise<void>,
) => {
  // Setup response interceptor to handle authentication errors
  axiosInstance.interceptors.response.use(
    // Success handler: just return the response as-is
    (response: AxiosResponse) => {
      return response;
    },
    // Error handler: handle 401 errors by attempting token refresh
    async (error: AxiosError) => {
      // Get the original request configuration (type assertion to add _retry property)
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Check if this is a 401 error and the request hasn't been retried yet
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {

        // Skip token refresh for authentication-related endpoints to prevent infinite loops
        if (
          originalRequest.url?.includes('/token/') ||           // Token refresh/login endpoints
          originalRequest.url?.includes('/auth/logout/') ||     // Logout endpoint
          originalRequest.url?.includes('/users/')              // User management endpoints
        ) {
          return Promise.reject(error);                         // Let these errors propagate normally
        }

        // If a refresh is already in progress, queue this request
        if (isRefreshing) {
          // Create a new promise and add it to the queue
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              // When refresh completes, retry the original request
              return axiosInstance(originalRequest);
            })
            .catch((err) => {
              // If refresh failed, reject with the error
              return Promise.reject(err);
            });
        }

        // Mark this request as retried to prevent infinite retry loops
        originalRequest._retry = true;
        // Set flag to indicate refresh is in progress
        isRefreshing = true;

        try {
          // Attempt to refresh the access token
          const refreshSuccess = await refreshTokenFn();

          if (refreshSuccess) {
            // If refresh succeeded, process the queue and retry original request
            processQueue(null);                                // Resolve all queued requests
            return axiosInstance(originalRequest);              // Retry the failed request
          } else {
            // If refresh failed, process queue with error and logout user
            processQueue(new Error('Token refresh failed'));
            await logoutFn();                                  // Log out the user
            return Promise.reject(error);                     // Reject the original error
          }
        } catch (refreshError) {
          // If refresh threw an exception, process queue with error and logout user
          processQueue(refreshError as Error);
          await logoutFn();                                    // Log out the user
          return Promise.reject(error);                       // Reject the original error
        } finally {
          // Always reset the refresh flag when done
          isRefreshing = false;
        }
      }

      // For non-401 errors or already retried requests, just reject normally
      return Promise.reject(error);
    },
  );
};
