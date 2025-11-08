import React from 'react';
import { Navigate, useLocation, type Location } from 'react-router-dom';

import LoadingScreen from '../components/common/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

/**
 * Props for the PublicRoute component.
 */
interface PublicRouteProps {
  /** The child components (routes or elements) that should only be accessible to unauthenticated users. */
  children: React.ReactNode;
}

/**
 * A route guard component that ensures only unauthenticated users can access its children.
 * If the authentication state has not yet been initialised, it displays a loading screen.
 * If the user is authenticated after initialisation, they are redirected to the home page
 * or to the path they were trying to access before being redirected to a public route (e.g., login).
 *
 * @param {PublicRouteProps} props The props for the component.
 * @returns {JSX.Element} The rendered children if unauthenticated, a loading screen, or a redirect to the home page.
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
