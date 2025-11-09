// Loading Screen Component
// =======================
// This component displays a loading screen with a spinning animation
// and loading message. Used during initial app startup and route transitions.

import React from 'react';                                       // Import React for JSX

/**
 * Loading Screen Component.
 *
 * Displays a centered loading animation with the app startup message.
 * Features:
 * - Full viewport height coverage
 * - Centered content with flexbox
 * - Spinning circle animation using Tailwind
 * - German loading message for EmmaTresor application
 * - Consistent branding with brand color accent
 *
 * @returns {JSX.Element} Loading screen component
 */
const LoadingScreen: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
    {/* Container for loading content */}
    <div className="flex flex-col items-center gap-4">
      {/*
        Loading spinner animation:
        - h-12 w-12: 48px diameter circle
        - animate-spin: Tailwind rotation animation
        - rounded-full: Perfect circle shape
        - border-4: 4px thick border
        - border-slate-200: Light gray background circle
        - border-t-brand-400: Brand color top border that rotates
      */}
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand-400" />

      {/*
        Loading message text:
        - text-sm: Small font size
        - font-medium: Medium font weight
        - text-slate-500: Muted gray color
        - German: "EmmaTresor startet …" = "EmmaTresor is starting ..."
      */}
      <p className="text-sm font-medium text-slate-500">EmmaTresor startet …</p>
    </div>
  </div>
);

export default LoadingScreen;                                  // Export as default
