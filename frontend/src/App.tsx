import React from 'react';                                 // Import React library for JSX
import { Navigate, Route, Routes } from 'react-router-dom'; // Import routing components

// Import layout components
import AppLayout from './components/layout/AppLayout';     // Main application layout
import AuthLayout from './components/layout/AuthLayout';   // Authentication page layout

// Import route protection components
import ProtectedRoute from './routes/ProtectedRoute';       // Route guard for authenticated users
import PublicRoute from './routes/PublicRoute';             // Route guard for unauthenticated users

// Import page components
import DashboardPage from './pages/DashboardPage';          // Main dashboard page
import ItemsPage from './pages/ItemsPage';                  // Inventory management page
import ScanItemPage from './pages/ScanItemPage';            // QR code scanning page
import ListsPage from './pages/ListsPage';                  // Custom lists management page
import LoginPage from './pages/LoginPage';                  // User login page
import RegisterPage from './pages/RegisterPage';            // User registration page
import SettingsPage from './pages/SettingsPage';            // Application settings page

// Main App component defining application routes
const App: React.FC = () => (
  <Routes>
    {/* Protected routes requiring authentication */}
    <Route
      element={(
        <ProtectedRoute>                                   // Wrap with authentication guard
          <AppLayout />                                     // Apply main layout
        </ProtectedRoute>
      )}
    >
      <Route index element={<DashboardPage />} />          {/* Default route - dashboard */}
      <Route path="items" element={<ItemsPage />} />        {/* Inventory management */}
      <Route path="scan/:assetTag" element={<ScanItemPage />} /> {/* QR scan with asset tag parameter */}
      <Route path="lists" element={<ListsPage />} />        {/* Custom lists */}
      <Route path="settings" element={<SettingsPage />} />  {/* Settings management */}
    </Route>

    {/* Public login route */}
    <Route
      path="/login"
      element={(
        <PublicRoute>                                      // Only accessible when not authenticated
          <AuthLayout title="Anmelden">                    {/* German: "Login" */}
            <LoginPage />                                  {/* Login form component */}
          </AuthLayout>
        </PublicRoute>
      )}
    />

    {/* Public registration route */}
    <Route
      path="/register"
      element={(
        <PublicRoute>                                      // Only accessible when not authenticated
          <AuthLayout title="Registrieren">                {/* German: "Register" */}
            <RegisterPage />                               {/* Registration form component */}
          </AuthLayout>
        </PublicRoute>
      )}
    />

    {/* Catch-all route for undefined paths */}
    <Route path="*" element={<Navigate to="/" replace />} /> {/* Redirect to dashboard */}
  </Routes>
);

export default App;                                        // Export App component as default
