"""
Django-Einstellungen für das Projekt »EmmaTresor«.

Erstellt mit «django-admin startproject» (Version 5.2.6).

Weitere Informationen findest du in der offiziellen Django-Dokumentation:
https://docs.djangoproject.com/en/5.2/topics/settings/

Die vollständige Übersicht aller Einstellungen steht unter:
https://docs.djangoproject.com/en/5.2/ref/settings/
"""

import os
import sys
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

# Projektpfade wie folgt aufbauen: BASE_DIR / 'unterverzeichnis'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Schnelle Entwicklungs-Konfiguration – nicht für Produktion geeignet.
# Siehe https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/


def _load_env_file() -> None:
    env_file = BASE_DIR / '.env'
    if not env_file.exists():
        return

    for raw_line in env_file.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue

        key, sep, value = line.partition('=')
        if not sep:
            continue

        key = key.strip()
        if not key or key in os.environ:
            continue

        cleaned_value = value.strip().strip('"').strip("'")
        os.environ[key] = cleaned_value


def _env_bool(value: str, *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.lower() in {'1', 'true', 'yes', 'on'}


_load_env_file()

# Detect test environment to relax certain security redirects during tests
TESTING = 'test' in sys.argv
RUNNING_DEVSERVER = any(arg.startswith('runserver') for arg in sys.argv)


def _env_list(key: str, *, default: str = '') -> list[str]:
    value = os.environ.get(key)
    if not value:
        value = default
    return [item.strip() for item in value.split(',') if item.strip()]


SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'django-insecure-q-8qv^gs+a=hqit@8egvhje#x#w#4djw+@h0bkkf(_t!wajyss')

DEBUG = _env_bool(os.environ.get('DJANGO_DEBUG'), default=False)

if not DEBUG and SECRET_KEY.startswith('django-insecure'):
    raise ImproperlyConfigured('Bitte setze die Umgebungsvariable DJANGO_SECRET_KEY für Produktionsumgebungen.')

ALLOWED_HOSTS = _env_list('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1')

# Force SSL configuration
_force_ssl_default = not DEBUG and not RUNNING_DEVSERVER
FORCE_SSL = _env_bool(os.environ.get('DJANGO_FORCE_SSL'), default=_force_ssl_default)

# URL handling
# Avoid automatic slash-adding redirects in unit tests (those cause 301 responses)
APPEND_SLASH = not TESTING


# Anwendungskonfiguration
# Die folgenden Anwendungen sind für das Projekt erforderlich.
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'csp',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'inventory',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'csp.middleware.CSPMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'EmmaTresor.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'EmmaTresor.wsgi.application'


# Datenbank
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DB_VENDOR = os.environ.get('DB_VENDOR', 'sqlite').lower()

if DB_VENDOR == 'postgres':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'emmatresor'),
            'USER': os.environ.get('POSTGRES_USER', 'emmatresor'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', ''),
            'HOST': os.environ.get('POSTGRES_HOST', 'postgres'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# Passwort-Validierung
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalisierung
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'de-de'

TIME_ZONE = 'Europe/Berlin'

USE_I18N = True

USE_TZ = True


# Statische Dateien (CSS, JavaScript, Bilder)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = Path(os.environ.get('DJANGO_STATIC_ROOT', BASE_DIR / 'staticfiles'))
STATICFILES_DIRS = [BASE_DIR / 'static']

MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.environ.get('DJANGO_MEDIA_ROOT', BASE_DIR / 'media'))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
        *(
            ('rest_framework.renderers.BrowsableAPIRenderer',)
            if DEBUG
            else ()
        ),
    ),
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
        'login': '5/minute',
        'register': '3/minute',
        'logout': '10/minute',
    },
}

SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
}

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
    'django.contrib.auth.hashers.ScryptPasswordHasher',
]

CORS_ALLOWED_ORIGINS = _env_list(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
)

# Security-related configuration
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _env_list(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
)

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = FORCE_SSL
CSRF_COOKIE_SECURE = FORCE_SSL
SECURE_HSTS_SECONDS = 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_SSL_REDIRECT = FORCE_SSL and not TESTING

CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'None' if FORCE_SSL else 'Lax'

# Compression settings
USE_GZIP = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'


_csp_connect_extra = _env_list('CSP_CONNECT_SRC_EXTRA', default='')
_csp_connect_sources = ["'self'"]
_csp_connect_sources.extend(CORS_ALLOWED_ORIGINS)
_csp_connect_sources.extend(_csp_connect_extra)

_csp_script_sources = ["'self'"]
if DEBUG:
    _csp_script_sources.append("'unsafe-eval'")

CSP_DIRECTIVES = {
    'default-src': ("'self'",),
    'script-src': tuple(_csp_script_sources),
    'style-src': ("'self'", "'unsafe-inline'"),
    'img-src': ("'self'", 'data:', 'blob:'),
    'font-src': ("'self'", 'data:'),
    'connect-src': tuple(dict.fromkeys(_csp_connect_sources)),
    'frame-ancestors': ("'self'",),
    'base-uri': ("'self'",),
    'object-src': ("'none'",),
}


ALLOW_USER_REGISTRATION = _env_bool(os.environ.get('ALLOW_USER_REGISTRATION'), default=False)

# Standard-Typ für Primärschlüssel
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Frontend-Integration
# Erlaubt es, den Link zum React-Login zentral zu konfigurieren. Fällt auf die
# lokale Entwicklungsinstanz zurück, wenn keine Umgebungsvariable gesetzt ist.
FRONTEND_LOGIN_URL = os.environ.get('EMMATRESOR_FRONTEND_LOGIN_URL', 'http://127.0.0.1:5173/login')
