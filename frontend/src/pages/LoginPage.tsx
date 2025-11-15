// Login Page Component
// ====================
// This page provides the login interface for users to authenticate with the application.
// It includes form validation, error handling, and automatic redirection after successful login.

import React, { useState } from 'react';                    // React core library
import { zodResolver } from '@hookform/resolvers/zod';      // Zod schema resolver for React Hook Form
import { AxiosError } from 'axios';                         // Axios error type for type-safe error handling
import { useForm } from 'react-hook-form';                  // Form management with validation
import { Link, useLocation, useNavigate } from 'react-router-dom'; // Routing utilities
import { z } from 'zod';                                    // Schema validation library

import Button from '../components/common/Button';           // Reusable button component
import { useAuthStore } from '../store/authStore';          // Authentication state management

/**
 * Zod validation schema for login form.
 *
 * Defines validation rules for all login form fields:
 * - Email: Required, must be valid email format
 * - Password: Required, minimum 8 characters
 * - RememberMe: Boolean checkbox for session persistence
 */
const loginSchema = z.object({
  email: z.string().min(1, 'E-Mail-Adresse erforderlich').email('Bitte eine gültige E-Mail-Adresse eingeben'),
  password: z.string().min(8, 'Mindestens 8 Zeichen erforderlich'),
  rememberMe: z.boolean(),
});

/** Type inference from Zod schema for type-safe form data */
type LoginSchema = z.infer<typeof loginSchema>;

/**
 * Login Page Component
 *
 * Renders a login form with email/password authentication.
 *
 * Features:
 * - Form validation with Zod schema
 * - Real-time error display
 * - "Remember me" functionality for persistent sessions
 * - Automatic redirect to intended page after login
 * - Link to registration page for new users
 * - Loading state during authentication
 * - User-friendly error messages in German
 *
 * @returns {JSX.Element} The login page component
 */
const LoginPage: React.FC = () => {
  // Navigation hooks for redirecting after login
  const navigate = useNavigate();
  const location = useLocation();

  // Get login function from auth store
  const login = useAuthStore((state) => state.login);

  // Local state for form-level errors
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize React Hook Form with Zod validation
  const {
    register,                   // Function to register input fields
    handleSubmit,               // Form submission handler
    formState: { errors, isSubmitting }, // Form state for validation errors and loading
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),  // Use Zod schema for validation
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  /**
   * Handle form submission.
   *
   * Attempts to authenticate the user with provided credentials.
   * On success, redirects to the originally requested page or dashboard.
   * On failure, displays an error message.
   *
   * @param {LoginSchema} values - Validated form data
   */
  const onSubmit = async (values: LoginSchema) => {
    setFormError(null);  // Clear any previous errors
    try {
      // Attempt login with credentials
      await login(values);

      // Get the page user was trying to access before being redirected to login
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/';

      // Navigate to intended page, replacing history entry to prevent back button issues
      navigate(redirectTo, { replace: true });
    } catch (error) {
      // Extract error message from API response
      const axiosError = error as AxiosError<{ detail?: string }>;
      const message =
        axiosError.response?.data?.detail ??
        'Die Anmeldung ist fehlgeschlagen. Bitte überprüfe E-Mail und Passwort oder versuche es in wenigen Sekunden erneut.';

      // Display error message to user
      setFormError(message);
    }
  };

  return (
    <form className="space-y-6 text-slate-700" onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Form-level error message display */}
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
      )}

      {/* Email input field */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-800">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"                    // Enable browser autofill for email
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          placeholder="z. B. max@beispiel.de"
          {...register('email')}                  // Register field with React Hook Form
        />
        {/* Field-level validation error */}
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
      </div>

      {/* Password input field */}
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-800">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"         // Enable browser autofill for password
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          placeholder="Dein EmmaTresor-Passwort"
          {...register('password')}               // Register field with React Hook Form
        />
        {/* Field-level validation error */}
        {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        {/* Password security hint */}
        <p className="text-xs text-slate-500">Mindestens 8 Zeichen – für optimale Sicherheit empfehlen wir 12+ Zeichen.</p>
      </div>

      {/* Remember me checkbox and registration link */}
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-slate-300 bg-white text-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
            {...register('rememberMe')}           // Register checkbox with React Hook Form
          />
          Eingeloggt bleiben (nur auf vertrauenswürdigen Geräten nutzen)
        </label>
        {/* Link to registration page */}
        <Link to="/register" className="text-xs font-medium text-brand-500 hover:text-brand-600">
          Noch kein Konto? Jetzt registrieren
        </Link>
      </div>

      {/* Submit button with loading state */}
      <Button type="submit" variant="primary" size="md" loading={isSubmitting} className="w-full">
        Anmelden
      </Button>

      {/* Help text for login issues */}
      <p className="text-center text-xs text-slate-500">Probleme bei der Anmeldung? Kontaktiere dein EmmaTresor-Team.</p>
    </form>
  );
};

export default LoginPage;
