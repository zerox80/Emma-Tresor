// Public Route Component
// ======================
// This route guard component protects public routes (login, register) from authenticated users.
// Authenticated users are redirected to the application.

import React from 'react';                                  // React core library
import { Navigate, useLocation, type Location } from 'react-router-dom'; // React Router navigation utilities

import LoadingScreen from '../components/common/LoadingScreen'; // Loading indicator component
import { useAuth } from '../hooks/useAuth';                 // Authentication state hook

/**
 * Props interface for PublicRoute component.
 */
interface PublicRouteProps {
  /** Child components to render if user is not authenticated */
  children: React.ReactNode;
}

/**
 * Public Route Guard Component
 *
 * Wraps public routes (login, register) that should only be accessible
 * to unauthenticated users. Performs the following checks:
 * 1. Shows loading screen while authentication state is initializing
 * 2. Redirects to app if user is already authenticated
 * 3. Renders child components if user is not authenticated
 *
 * If the user was previously trying to access a protected route,
 * they will be redirected there after authentication.
 *
 * @param {PublicRouteProps} props - Component props
 * @returns {JSX.Element} Loading screen, redirect, or public content
 *
 * @example
 * ```tsx
 * <Route
 *   path="/login"
 *   element={
 *     <PublicRoute>
 *       <LoginPage />
 *     </PublicRoute>
 *   }
 * />
 * ```
 */
const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  // Get authentication state from auth hook
  const { isAuthenticated, hasInitialised } = useAuth();
  const location = useLocation();

  // Show loading screen while auth state is being initialized
  if (!hasInitialised) {
    return <LoadingScreen />;
  }

  // Redirect authenticated users away from public routes
  // If they were trying to access a specific page, redirect there
  // Otherwise, redirect to dashboard
  if (isAuthenticated) {
    const redirectPath = (location.state as { from?: Location })?.from?.pathname ?? '/';
    return <Navigate to={redirectPath} replace />;
  }

  // User is not authenticated - render public content
  return <>{children}</>;
};

export default PublicRoute;
