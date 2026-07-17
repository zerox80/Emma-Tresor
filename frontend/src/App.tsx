import React, { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom"; // Import routing components

// Import layout components
import AppLayout from "./components/layout/AppLayout"; // Main application layout
import AuthLayout from "./components/layout/AuthLayout"; // Authentication page layout

// Import route protection components
import ProtectedRoute from "./routes/ProtectedRoute"; // Route guard for authenticated users
import PublicRoute from "./routes/PublicRoute"; // Route guard for unauthenticated users
import apiClient from "./api/client";
import LoadingScreen from "./components/common/LoadingScreen";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ItemsPage = lazy(() => import("./pages/ItemsPage"));
const ScanItemPage = lazy(() => import("./pages/ScanItemPage"));
const ListsPage = lazy(() => import("./pages/ListsPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

// Main App component defining application routes
const App: React.FC = () => {
  const [registrationEnabled, setRegistrationEnabled] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ registration_enabled: boolean }>("/config/")
      .then(({ data }) => {
        if (active) setRegistrationEnabled(data.registration_enabled === true);
      })
      .catch(() => {
        if (active) setRegistrationEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
    {/* Protected routes requiring authentication */}
    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<DashboardPage />} />{" "}
      {/* Default route - dashboard */}
      <Route path="items" element={<ItemsPage />} />{" "}
      {/* Inventory management */}
      <Route path="scan/:assetTag" element={<ScanItemPage />} />{" "}
      {/* QR scan with asset tag parameter */}
      <Route path="lists" element={<ListsPage />} /> {/* Custom lists */}
      <Route path="settings" element={<SettingsPage />} />{" "}
      {/* Settings management */}
    </Route>
    {/* Public login route */}
    <Route
      path="/login"
      element={
        <PublicRoute>
          <AuthLayout
            title="Anmelden"
            registrationEnabled={registrationEnabled === true}
          >
            {" "}
            {/* German: "Login" */}
            <LoginPage registrationEnabled={registrationEnabled === true} />
          </AuthLayout>
        </PublicRoute>
      }
    />
    {/* Public registration route */}
    <Route
      path="/register"
      element={registrationEnabled === null ? (
        <LoadingScreen />
      ) : registrationEnabled ? (
        <PublicRoute>
          <AuthLayout title="Registrieren" registrationEnabled={false}>
            {" "}
            {/* German: "Register" */}
            <RegisterPage /> {/* Registration form component */}
          </AuthLayout>
        </PublicRoute>
      ) : (
        <Navigate to="/login" replace />
      )}
    />
    {/* Catch-all route for undefined paths */}
    <Route path="*" element={<Navigate to="/" replace />} />{" "}
    {/* Redirect to dashboard */}
      </Routes>
    </Suspense>
  );
};

export default App; // Export App component as default
