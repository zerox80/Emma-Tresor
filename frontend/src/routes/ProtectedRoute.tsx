import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import LoadingScreen from '../components/common/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  /** The content to render if the user is authenticated. */
  children: React.ReactNode;
}

/**
 * A route that only allows access to authenticated users.
 * If the user is not authenticated, they are redirected to the login page.
 *
 * @param {ProtectedRouteProps} props The props for the component.
 * @returns {JSX.Element} The rendered route.
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
