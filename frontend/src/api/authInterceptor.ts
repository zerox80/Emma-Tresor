import { type AxiosError, type AxiosInstance, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

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

      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {

        if (
          originalRequest.url?.includes('/token/') ||
          originalRequest.url?.includes('/auth/logout/') ||
          originalRequest.url?.includes('/users/')
        ) {
          return Promise.reject(error);
        }

        if (isRefreshing) {

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
