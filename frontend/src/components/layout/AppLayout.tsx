// Import React hooks for component lifecycle and state management
import React, { useEffect, useMemo, useState } from 'react';
// Import routing components for navigation and nested routes
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

// Import authentication hook for user data and logout functionality
import { useAuth } from '../../hooks/useAuth';

// CSS class generator for navigation links based on active state
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    // Base classes for all navigation links
    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
    // Conditional classes: active state vs hover state
    isActive ? 'bg-brand-100 text-brand-700' : 'text-slate-600 hover:text-brand-600 hover:bg-brand-50',
  ].join(' ');

// Main application layout component with navigation and page structure
const AppLayout: React.FC = () => {
  // Get current location for route-based page metadata
  const location = useLocation();
  // Get user data and logout function from authentication context
  const { user, logout } = useAuth();
  // State for mobile navigation menu visibility
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Effect to close mobile navigation when route changes
  useEffect(() => {
    // If mobile nav is not open, do nothing
    if (!mobileNavOpen) {
      return;
    }
    // Close mobile navigation when user navigates to a new route
    setMobileNavOpen(false);
  }, [location.pathname]); // Dependency: re-run when pathname changes

  // Memoized page metadata based on current route
  const pageMeta = useMemo(() => {
    // Check if current route is lists page
    if (location.pathname.startsWith('/lists')) {
      return {
        title: 'Listen',
        subtitle:
          'Kuratierte Sammlungen für Umzüge, Projekte und schnelle Übergaben – alles nur einen Klick entfernt.',
      };
    }
    // Check if current route is items page
    if (location.pathname.startsWith('/items')) {
      return {
        title: 'Inventar',
        subtitle:
          'Durchsuche und filtere deine Gegenstände in Echtzeit – EmmaTresor zeigt dir in Sekunden, wo alles liegt.',
      };
    }
    // Check if current route is settings page
    if (location.pathname.startsWith('/settings')) {
      return {
        title: 'Einstellungen',
        subtitle:
          'Passe Tags und Standorte flexibel an – EmmaTresor bleibt dabei immer sicher, schnell und übersichtlich.',
      };
    }
    // Default case: dashboard/home page
    return {
      title: 'Dashboard',
      subtitle:
        'Willkommen zurück! Hier findest du alle Kennzahlen, schnelle Aktionen und einen klaren Startpunkt mit EmmaTresor.',
    };
  }, [location.pathname]); // Dependency: re-compute when pathname changes

  // Async function to handle user logout
  const handleLogout = async () => {
    // Call logout function from auth context
    await logout();
  };

  // Render the full application layout
  return (
    // Main container with background and overflow settings
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Decorative background gradient element */}
      <div className="pointer-events-none absolute inset-x-0 top-[-12rem] flex justify-center blur-3xl">
        <div className="aspect-[3/2] w-[60rem] rounded-full bg-gradient-to-br from-brand-200/60 via-sky-100/50 to-white opacity-70" />
      </div>
      {/* Header section with navigation */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        {/* Header content container */}
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo and brand name */}
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold text-brand-600">
            {/* Logo icon */}
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700 shadow-sm">E</span>
            {/* Brand text */}
            EmmaTresor Inventar
          </Link>
          {/* Desktop navigation - hidden on mobile */}
          <nav className="hidden gap-2 md:flex">
            {/* Dashboard navigation link */}
            <NavLink to="/" className={navLinkClass} end>
              Übersicht
            </NavLink>
            {/* Inventory navigation link */}
            <NavLink to="/items" className={navLinkClass}>
              Inventar
            </NavLink>
            {/* Lists navigation link */}
            <NavLink to="/lists" className={navLinkClass}>
              Listen
            </NavLink>
            {/* Settings navigation link */}
            <NavLink to="/settings" className={navLinkClass}>
              Einstellungen
            </NavLink>
          </nav>
          {/* Mobile navigation toggle button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand-200 hover:text-brand-600 md:hidden"
            aria-expanded={mobileNavOpen}
            aria-label="Navigation öffnen"
            // Toggle mobile navigation state
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            Navigation
          </button>
          {/* User info and logout section */}
          <div className="flex items-center gap-4">
            {/* User information - hidden on mobile */}
            <div className="hidden text-right text-sm md:block">
              {/* Display username or fallback to 'Unbekannt' */}
              <p className="font-semibold text-slate-900">{user?.username ?? 'Unbekannt'}</p>
              {/* Display user email */}
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            {/* Logout button */}
            <button
              type="button"
              // Call logout handler on click
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-red-300 hover:text-red-500"
            >
              Abmelden
            </button>
          </div>
        </div>
        {/* Mobile navigation menu - only shown when mobileNavOpen is true */}
        {mobileNavOpen && (
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 pb-4 md:hidden">
            {/* Mobile Dashboard link */}
            <NavLink to="/" className={navLinkClass} end onClick={() => setMobileNavOpen(false)}>
              Übersicht
            </NavLink>
            {/* Mobile Inventory link */}
            <NavLink to="/items" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>
              Inventar
            </NavLink>
            {/* Mobile Lists link */}
            <NavLink to="/lists" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>
              Listen
            </NavLink>
            {/* Mobile Settings link */}
            <NavLink to="/settings" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>
              Einstellungen
            </NavLink>
          </div>
        )}
      </header>
      {/* Main content area */}
      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        {/* Page header with title and description */}
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-xl">
          {/* Dynamic page title */}
          <h1 className="text-3xl font-bold text-slate-900">{pageMeta.title}</h1>
          {/* Dynamic page subtitle/description */}
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{pageMeta.subtitle}</p>
        </div>
        {/* Content container for nested routes */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 backdrop-blur">
          {/* Render nested route content here */}
          <Outlet />
        </div>
      </main>
    </div>
  );
};

// Export the AppLayout component as default
export default AppLayout;
