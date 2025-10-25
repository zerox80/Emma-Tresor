import { create, type StateCreator } from 'zustand';
import { persist, type PersistOptions } from 'zustand/middleware';

import apiClient from '../api/client';
import type { LoginRequest, LoginResponse, RegisterRequest, UserProfile } from '../types/auth';

/**
 * Represents the state and actions for authentication.
 */
interface AuthState {
  /** The current authenticated user's profile, or null if not authenticated. */
  user: UserProfile | null;
  /** True if the user is currently authenticated. */
  isAuthenticated: boolean;
  /** True if the store has performed its initial authentication check. */
  hasInitialised: boolean;
  /** The timestamp (in milliseconds) when the current access token expires. */
  accessExpiresAt: number | null;
  /** True if the user has selected the "remember me" option. */
  remembering: boolean;
  /**
   * Logs in a user with the given credentials.
   * @param credentials The login credentials.
   * @returns A promise that resolves on successful login.
   */
  login: (credentials: LoginRequest) => Promise<void>;
  /**
   * Logs out the current user.
   * @returns A promise that resolves when the user is logged out.
   */
  logout: () => Promise<void>;
  /**
   * Registers a new user.
   * @param payload The registration data.
   * @returns A promise that resolves on successful registration.
   */
  register: (payload: RegisterRequest) => Promise<void>;
  /**
   * Refreshes the access token.
   * @returns A promise that resolves to true on success, false on failure.
   */
  refreshAccessToken: () => Promise<boolean>;
  /**
   * Initialises the authentication state, checking for an existing session.
   * @returns A promise that resolves when initialisation is complete.
   */
  initialise: () => Promise<void>;
}

const AUTH_STORAGE_KEY = 'emmatresor_auth_state';

type AuthStoreSetter = (partial: Partial<AuthState>) => void;

/**
 * Resets the authentication state to its initial, unauthenticated values.
 * @param set The Zustand setter function.
 */
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

/**
 * The state creator function for the authentication store.
 *
 * @param set The Zustand setter function.
 * @param get The Zustand getter function.
 * @returns The authentication state and actions.
 */
const authStoreCreator: StateCreator<AuthState, PersistMutators> = (set, get) => ({
  user: null,
  isAuthenticated: false,
  hasInitialised: false,
  accessExpiresAt: null,
  remembering: false,

  initialise: async () => {
    // Check if we have persisted state that indicates we should be logged in
    const currentState = get();
    if (!currentState.isAuthenticated && !currentState.remembering) {
      // No indication that we should be logged in, skip initialization
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
      // The auth interceptor will handle 401 errors and token refresh automatically
      // If we reach here, it means the user is not authenticated (refresh failed)
      const status = (error as { response?: { status?: number } }).response?.status;

      if (status && status !== 401) {
        // Log non-401 errors for debugging
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
      // Ignore logout errors silently
    }
    resetState(set);
    // Clear persisted state from browser storage
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  },
});

/**
 * Configuration for persisting the authentication state.
 */
const persistOptions: PersistOptions<AuthState> = {
  name: AUTH_STORAGE_KEY,
  partialize: (state: AuthState) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    hasInitialised: state.hasInitialised,
    remembering: state.remembering,
  }),
};

/**
 * The Zustand store for authentication, with persistence middleware.
 */
export const useAuthStore = create<AuthState>()(
  persist<AuthState>(authStoreCreator, persistOptions),
);
