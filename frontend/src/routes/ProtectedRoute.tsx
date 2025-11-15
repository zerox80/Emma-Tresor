// Protected Route Component
// =========================
// This route guard component protects routes that require authentication.
// Unauthenticated users are redirected to the login page.

import React from 'react';                                  // React core library
import { Navigate, useLocation } from 'react-router-dom';   // React Router navigation utilities

import LoadingScreen from '../components/common/LoadingScreen'; // Loading indicator component
import { useAuth } from '../hooks/useAuth';                 // Authentication state hook

/**
 * Props interface for ProtectedRoute component.
 */
interface ProtectedRouteProps {
  /** Child components to render if user is authenticated */
  children: React.ReactNode;
}

/**
 * Protected Route Guard Component
 *
 * Wraps routes that require authentication. Performs the following checks:
 * 1. Shows loading screen while authentication state is initializing
 * 2. Redirects to login if user is not authenticated
 * 3. Renders child components if user is authenticated
 *
 * The current location is passed to the login page so users can be
 * redirected back after successful authentication.
 *
 * @param {ProtectedRouteProps} props - Component props
 * @returns {JSX.Element} Loading screen, redirect, or protected content
 *
 * @example
 * ```tsx
 * <Route
 *   path="/dashboard"
 *   element={
 *     <ProtectedRoute>
 *       <DashboardPage />
 *     </ProtectedRoute>
 *   }
 * />
 * ```
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  // Get authentication state from auth hook
  const { isAuthenticated, hasInitialised } = useAuth();
  const location = useLocation();

  // Show loading screen while auth state is being initialized
  if (!hasInitialised) {
    return <LoadingScreen />;
  }

  // Redirect unauthenticated users to login page
  // Pass current location so they can be redirected back after login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated - render protected content
  return <>{children}</>;
};

export default ProtectedRoute;
