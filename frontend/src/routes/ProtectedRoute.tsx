import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import LoadingScreen from '../components/common/LoadingScreen';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  
  children: React.ReactNode;
}

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
