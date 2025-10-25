import { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

/**
 * Processes the queue of failed requests.
 *
 * @param {Error | null} error - The error to reject the promises with. If null, the promises are resolved.
 */
const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

/**
 * Sets up an Axios interceptor to handle token refreshing.
 *
 * @param {AxiosInstance} axiosInstance - The Axios instance to attach the interceptor to.
 * @param {() => Promise<boolean>} refreshTokenFn - A function that refreshes the token and returns a boolean indicating success.
 * @param {() => Promise<void>} logoutFn - A function that logs the user out.
 */
export const setupAuthInterceptor = (
  axiosInstance: AxiosInstance,
  refreshTokenFn: () => Promise<boolean>,
  logoutFn: () => Promise<void>,
) => {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      // Only intercept 401 errors that haven't been retried yet
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        // Don't retry on auth endpoints to avoid infinite loops
        if (
          originalRequest.url?.includes('/token/') ||
          originalRequest.url?.includes('/auth/logout/') ||
          originalRequest.url?.includes('/users/')
        ) {
          return Promise.reject(error);
        }

        if (isRefreshing) {
          // If a refresh is already in progress, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              return axiosInstance(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshSuccess = await refreshTokenFn();

          if (refreshSuccess) {
            processQueue(null);
            return axiosInstance(originalRequest);
          } else {
            // Refresh failed, logout user
            processQueue(new Error('Token refresh failed'));
            await logoutFn();
            return Promise.reject(error);
          }
        } catch (refreshError) {
          processQueue(refreshError as Error);
          await logoutFn();
          return Promise.reject(error);
        } finally {
          isRefreshing = false;
        }
      }

      return Promise.reject(error);
    },
  );
};
