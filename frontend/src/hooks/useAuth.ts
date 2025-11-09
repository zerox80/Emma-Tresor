import { useEffect } from 'react';

import { useAuthStore } from '../store/authStore';

/**
 * Custom authentication hook that provides centralized access to authentication state and management.
 * 
 * This hook serves as the primary interface for authentication-related functionality throughout the application,
 * providing a clean and consistent API for accessing user authentication status, user data, and authentication actions.
 * 
 * Key Features:
 * - Automatic initialization on app mount to restore authentication state from persistent storage
 * - Reactive updates to authentication state changes using Zustand store
 * - Type-safe access to user data and authentication status
 * - Centralized logout functionality with proper cleanup
 * - Performance optimization with dependency array to prevent unnecessary re-renders
 * 
 * State Management:
 * - Integrates with Zustand store for predictable state management
 * - Persists authentication state across browser sessions
 * - Handles race conditions during initialization
 * - Provides loading states for better UX
 * 
 * Security Considerations:
 * - Secure storage of authentication tokens
 * - Proper cleanup of user sessions on logout
 * - Protection against authentication state inconsistencies
 * - Token refresh and validation handling (where applicable)
 * 
 * @returns {{
 *   isAuthenticated: boolean;
 *   hasInitialised: boolean;
 *   user: import('../types/auth').User | null;
 *   logout: () => Promise<void>;
 * }} Authentication context object containing:
 * - `isAuthenticated`: Current authentication status flag for conditional rendering
 * - `hasInitialised`: Initialization status for loading states and race condition prevention
 * - `user`: Complete user object with profile information when authenticated
 * - `logout`: Secure logout function that clears all authentication data and redirects
 */
export const useAuth = () => {
  const initialise = useAuthStore((state) => state.initialise);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasInitialised = useAuthStore((state) => state.hasInitialised);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // On initial mount, check if the auth store has been initialised.
  // If not, call the `initialise` action to load the session from storage.
  useEffect(() => {
    if (!hasInitialised) {
      void initialise();
    }
  }, [hasInitialised, initialise]);

  return {
    isAuthenticated,
    hasInitialised,
    user,
    logout,
  };
};
