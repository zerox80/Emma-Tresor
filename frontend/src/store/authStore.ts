import { jwtDecode } from 'jwt-decode';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import apiClient from '../api/client';
import type { LoginRequest, LoginResponse, RegisterRequest, UserProfile } from '../types/auth';
import { tokenStorage } from '../utils/tokenStorage';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasInitialised: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  initialise: () => Promise<void>;
}

interface DecodedToken {
  user_id: number;
  email?: string;
  username?: string;
  exp: number;
  iat: number;
}

const AUTH_STORAGE_KEY = 'emmatresor_auth_state';

const decodeToken = (token: string | null): UserProfile | null => {
  if (!token) {
    return null;
  }

  try {
    const decoded = jwtDecode<DecodedToken>(token);
    if (decoded.exp * 1000 <= Date.now()) {
      return null;
    }
    return {
      id: decoded.user_id,
      username: decoded.username ?? '',
      email: decoded.email ?? '',
    };
  } catch (error) {
    return null;
  }
};

const resetState = (set: (partial: Partial<AuthState>) => void) => {
  tokenStorage.clearTokens();
  set({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    hasInitialised: true,
  });
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasInitialised: false,

      initialise: async () => {
        const { access, refresh } = tokenStorage.getTokens();
        const profile = decodeToken(access);

        if (profile && access) {
          set({
            user: profile,
            accessToken: access,
            refreshToken: refresh,
            isAuthenticated: true,
            hasInitialised: true,
          });
          return;
        }

        if (refresh) {
          try {
            await get().refreshAccessToken();
          } catch (error) {
            resetState(set);
          }
          return;
        }

        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          hasInitialised: true,
        });
      },

      login: async ({ rememberMe, email, username, password }: LoginRequest) => {
        const normalisedEmail = email.trim().toLowerCase();
        const payload: Record<string, string> = {
          email: normalisedEmail,
          password,
        };

        if (username && username.trim().length > 0) {
          payload.username = username.trim();
        }

        const { data } = await apiClient.post<LoginResponse>('/token/', payload);
        tokenStorage.setTokens(data.access, data.refresh, rememberMe);
        const profile = decodeToken(data.access) ?? data.user ?? null;
        set({
          accessToken: data.access,
          refreshToken: data.refresh,
          isAuthenticated: Boolean(profile),
          user: profile,
          hasInitialised: true,
        });
      },

      register: async (payload: RegisterRequest) => {
        await apiClient.post('/users/', payload);
      },

      refreshAccessToken: async () => {
        const { refresh } = tokenStorage.getTokens();
        const activeRefresh = get().refreshToken ?? refresh;
        if (!activeRefresh) {
          resetState(set);
          return;
        }

        try {
          const { data } = await apiClient.post<LoginResponse>('/token/refresh/', {
            refresh: activeRefresh,
          });

          const nextRefresh = data.refresh ?? activeRefresh;
          tokenStorage.updateAccessToken(data.access, nextRefresh);
          const profile = decodeToken(data.access);
          set({
            accessToken: data.access,
            refreshToken: nextRefresh,
            user: profile,
            isAuthenticated: Boolean(profile),
            hasInitialised: true,
          });
        } catch (error) {
          resetState(set);
        }
      },

      logout: async () => {
        try {
          const { refresh } = tokenStorage.getTokens();
          if (refresh) {
            await apiClient.post('/auth/logout/', { refresh });
          }
        } catch (error) {
          // Ignore logout errors silently
        }
        resetState(set);
      },
    }),
    {
      name: AUTH_STORAGE_KEY,
      partialize: ({ user, isAuthenticated }) => ({
        user,
        isAuthenticated,
      }),
    },
  ),
);
