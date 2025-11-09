// Authentication Hook
// ===================
// This React hook provides convenient access to authentication state
// and automatically initializes the auth store on component mount.

import { useEffect } from 'react';                              // React effect hook for lifecycle management

import { useAuthStore } from '../store/authStore';           // Import authentication store

/**
 * Custom hook for accessing authentication state and actions.
 *
 * This hook provides a clean interface for components to access
 * authentication state without directly interacting with the store.
 * It also handles automatic initialization of the auth store.
 *
 * @returns {Object} Authentication state and actions
 *   - isAuthenticated: Whether user is currently logged in
 *   - hasInitialised: Whether auth store has completed initialization
 *   - user: Current user profile or null if not authenticated
 *   - logout: Function to log out the current user
 */
export const useAuth = () => {
  // Select individual state properties from the auth store
  const initialise = useAuthStore((state) => state.initialise);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasInitialised = useAuthStore((state) => state.hasInitialised);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Effect to initialize auth store if not already initialized
  useEffect(() => {
    if (!hasInitialised) {
      // Call initialize function to restore session from storage
      void initialise();
    }
  }, [hasInitialised, initialise]);

  // Return authentication state and actions for component consumption
  return {
    isAuthenticated,
    hasInitialised,
    user,
    logout,
  };
};
