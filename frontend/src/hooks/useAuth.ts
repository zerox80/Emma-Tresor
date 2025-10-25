import { useEffect } from 'react';

import { useAuthStore } from '../store/authStore';

/**
 * A hook that provides authentication state and actions.
 * It initialises the auth store on mount and returns the current user,
 * authentication status, and a logout function.
 *
 * @returns {{
 *   isAuthenticated: boolean;
 *   hasInitialised: boolean;
 *   user: import('../types/auth').User | null;
 *   logout: () => Promise<void>;
 * }} An object containing the authentication state and actions.
 */
export const useAuth = () => {
  const initialise = useAuthStore((state) => state.initialise);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasInitialised = useAuthStore((state) => state.hasInitialised);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

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
