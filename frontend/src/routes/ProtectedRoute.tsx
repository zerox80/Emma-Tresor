import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import LoadingScreen from '../components/common/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

/**
 * Props for the ProtectedRoute component.
 */
interface ProtectedRouteProps {
  /** The child components (routes or elements) that should only be accessible to authenticated users. */
  children: React.ReactNode;
}

/**
 * A route guard component that ensures only authenticated users can access its children.
 * If the authentication state has not yet been initialised, it displays a loading screen.
 * If the user is not authenticated after initialisation, they are redirected to the login page,
 * with their original intended destination stored in the location state for post-login redirection.
 *
 * @param {ProtectedRouteProps} props The props for the component.
 * @returns {JSX.Element} The rendered children if authenticated, a loading screen, or a redirect to the login page.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, hasInitialised } = useAuth();
  const location = useLocation();

  if (!hasInitialised) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
