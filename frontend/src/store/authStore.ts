import { create, type StateCreator } from 'zustand';
import { persist, type PersistOptions } from 'zustand/middleware';

import apiClient from '../api/client';
import type { LoginRequest, LoginResponse, RegisterRequest, UserProfile } from '../types/auth';

/**
 * Represents the complete state and available actions within the authentication store.
 * This interface defines all properties that describe the current authentication status
 * and the methods to interact with it.
 */
interface AuthState {
  /** The current authenticated user's profile data, or `null` if not authenticated. */
  user: UserProfile | null;
  /** A boolean indicating whether a user is currently authenticated. */
  isAuthenticated: boolean;
  /** A boolean indicating whether the authentication store has completed its initial loading/checking phase. */
  hasInitialised: boolean;
  /** The timestamp (in milliseconds) when the current access token is set to expire. */
  accessExpiresAt: number | null;
  /** A boolean indicating whether the user opted to "remember me" during login. */
  remembering: boolean;
  /**
   * Initiates the user login process.
   * @param {LoginRequest} credentials - The user's login credentials (email, password, rememberMe).
   * @returns {Promise<void>} A promise that resolves upon successful login, or rejects on failure.
   */
  login: (credentials: LoginRequest) => Promise<void>;
  /**
   * Initiates the user logout process.
   * Clears the authentication state and removes persisted data.
   * @returns {Promise<void>} A promise that resolves when the user is logged out.
   */
  logout: () => Promise<void>;
  /**
   * Initiates the user registration process.
   * @param {RegisterRequest} payload - The user's registration data.
   * @returns {Promise<void>} A promise that resolves upon successful registration, or rejects on failure.
   */
  register: (payload: RegisterRequest) => Promise<void>;
  /**
   * Attempts to refresh the access token using a refresh token.
   * This is typically called by the Axios interceptor when an access token expires.
   * @returns {Promise<void>} A promise that resolves to `true` if the token was successfully refreshed, `false` otherwise.
   */
  refreshAccessToken: () => Promise<void>;
  /**
   * Initializes the authentication state by checking for an existing session (e.g., from persisted storage)
   * and fetching the user profile if a session is found.
   * @returns {Promise<void>} A promise that resolves when the initialisation is complete.
   */
  initialise: () => Promise<void>;
}

/**
 * The key used for storing the authentication state in browser's local/session storage.
 */
const AUTH_STORAGE_KEY = 'emmatresor_auth_state';

/**
 * Type definition for the Zustand setter function used within the store.
 */
type AuthStoreSetter = (partial: Partial<AuthState>) => void;

/**
 * Resets the authentication state to its initial, unauthenticated values.
 * This is typically called during logout or when an authentication error occurs.
 * @param {AuthStoreSetter} set - The Zustand setter function.
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

/**
 * Type definition for Zustand's persist middleware mutators.
 */
type PersistMutators = [['zustand/persist', unknown]];

/**
 * The core state creator function for the authentication Zustand store.
 * It defines the initial state and all actions that can modify the authentication state.
 *
 * @param {AuthStoreSetter} set - The Zustand setter function to update the state.
 * @param {Function} get - The Zustand getter function to access the current state.
 * @returns {AuthState} The authentication state and actions.
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
        accessExpiresAt: null, // Access token expiration is managed by interceptor
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
 * Configuration for persisting the authentication state across sessions.
 * It specifies which parts of the state should be saved and restored.
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
 * The Zustand store for managing authentication state, enhanced with persistence middleware.
 * This store provides a centralized way to access and modify the user's authentication status,
 * user profile, and session-related information throughout the application.
 */
export const useAuthStore = create<AuthState>()(
  persist<AuthState>(authStoreCreator, persistOptions),
);
