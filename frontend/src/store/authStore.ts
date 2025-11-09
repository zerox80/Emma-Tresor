// Authentication State Management Store
// ==================================
// This module uses Zustand with persistence to manage user authentication state.
// It handles login, logout, registration, token refresh, and session persistence.

import { create, type StateCreator } from 'zustand';              // State management library
import { persist, type PersistOptions } from 'zustand/middleware'; // Persistence middleware

import apiClient from '../api/client';                             // Configured API client
import type { LoginRequest, LoginResponse, RegisterRequest, UserProfile } from '../types/auth'; // Type definitions

/**
 * Interface defining the shape of authentication state.
 * 
 * Includes user data, authentication status, session metadata,
 * and action methods for state manipulation.
 */
interface AuthState {
  /** Currently authenticated user profile or null if not logged in */
  user: UserProfile | null;
  
  /** Whether user is currently authenticated */
  isAuthenticated: boolean;
  
  /** Whether the auth store has completed initialization */
  hasInitialised: boolean;
  
  /** Timestamp when access token expires (milliseconds since epoch) */
  accessExpiresAt: number | null;
  
  /** Whether user chose "remember me" option during login */
  remembering: boolean;
  
  /** Login method - authenticates user with credentials */
  login: (credentials: LoginRequest) => Promise<void>;
  
  /** Logout method - clears authentication state */
  logout: () => Promise<void>;
  
  /** Register method - creates new user account */
  register: (payload: RegisterRequest) => Promise<void>;
  
  /** Refresh method - updates expired access token */
  refreshAccessToken: () => Promise<void>;
  
  /** Initialize method - restores auth state from storage */
  initialise: () => Promise<void>;
}

/** Storage key for persisting authentication state in browser storage */
const AUTH_STORAGE_KEY = 'emmatresor_auth_state';

/** Type definition for Zustand state setter function */
type AuthStoreSetter = (partial: Partial<AuthState>) => void;

/**
 * Reset authentication state to logged-out values.
 * 
 * @param set - Zustand state setter function
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

/** Type definition for Zustand persist middleware mutators */
type PersistMutators = [['zustand/persist', unknown]];

/**
 * Create authentication store with all state and actions.
 * 
 * This store creator defines the complete authentication state management
 * including login, logout, registration, and token refresh functionality.
 */
const authStoreCreator: StateCreator<AuthState, PersistMutators> = (set, get) => ({
  // Initial state values
  user: null,
  isAuthenticated: false,
  hasInitialised: false,
  accessExpiresAt: null,
  remembering: false,

  /**
   * Initialize authentication state from stored session.
   * 
   * Attempts to restore user session by fetching current user profile
   * from the backend. If user is not remembered, skips initialization.
   */
  initialise: async () => {
    const currentState = get();
    
    // Skip initialization if user is not authenticated and not remembered
    if (!currentState.isAuthenticated && !currentState.remembering) {
      set({
        hasInitialised: true,
      });
      return;
    }

    // Function to fetch user profile from backend
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
      // Attempt to fetch user profile
      await fetchProfile();
      return;
    } catch (error) {
      // Handle authentication errors gracefully
      const status = (error as { response?: { status?: number } }).response?.status;
      
      // Only log errors that aren't authentication failures
      if (status && status !== 401) {
        console.error('Failed to initialise authentication state:', error);
      }

      // Reset to logged-out state on error
      set({
        user: null,
        isAuthenticated: false,
        hasInitialised: true,
        accessExpiresAt: null,
        remembering: false,
      });
    }
  },

  /**
   * Authenticate user with email/username and password.
   * 
   * @param credentials - Login credentials including email, password, and remember me option
   */
  login: async ({ rememberMe, email, username, password }: LoginRequest) => {
    const normalisedEmail = email.trim().toLowerCase();
    const payload: Record<string, string> = {
      email: normalisedEmail,
      password,
      remember: rememberMe ? '1' : '0',
    };

    // Add username to payload if provided (optional field)
    if (username && username.trim().length > 0) {
      payload.username = username.trim();
    }

    // Send login request to backend
    const { data } = await apiClient.post<LoginResponse>('/token/', payload);
    const profile = data.user ?? null;

    // Update store with authentication result
    set({
      user: profile,
      isAuthenticated: Boolean(profile),
      hasInitialised: true,
      accessExpiresAt: Date.now() + data.access_expires * 1000,
      remembering: data.remember,
    });
  },

  /**
   * Register a new user account.
   * 
   * @param payload - Registration data including username, email, and password
   */
  register: async (payload: RegisterRequest) => {
    await apiClient.post('/users/', payload);
  },

  /**
   * Refresh the access token using refresh token.
   * 
   * This method handles token expiration by requesting a new access token
   * from the refresh endpoint. Updates the expiration timestamp.
   * 
   * @returns {Promise<boolean>} True if refresh succeeded, false otherwise
   */
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
      
      // Only log unexpected errors (not auth failures)
      if (status && status !== 400 && status !== 401) {
        console.error('Failed to refresh authentication state:', error);
      }
      
      // Reset to logged-out state on refresh failure
      resetState(set);
      return false;
    }
  },

  /**
   * Logout user and clear authentication state.
   * 
   * Calls the backend logout endpoint to invalidate refresh tokens,
   * then clears the local state and browser storage.
   */
  logout: async () => {
    try {
      // Notify the backend to invalidate tokens
      await apiClient.post('/auth/logout/', {});
    } catch (error) {
      // Silently ignore logout errors - still clear local state
    }
    
    // Reset state to logged-out values
    resetState(set);

    // Clear authentication data from all browser storage
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
  },
});

/**
 * Configuration for Zustand persistence middleware.
 * 
 * Persists the authentication state to localStorage/sessionStorage
 * based on the user's "remember me" preference.
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
 * Create and export the authentication store.
 * 
 * Combines the store creator with the persistence middleware
 * to create a fully functional authentication state store.
 */
export const useAuthStore = create<AuthState>()(
  persist<AuthState>(authStoreCreator, persistOptions),
);
