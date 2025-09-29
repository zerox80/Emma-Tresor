import { useEffect } from 'react';

import { useAuthStore } from '../store/authStore';

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
