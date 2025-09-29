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
