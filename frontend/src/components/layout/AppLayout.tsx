import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
    isActive ? 'bg-brand-100 text-brand-700' : 'text-slate-600 hover:text-brand-600 hover:bg-brand-50',
  ].join(' ');

/**
 * The main layout for the application, including the header, navigation, and content area.
 *
 * @returns {JSX.Element} The rendered application layout.
 */
const AppLayout: React.FC = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    setMobileNavOpen(false);
  }, [location.pathname]);

  const pageMeta = useMemo(() => {
    if (location.pathname.startsWith('/lists')) {
      return {
        title: 'Listen',
        subtitle:
          'Kuratierte Sammlungen für Umzüge, Projekte und schnelle Übergaben – alles nur einen Klick entfernt.',
      };
    }
    if (location.pathname.startsWith('/items')) {
      return {
        title: 'Inventar',
        subtitle:
          'Durchsuche und filtere deine Gegenstände in Echtzeit – EmmaTresor zeigt dir in Sekunden, wo alles liegt.',
      };
    }
    if (location.pathname.startsWith('/settings')) {
      return {
        title: 'Einstellungen',
        subtitle:
          'Passe Tags und Standorte flexibel an – EmmaTresor bleibt dabei immer sicher, schnell und übersichtlich.',
      };
    }
    return {
      title: 'Dashboard',
      subtitle:
        'Willkommen zurück! Hier findest du alle Kennzahlen, schnelle Aktionen und einen klaren Startpunkt mit EmmaTresor.',
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-[-12rem] flex justify-center blur-3xl">
        <div className="aspect-[3/2] w-[60rem] rounded-full bg-gradient-to-br from-brand-200/60 via-sky-100/50 to-white opacity-70" />
      </div>
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold text-brand-600">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-100 text-brand-700 shadow-sm">E</span>
            EmmaTresor Inventar
          </Link>
          <nav className="hidden gap-2 md:flex">
            <NavLink to="/" className={navLinkClass} end>
              Übersicht
            </NavLink>
            <NavLink to="/items" className={navLinkClass}>
              Inventar
            </NavLink>
            <NavLink to="/lists" className={navLinkClass}>
              Listen
            </NavLink>
            <NavLink to="/settings" className={navLinkClass}>
              Einstellungen
            </NavLink>
          </nav>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-brand-200 hover:text-brand-600 md:hidden"
            aria-expanded={mobileNavOpen}
            aria-label="Navigation öffnen"
            onClick={() => setMobileNavOpen((prev) => !prev)}
          >
            Navigation
          </button>
          <div className="flex items-center gap-4">
            <div className="hidden text-right text-sm md:block">
              <p className="font-semibold text-slate-900">{user?.username ?? 'Unbekannt'}</p>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:border-red-300 hover:text-red-500"
            >
              Abmelden
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-6 pb-4 md:hidden">
            <NavLink to="/" className={navLinkClass} end onClick={() => setMobileNavOpen(false)}>
              Übersicht
            </NavLink>
            <NavLink to="/items" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>
              Inventar
            </NavLink>
            <NavLink to="/lists" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>
              Listen
            </NavLink>
            <NavLink to="/settings" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>
              Einstellungen
            </NavLink>
          </div>
        )}
      </header>
      <main className="relative z-10 mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/60 backdrop-blur-xl">
          <h1 className="text-3xl font-bold text-slate-900">{pageMeta.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">{pageMeta.subtitle}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70 backdrop-blur">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
