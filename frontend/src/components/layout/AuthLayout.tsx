// Import React library for component creation
import React from 'react';
// Import Link component for client-side navigation
import { Link } from 'react-router-dom';

// Define interface for AuthLayout component props
interface AuthLayoutProps {
  // Title prop for the authentication form heading
  title: string;
  // Children prop to render nested components inside the layout
  children: React.ReactNode;
}

// Authentication layout component for login/register pages
const AuthLayout: React.FC<AuthLayoutProps> = ({ title, children }) => (
  // Main container with full screen height, background color and text styling
  <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-12 text-slate-900">
    {/* Decorative background gradient element */}
    <div className="pointer-events-none absolute inset-x-0 top-[-20rem] flex justify-center blur-3xl">
      <div className="aspect-[3/2] w-[70rem] rounded-full bg-gradient-to-br from-brand-100 via-sky-100 to-white opacity-70" />
    </div>
    {/* Main content container with responsive layout */}
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-12 lg:flex-row">
      {/* Left side marketing content */}
      <div className="max-w-xl text-center lg:text-left">
        {/* Brand badge */}
        <span className="inline-flex items-center rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600 shadow-sm">
          EmmaTresor Inventar
        </span>
        {/* Main marketing headline */}
        <h1 className="mt-6 text-4xl font-bold text-slate-900 sm:text-5xl">
          Inventarverwaltung in Sekunden – sicher, smart, deutsch.
        </h1>
        {/* Marketing description text */}
        <p className="mt-4 text-base text-slate-600 sm:text-lg">
          EmmaTresor begleitet dich vom ersten Gegenstand bis zum vollständigen Überblick. Erstelle Kategorien, Standorte und Listen in einer modernen Oberfläche, die sich wie von selbst erklärt.
        </p>
        {/* Call-to-action for new users */}
        <div className="mt-6 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Neu hier?</span>{' '}
          {/* Link to registration page */}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-500">
            Jetzt kostenlos starten
          </Link>
        </div>
      </div>
      {/* Right side authentication form container */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/60 backdrop-blur">
        {/* Decorative gradient above the form */}
        <div className="absolute inset-x-12 -top-6 h-12 rounded-full bg-gradient-to-r from-brand-200 via-sky-200 to-purple-200 blur-2xl" />
        {/* Form content wrapper */}
        <div className="relative">
          {/* Dynamic form title */}
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {/* Security notice text */}
          <p className="mt-2 text-sm text-slate-600">
            Deine Daten werden Ende-zu-Ende geschützt. EmmaTresor setzt auf Argon2ID, zeitlich begrenzte Tokens und verschlüsselte Verbindungen.
          </p>
          {/* Container for nested form components */}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  </div>
);

// Export the AuthLayout component as default
export default AuthLayout;
