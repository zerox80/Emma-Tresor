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
from urllib.parse import urlparse

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


def _env_bool(value: str | None, *, default: bool = False) -> bool:
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


def _https_host_allowed(hostname: str, allowed_hosts: list[str]) -> bool:
    if not allowed_hosts:
        return False
    for pattern in allowed_hosts:
        if pattern == '*':
            return True
        if pattern.startswith('.'):
            suffix = pattern[1:]
            if hostname == suffix or hostname.endswith(f'.{suffix}'):
                return True
        elif pattern == hostname:
            return True
    return False


def _validate_https_url(
    value: str,
    *,
    setting_name: str,
    allow_local_http: bool = True,
    allowed_https_hosts: list[str] | None = None,
) -> None:
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        raise ImproperlyConfigured(
            f"{setting_name} muss eine vollständige HTTP/HTTPS-URL mit Hostnamen enthalten."
        )
    if parsed.scheme not in {'http', 'https'}:
        raise ImproperlyConfigured(f"{setting_name} unterstützt nur HTTP- oder HTTPS-URLs.")
    hostname = parsed.hostname or ''
    if parsed.scheme == 'http' and (not allow_local_http or hostname not in {'localhost', '127.0.0.1'}):
        raise ImproperlyConfigured(
            f"{setting_name} darf nur mit HTTP verwendet werden, wenn die Domain localhost oder 127.0.0.1 ist."
        )
    if parsed.scheme == 'https' and allowed_https_hosts:
        if not _https_host_allowed(hostname, allowed_https_hosts):
            raise ImproperlyConfigured(
                f"{setting_name}: Host '{hostname}' ist nicht in der zugelassenen HTTPS-Liste enthalten."
            )


SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY environment variable is required.')

DEBUG = _env_bool(os.environ.get('DJANGO_DEBUG'), default=False)

# Stricter secret key validation
if not DEBUG and (SECRET_KEY.startswith('django-insecure') or len(SECRET_KEY) < 50 or SECRET_KEY == 'your-secret-key-here'):
    raise ImproperlyConfigured('Bitte setze eine sichere DJANGO_SECRET_KEY (mindestens 50 Zeichen) für Produktionsumgebungen.')

ALLOWED_HOSTS = _env_list('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1')

# Force SSL configuration
_force_ssl_default = not DEBUG and not RUNNING_DEVSERVER
FORCE_SSL = _env_bool(os.environ.get('DJANGO_FORCE_SSL'), default=_force_ssl_default)

# SSL redirect: Disable when behind a CDN/proxy that handles SSL termination
# Set DJANGO_SSL_REDIRECT=1 only if Django itself should redirect HTTP to HTTPS
SSL_REDIRECT = _env_bool(os.environ.get('DJANGO_SSL_REDIRECT'), default=False)

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
    'django_filters',
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
    'EmmaTresor.middleware.SecurityEventLoggingMiddleware',
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
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD'),
            'HOST': os.environ.get('POSTGRES_HOST', 'postgres'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
        }
    }
    if not DATABASES['default']['PASSWORD']:
        raise ImproperlyConfigured('POSTGRES_PASSWORD environment variable is required when using PostgreSQL.')
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

PRIVATE_MEDIA_ROOT = Path(os.environ.get('DJANGO_PRIVATE_MEDIA_ROOT', BASE_DIR / 'private_media'))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'inventory.authentication.CookieJWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
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
        'item_create': '50/hour',
        'item_update': '100/hour',
        'item_delete': '20/hour',
        'qr_generate': '30/minute',
    },
}

SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),  # Reduced from 30 to 15 minutes for better security
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
}

