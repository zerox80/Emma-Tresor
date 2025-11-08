import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Props for the AuthLayout component.
 */
interface AuthLayoutProps {
  /** The title to be displayed at the top of the authentication form card (e.g., "Anmelden"). */
  title: string;
  /** The child elements to be rendered inside the form card, typically the form fields and buttons. */
  children: React.ReactNode;
}

/**
 * A layout component specifically designed for authentication pages like login and registration.
 * It provides a consistent two-column structure with a marketing/welcome message on one side
 * and a card for the authentication form content on the other.
 *
 * @param {AuthLayoutProps} props The props for the component.
 * @returns {JSX.Element} The rendered authentication page layout.
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({ title, children }) => (
  <div className="relative min-h-screen overflow-hidden bg-slate-50 px-4 py-12 text-slate-900">
    <div className="pointer-events-none absolute inset-x-0 top-[-20rem] flex justify-center blur-3xl">
      <div className="aspect-[3/2] w-[70rem] rounded-full bg-gradient-to-br from-brand-100 via-sky-100 to-white opacity-70" />
    </div>
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-12 lg:flex-row">
      <div className="max-w-xl text-center lg:text-left">
        <span className="inline-flex items-center rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600 shadow-sm">
          EmmaTresor Inventar
        </span>
        <h1 className="mt-6 text-4xl font-bold text-slate-900 sm:text-5xl">
          Inventarverwaltung in Sekunden – sicher, smart, deutsch.
        </h1>
        <p className="mt-4 text-base text-slate-600 sm:text-lg">
          EmmaTresor begleitet dich vom ersten Gegenstand bis zum vollständigen Überblick. Erstelle Kategorien, Standorte und Listen in einer modernen Oberfläche, die sich wie von selbst erklärt.
        </p>
        <div className="mt-6 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Neu hier?</span>{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-500">
            Jetzt kostenlos starten
          </Link>
        </div>
      </div>
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/60 backdrop-blur">
        <div className="absolute inset-x-12 -top-6 h-12 rounded-full bg-gradient-to-r from-brand-200 via-sky-200 to-purple-200 blur-2xl" />
        <div className="relative">
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            Deine Daten werden Ende-zu-Ende geschützt. EmmaTresor setzt auf Argon2ID, zeitlich begrenzte Tokens und verschlüsselte Verbindungen.
          </p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  </div>
);

export default AuthLayout;
