import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute from './routes/PublicRoute';
import DashboardPage from './pages/DashboardPage';
import ItemsPage from './pages/ItemsPage';
import ScanItemPage from './pages/ScanItemPage';
import ListsPage from './pages/ListsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';

/**
 * The root component of the EmmaTresor application.
 * It defines the main routing structure using `react-router-dom`,
 * organizing the application into protected routes (requiring authentication)
 * and public routes (accessible without authentication).
 * It integrates various layout components (`AppLayout`, `AuthLayout`)
 * and page components to form the complete user interface.
 *
 * @returns {JSX.Element} The rendered application with its defined routes.
 */
const App: React.FC = () => (
  <Routes>
    <Route
      element={(
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      )}
    >
      <Route index element={<DashboardPage />} />
      <Route path="items" element={<ItemsPage />} />
      <Route path="scan/:assetTag" element={<ScanItemPage />} />
      <Route path="lists" element={<ListsPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
    <Route
      path="/login"
      element={(
        <PublicRoute>
          <AuthLayout title="Anmelden">
            <LoginPage />
          </AuthLayout>
        </PublicRoute>
      )}
    />
    <Route
      path="/register"
      element={(
        <PublicRoute>
          <AuthLayout title="Registrieren">
            <RegisterPage />
          </AuthLayout>
        </PublicRoute>
      )}
    />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default App;
