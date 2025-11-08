import React from 'react';
import { Navigate, useLocation, type Location } from 'react-router-dom';

import LoadingScreen from '../components/common/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * A route that is only accessible to unauthenticated users.
 * If the user is authenticated, they are redirected to the home page.
 *
 * @param {PublicRouteProps} props The props for the component.
 * @returns {JSX.Element} The rendered route.
 */
const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, hasInitialised } = useAuth();
  const location = useLocation();

  if (!hasInitialised) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    const redirectPath = (location.state as { from?: Location })?.from?.pathname ?? '/';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default PublicRoute;
