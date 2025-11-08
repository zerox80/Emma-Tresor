import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import Button from '../components/common/Button';
import { useAuthStore } from '../store/authStore';

/**
 * Defines the validation schema for the login form using Zod.
 * @property {string} email - The user's email address, required and must be a valid email format.
 * @property {string} password - The user's password, required and must be at least 8 characters long.
 * @property {boolean} rememberMe - A boolean indicating whether to keep the user logged in.
 */
const loginSchema = z.object({
  email: z.string().min(1, 'E-Mail-Adresse erforderlich').email('Bitte eine gültige E-Mail-Adresse eingeben'),
  password: z.string().min(8, 'Mindestens 8 Zeichen erforderlich'),
  rememberMe: z.boolean(),
});

/**
 * Represents the inferred type from the `loginSchema`.
 * This type is used for form state management with `react-hook-form`.
 */
type LoginSchema = z.infer<typeof loginSchema>;

/**
 * The login page component, allowing users to sign in to their account.
 * It provides a form for email and password input, handles form validation
 * using `react-hook-form` and `zod`, and interacts with the authentication store
 * to perform the login operation. Upon successful login, it redirects the user
 * to their intended destination or the dashboard.
 *
 * @returns {JSX.Element} The rendered login page.
 */
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  /**
   * Handles the submission of the login form.
   * It attempts to authenticate the user via the `login` action from the auth store.
   * On success, it redirects the user. On failure, it displays an error message.
   *
   * @param {LoginSchema} values - The validated form values (email, password, rememberMe).
   * @returns {Promise<void>} A promise that resolves when the submission process is complete.
   */
  const onSubmit = async (values: LoginSchema) => {
    setFormError(null);
    try {
      await login(values);
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? '/';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      const message =
        axiosError.response?.data?.detail ??
        'Die Anmeldung ist fehlgeschlagen. Bitte überprüfe E-Mail und Passwort oder versuche es in wenigen Sekunden erneut.';
      setFormError(message);
    }
  };

  return (
    <form className="space-y-6 text-slate-700" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
      )}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-800">
          E-Mail-Adresse
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          placeholder="z. B. max@beispiel.de"
          {...register('email')}
        />
        {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-800">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          placeholder="Dein EmmaTresor-Passwort"
          {...register('password')}
        />
        {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        <p className="text-xs text-slate-500">Mindestens 8 Zeichen – für optimale Sicherheit empfehlen wir 12+ Zeichen.</p>
      </div>
      <div className="flex items-center justify-between">
        <label className="inline-flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border border-slate-300 bg-white text-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
            {...register('rememberMe')}
          />
          Eingeloggt bleiben (nur auf vertrauenswürdigen Geräten nutzen)
        </label>
        <Link to="/register" className="text-xs font-medium text-brand-500 hover:text-brand-600">
          Noch kein Konto? Jetzt registrieren
        </Link>
      </div>
      <Button type="submit" variant="primary" size="md" loading={isSubmitting} className="w-full">
        Anmelden
      </Button>
      <p className="text-center text-xs text-slate-500">Probleme bei der Anmeldung? Kontaktiere dein EmmaTresor-Team.</p>
    </form>
  );
};

export default LoginPage;
