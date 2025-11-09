import { create, type StateCreator } from 'zustand';
import { persist, type PersistOptions } from 'zustand/middleware';

import apiClient from '../api/client';
import type { LoginRequest, LoginResponse, RegisterRequest, UserProfile } from '../types/auth';

interface AuthState {
  
  user: UserProfile | null;
  
  isAuthenticated: boolean;
  
  hasInitialised: boolean;
  
  accessExpiresAt: number | null;
  
  remembering: boolean;
  
  login: (credentials: LoginRequest) => Promise<void>;
  
  logout: () => Promise<void>;
  
  register: (payload: RegisterRequest) => Promise<void>;
  
  refreshAccessToken: () => Promise<void>;
  
  initialise: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'emmatresor_auth_state';

type AuthStoreSetter = (partial: Partial<AuthState>) => void;

const resetState = (set: AuthStoreSetter) => {
  set({
    user: null,
    isAuthenticated: false,
    hasInitialised: true,
    accessExpiresAt: null,
    remembering: false,
  });
};

type PersistMutators = [['zustand/persist', unknown]];

const authStoreCreator: StateCreator<AuthState, PersistMutators> = (set, get) => ({
  user: null,
  isAuthenticated: false,
  hasInitialised: false,
  accessExpiresAt: null,
  remembering: false,

  initialise: async () => {

    const currentState = get();
    if (!currentState.isAuthenticated && !currentState.remembering) {

      set({
        hasInitialised: true,
      });
      return;
    }

    const fetchProfile = async () => {
      const { data } = await apiClient.get<UserProfile>('/auth/me/');
      set({
        user: data,
        isAuthenticated: true,
        hasInitialised: true,
        accessExpiresAt: null,
      });
    };

    try {
      await fetchProfile();
      return;
    } catch (error) {

      const status = (error as { response?: { status?: number } }).response?.status;
      
      if (status && status !== 401) {

        console.error('Failed to initialise authentication state:', error);
      }

      set({
        user: null,
        isAuthenticated: false,
        hasInitialised: true,
        accessExpiresAt: null,
        remembering: false,
      });
    }
  },

  login: async ({ rememberMe, email, username, password }: LoginRequest) => {
    const normalisedEmail = email.trim().toLowerCase();
    const payload: Record<string, string> = {
      email: normalisedEmail,
      password,
      remember: rememberMe ? '1' : '0',
    };

    if (username && username.trim().length > 0) {
      payload.username = username.trim();
    }

    const { data } = await apiClient.post<LoginResponse>('/token/', payload);
    const profile = data.user ?? null;

    set({
      user: profile,
      isAuthenticated: Boolean(profile),
      hasInitialised: true,
      accessExpiresAt: Date.now() + data.access_expires * 1000,
      remembering: data.remember,
    });
  },

  register: async (payload: RegisterRequest) => {
    await apiClient.post('/users/', payload);
  },

  refreshAccessToken: async () => {
    const remember = get().remembering;
    const payload = remember ? { remember: '1' } : undefined;

    try {
      const { data } = await apiClient.post<{ access_expires: number; rotated: boolean }>('/token/refresh/', payload);
      set({
        accessExpiresAt: Date.now() + data.access_expires * 1000,
        remembering: remember,
        isAuthenticated: true,
        hasInitialised: true,
      });
      return true;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status && status !== 400 && status !== 401) {
        console.error('Failed to refresh authentication state:', error);
      }
      resetState(set);
      return false;
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout/', {});
    } catch (error) {

    }
    resetState(set);

    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  },
});

const persistOptions: PersistOptions<AuthState> = {
  name: AUTH_STORAGE_KEY,
  partialize: (state: AuthState) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    hasInitialised: state.hasInitialised,
    remembering: state.remembering,
  }),
};

export const useAuthStore = create<AuthState>()(
  persist<AuthState>(authStoreCreator, persistOptions),
);
