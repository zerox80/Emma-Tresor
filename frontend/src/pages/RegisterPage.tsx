import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import Button from '../components/common/Button';
import { useAuthStore } from '../store/authStore';

const passwordSchema = z
  .string()
  .min(12, 'Mindestens 12 Zeichen erforderlich')
  .regex(/[A-Z]/, 'Mindestens ein Großbuchstabe erforderlich')
  .regex(/[a-z]/, 'Mindestens ein Kleinbuchstabe erforderlich')
  .regex(/\d/, 'Mindestens eine Ziffer erforderlich')
  .regex(/[^A-Za-z0-9]/, 'Mindestens ein Sonderzeichen erforderlich');

const registerSchema = z
  .object({
    username: z.string().min(3, 'Nutzername muss mindestens 3 Zeichen lang sein'),
    email: z.string().email('Bitte eine gültige E-Mail-Adresse eingeben'),
    password: passwordSchema,
    password_confirm: z.string(),
    acceptTerms: z.boolean().refine(Boolean, 'Bitte bestätige die Nutzungsbedingungen'),
  })
  .refine((data) => data.password === data.password_confirm, {
    path: ['password_confirm'],
    message: 'Die Passwörter stimmen nicht überein',
  });

type RegisterSchema = z.infer<typeof registerSchema>;

/**
 * The registration page, allowing new users to create an account.
 *
 * @returns {JSX.Element} The rendered registration page.
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const registerUser = useAuthStore((state) => state.register);
  const login = useAuthStore((state) => state.login);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterSchema>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      password_confirm: '',
      acceptTerms: false,
    },
  });

  const onSubmit = async (values: RegisterSchema) => {
    setFormError(null);

    const username = values.username.trim();
    const email = values.email.trim().toLowerCase();
    const password = values.password;
    const passwordConfirm = values.password_confirm;

    setValue('username', username);
    setValue('email', email);

    if (!username) {
      setError('username', { type: 'manual', message: 'Bitte gib einen Nutzernamen ein.' });
      setFormError('Bitte gib einen gültigen Nutzernamen ein.');
      return;
    }

    if (!email) {
      setError('email', { type: 'manual', message: 'Bitte gib eine gültige E-Mail-Adresse ein.' });
      setFormError('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    if (!password) {
      setError('password', { type: 'manual', message: 'Bitte gib ein Passwort ein.' });
      setFormError('Bitte gib ein starkes Passwort ein.');
      return;
    }

    if (!passwordConfirm) {
      setError('password_confirm', { type: 'manual', message: 'Bitte bestätige dein Passwort.' });
      setFormError('Bitte bestätige dein Passwort.');
      return;
    }

    try {
      await registerUser({
        username,
        email,
        password,
        password_confirm: passwordConfirm,
      });
      await login({ email, password, rememberMe: false });
      navigate('/', { replace: true });
    } catch (error) {
      type RegisterErrorResponse = {
        email?: string[];
        username?: string[];
        password?: string[];
        password_confirm?: string[];
        non_field_errors?: string[];
        detail?: string;
      };

      const axiosError = error as AxiosError<RegisterErrorResponse | string | string[]>;
      const data = axiosError.response?.data;

      let detailedMessage: string | undefined;
      if (typeof data === 'string') {
        detailedMessage = data;
      } else if (Array.isArray(data)) {
        detailedMessage = data[0];
      } else if (data) {
        const orderedFields: Array<keyof RegisterErrorResponse> = [
          'email',
          'username',
          'password',
          'password_confirm',
          'non_field_errors',
          'detail',
        ];

        for (const field of orderedFields) {
          const entry = data[field];
          if (!entry) {
            continue;
          }

          if (Array.isArray(entry)) {
            const labelPrefix = field !== 'non_field_errors' && field !== 'detail' ? `${field}: ` : '';
            detailedMessage = `${labelPrefix}${entry.join(' ')}`;
          } else if (typeof entry === 'string') {
            detailedMessage = entry;
          }

          if (detailedMessage) {
            break;
          }
        }

        if (!detailedMessage) {
          const summary = Object.entries(data)
            .map(([field, value]) => {
              if (Array.isArray(value)) {
                return `${field}: ${value.join(' ')}`;
              }
              if (typeof value === 'string') {
                return `${field}: ${value}`;
              }
              return `${field}`;
            })
            .join(' | ');
          detailedMessage = summary || undefined;
        }
      }

      setFormError(
        detailedMessage ??
          'Die Registrierung konnte nicht abgeschlossen werden. Bitte überprüfe deine Angaben oder versuche es in wenigen Augenblicken erneut.',
      );
    }
  };

  return (
    <form id="register-form" className="space-y-6 text-slate-700" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>
      )}

      <div className="space-y-2">
        <label htmlFor="username" className="text-sm font-medium text-slate-800">
          Nutzername
        </label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          placeholder="Dein EmmaTresor-Name"
          {...register('username')}
        />
        {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
      </div>

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
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          placeholder="Mindestens 12 Zeichen"
          {...register('password')}
        />
        {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
        <p className="text-xs text-slate-500">
          Mindestens 12 Zeichen, inkl. Groß- und Kleinbuchstaben, Ziffern und Sonderzeichen.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="password_confirm" className="text-sm font-medium text-slate-800">
          Passwort bestätigen
        </label>
        <input
          id="password_confirm"
          type="password"
          autoComplete="new-password"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-800 shadow-sm focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          placeholder="Passwort erneut eingeben"
          {...register('password_confirm')}
        />
        {errors.password_confirm && <p className="text-xs text-red-500">{errors.password_confirm.message}</p>}
      </div>

      <label className="flex items-start gap-3 text-xs text-slate-600">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border border-slate-300 bg-white text-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200/60"
          {...register('acceptTerms')}
        />
        <span>
          Ich bestätige die Sicherheits- und Nutzungsbedingungen von EmmaTresor. Meine Daten bleiben in meiner Kontrolle und
          werden nicht an Dritte weitergegeben.
        </span>
      </label>
      {errors.acceptTerms && <p className="text-xs text-red-500">{errors.acceptTerms.message}</p>}

      <Button type="submit" variant="primary" size="md" loading={isSubmitting} className="w-full">
        Konto anlegen und starten
      </Button>

      <p className="text-center text-xs text-slate-500">
        Bereits ein Konto?{' '}
        <Link to="/login" className="font-semibold text-brand-500 hover:text-brand-600">
          Zur Anmeldung
        </Link>
      </p>
      <p className="text-center text-xs text-slate-500">
        Fragen zur Registrierung? Wende dich jederzeit an dein EmmaTresor-Team.
      </p>
    </form>
  );
};

export default RegisterPage;