JWT_ACCESS_COOKIE_NAME = os.environ.get('JWT_ACCESS_COOKIE_NAME', 'emmatresor_access_token')
JWT_REFRESH_COOKIE_NAME = os.environ.get('JWT_REFRESH_COOKIE_NAME', 'emmatresor_refresh_token')
JWT_REMEMBER_COOKIE_NAME = os.environ.get('JWT_REMEMBER_COOKIE_NAME', 'emmatresor_remember_me')
JWT_COOKIE_SECURE = FORCE_SSL
JWT_COOKIE_HTTPONLY = True
JWT_COOKIE_SAMESITE = 'None' if FORCE_SSL else 'Lax'
JWT_COOKIE_DOMAIN = os.environ.get('JWT_COOKIE_DOMAIN') or None
JWT_ACCESS_COOKIE_PATH = '/'
JWT_REFRESH_COOKIE_PATH = '/api/'

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
# Validate CORS origins to prevent overly permissive configurations
allowed_https_hosts = {host for host in ALLOWED_HOSTS if host and host != '*'} or None
for origin in CORS_ALLOWED_ORIGINS:
    _validate_https_url(
        origin,
        setting_name='CORS_ALLOWED_ORIGINS',
        allow_local_http=True,
        allowed_https_hosts=allowed_https_hosts,
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
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
# HSTS Configuration - Only active when FORCE_SSL is enabled
SECURE_HSTS_SECONDS = 31536000 if FORCE_SSL else 0  # 1 year for production
SECURE_HSTS_PRELOAD = FORCE_SSL
SECURE_HSTS_INCLUDE_SUBDOMAINS = FORCE_SSL
# Disable SSL redirect when behind CDN/proxy to prevent redirect loops
SECURE_SSL_REDIRECT = SSL_REDIRECT and not TESTING

# Honour HTTPS information forwarded by the reverse proxy to avoid redirect loops
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

CSRF_COOKIE_HTTPONLY = True
# Only use 'None' for SameSite when both FORCE_SSL is enabled AND CSRF_COOKIE_SECURE is explicitly True
CSRF_COOKIE_SECURE = FORCE_SSL  # Ensure CSRF cookie is secure when SSL is forced
CSRF_COOKIE_SAMESITE = 'None' if (FORCE_SSL and CSRF_COOKIE_SECURE) else 'Lax'

# Compression settings
USE_GZIP = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'


_csp_connect_extra = _env_list('CSP_CONNECT_SRC_EXTRA', default='')
_csp_connect_sources = ["'self'"]
_csp_connect_sources.extend(CORS_ALLOWED_ORIGINS)
_csp_connect_sources.extend(_csp_connect_extra)

_csp_script_sources = ["'self'"]
# Only allow unsafe-eval in development for debugging, never in production
if DEBUG and _env_bool(os.environ.get('DJANGO_DEBUG_UNSAFE_EVAL'), default=False):
    _csp_script_sources.append("'unsafe-eval'")

# Content Security Policy - django-csp 4.0 format
CONTENT_SECURITY_POLICY = {
    'DIRECTIVES': {
        'default-src': ["'self'"],
        'script-src': list(_csp_script_sources),
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'blob:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': list(dict.fromkeys(_csp_connect_sources)),
        'frame-ancestors': ["'self'"],
        'base-uri': ["'self'"],
        'object-src': ["'none'"],
        'form-action': ["'self'"],
        'frame-src': ["'none'"],
        'worker-src': ["'self'", 'blob:'],
        'media-src': ["'self'", 'blob:'],
    },
}


ALLOW_USER_REGISTRATION = _env_bool(os.environ.get('ALLOW_USER_REGISTRATION'), default=False)

# Standard-Typ für Primärschlüssel
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Security Logging Configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'json': {
            'format': '{"time": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s", "path": "%(pathname)s"}',
        },
    },
    'handlers': {
        'security_file': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'security.log',
            'maxBytes': 10485760,  # 10MB
            'backupCount': 10,
            'formatter': 'verbose',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'security': {
            'handlers': ['security_file', 'console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['security_file', 'console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# Frontend-Integration
# Erlaubt es, den Link zum React-Login zentral zu konfigurieren. Fällt auf die
# lokale Entwicklungsinstanz zurück, wenn keine Umgebungsvariable gesetzt ist.
FRONTEND_LOGIN_URL = os.environ.get('EMMATRESOR_FRONTEND_LOGIN_URL', 'http://127.0.0.1:5173/login')
FRONTEND_BASE_URL = os.environ.get('EMMATRESOR_FRONTEND_BASE_URL', 'http://127.0.0.1:5173')

# Validate frontend URLs
_validate_https_url(
    FRONTEND_BASE_URL,
    setting_name='FRONTEND_BASE_URL',
    allow_local_http=True,
    allowed_https_hosts=allowed_https_hosts,
)
_validate_https_url(
    FRONTEND_LOGIN_URL,
    setting_name='FRONTEND_LOGIN_URL',
    allow_local_http=True,
    allowed_https_hosts=allowed_https_hosts,
)
