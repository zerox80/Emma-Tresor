import { useEffect } from 'react';

import { useAuthStore } from '../store/authStore';

/**
 * A custom hook that provides access to the authentication state and actions from the `useAuthStore`.
 * It ensures the authentication state is initialised when the app loads and exposes the user's
 * authentication status, user data, and logout functionality.
 *
 * @returns {{
 *   isAuthenticated: boolean;
 *   hasInitialised: boolean;
 *   user: import('../types/auth').User | null;
 *   logout: () => Promise<void>;
 * }} An object containing:
 * - `isAuthenticated`: A boolean that is true if the user is currently authenticated.
 * - `hasInitialised`: A boolean that is true once the initial auth state has been loaded from storage.
 * - `user`: The current user object if authenticated, otherwise null.
 * - `logout`: An async function to log the user out and clear their session.
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
