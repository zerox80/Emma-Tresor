# EmmaTresor Django Settings Configuration
# ==========================================
# This is the main Django settings file for EmmaTresor, a secure inventory management system.
# It includes comprehensive security configurations, JWT authentication, CORS setup,
# and supports both PostgreSQL (production) and SQLite (development) databases.

import os  # Operating system interface for environment variables
import sys  # System-specific parameters and functions
from datetime import timedelta  # For time-based configurations (JWT tokens, cooldowns)
from pathlib import Path  # Modern path handling filesystem paths
from urllib.parse import urlparse  # URL parsing for validation

from django.core.exceptions import ImproperlyConfigured  # Django configuration error handling

from .settings_helpers import (
    _env_bool,
    _env_int,
    _env_list,
    _validate_https_url,
    load_env_file,
)

# Base directory: Root of the Django project (2 levels up from this file)
BASE_DIR = Path(__file__).resolve().parent.parent




# Load environment variables from .env file at startup
load_env_file(BASE_DIR)

# Runtime context detection for conditional configuration
TESTING = 'test' in sys.argv  # True when running Django tests
RUNNING_DEVSERVER = any(arg.startswith('runserver') for arg in sys.argv)  # True when using manage.py runserver




# ===============================
# CORE DJANGO SECURITY CONFIGURATION
# ===============================

# Primary secret key for Django cryptographic signing (required for production)
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY')
if not SECRET_KEY:
    raise ImproperlyConfigured('DJANGO_SECRET_KEY environment variable is required.')

# Support for key rotation: maintains a list of previous valid secret keys
# This allows seamless rotation without invalidating existing sessions/tokens
SECRET_KEY_FALLBACKS = [
    key for key in [
        os.environ.get('DJANGO_SECRET_KEY_OLD_1', ''),
        os.environ.get('DJANGO_SECRET_KEY_OLD_2', ''),
        os.environ.get('DJANGO_SECRET_KEY_OLD_3', ''),
    ] if key and len(key) >= 50
]

# Debug mode: Shows detailed error pages and disables security features
# WARNING: Never enable DEBUG in production environments
DEBUG = _env_bool(os.environ.get('DJANGO_DEBUG'), default=False)

# Enforce secure secret key usage in production
insecure_secret_key = (
    SECRET_KEY.startswith('django-insecure')
    or len(SECRET_KEY) < 50
    or SECRET_KEY == 'your-secret-key-here'
)
if not DEBUG and insecure_secret_key:
    raise ImproperlyConfigured(
        'Bitte setze eine sichere DJANGO_SECRET_KEY (mindestens 50 Zeichen) für Produktionsumgebungen.'
    )

# Allowed hosts for Django's Host header validation
# Prevents HTTP Host header attacks by whitelisting valid hostnames
ALLOWED_HOSTS = _env_list('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1')

# ===============================
# SSL/HTTPS SECURITY CONFIGURATION
# ===============================

# Automatically force SSL in production (unless running dev server)
# This ensures HTTPS is used in production environments
_force_ssl_default = not DEBUG and not RUNNING_DEVSERVER
FORCE_SSL = _env_bool(os.environ.get('DJANGO_FORCE_SSL'), default=_force_ssl_default)

# Django's built-in SSL redirect middleware
# Redirects all HTTP requests to HTTPS when enabled
SSL_REDIRECT = _env_bool(os.environ.get('DJANGO_SSL_REDIRECT'), default=False)

# URL handling: disable slash appending during tests for cleaner test URLs
APPEND_SLASH = not TESTING

# ===============================
# DJANGO APPLICATIONS CONFIGURATION
# ===============================

# Core Django applications and third-party packages
INSTALLED_APPS = [
    # Django core apps
    'django.contrib.admin',         # Admin interface
    'django.contrib.auth',          # Authentication system
    'django.contrib.contenttypes',  # Content type framework
    'django.contrib.sessions',      # Session framework
    'django.contrib.messages',      # Message framework
    'django.contrib.staticfiles',   # Static file handling

    # Security and third-party apps
    'axes',                         # Login attempt protection/brute force prevention
    'csp',                          # Content Security Policy headers
    'corsheaders',                  # Cross-Origin Resource Sharing headers
    'rest_framework',               # Django REST Framework for API
    'rest_framework_simplejwt.token_blacklist',  # JWT token blacklisting
    'django_filters',               # Filtering support for DRF

    # Custom applications
    'inventory',                    # Core inventory management application
]

# ===============================
# MIDDLEWARE CONFIGURATION
# Order is important - processed from top to bottom on request, bottom to top on response
# ===============================

MIDDLEWARE = [
    # CORS headers must be processed first (before security middleware)
    'corsheaders.middleware.CorsMiddleware',

    # Security middleware should be early to apply security headers
    'django.middleware.security.SecurityMiddleware',

    # Content Security Policy to prevent XSS attacks
    'csp.middleware.CSPMiddleware',

    # Session handling (required for authentication and messages)
    'django.contrib.sessions.middleware.SessionMiddleware',

    # Common middleware for URL handling and other basic features
    'django.middleware.common.CommonMiddleware',

    # CSRF protection middleware (must be after SessionMiddleware)
    'django.middleware.csrf.CsrfViewMiddleware',

    # Authentication middleware (must be after SessionMiddleware)
    'django.contrib.auth.middleware.AuthenticationMiddleware',

    # Axes login attempt protection (must be after AuthenticationMiddleware)
    'axes.middleware.AxesMiddleware',

    # Message framework for flash messages
    'django.contrib.messages.middleware.MessageMiddleware',

    # Clickjacking protection
    'django.middleware.clickjacking.XFrameOptionsMiddleware',

    # Custom middleware for logging security events
    'EmmaTresor.middleware.SecurityEventLoggingMiddleware',
]

# Root URL configuration module
ROOT_URLCONF = 'EmmaTresor.urls'

# ===============================
# TEMPLATE CONFIGURATION
# ===============================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # Global templates directory
        'APP_DIRS': True,  # Allow apps to have their own templates directories
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',  # Request object in templates
                'django.contrib.auth.context_processors.auth',  # User authentication context
                'django.contrib.messages.context_processors.messages',  # Flash messages
            ],
        },
    },
]

# WSGI application for production deployment
WSGI_APPLICATION = 'EmmaTresor.wsgi.application'

# ===============================
# DATABASE CONFIGURATION
# Supports both PostgreSQL (production) and SQLite (development)
# ===============================

DB_VENDOR = os.environ.get('DB_VENDOR', 'sqlite').lower()

if DB_VENDOR == 'postgres':
    # PostgreSQL configuration for production environments
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'emmatresor'),     # Database name
            'USER': os.environ.get('POSTGRES_USER', 'emmatresor'),   # Database user
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD'),         # Database password (required)
            'HOST': os.environ.get('POSTGRES_HOST', 'postgres'),     # Database host
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),         # Database port
        }
    }
    # Require password for PostgreSQL in production
    if not DATABASES['default']['PASSWORD']:
        raise ImproperlyConfigured('POSTGRES_PASSWORD environment variable is required when using PostgreSQL.')
else:
    # SQLite configuration for development environments
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',  # SQLite database file in project root
        }
    }

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

AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesBackend',
    'django.contrib.auth.backends.ModelBackend',
]

LANGUAGE_CODE = 'de-de'

TIME_ZONE = 'Europe/Berlin'

USE_I18N = True

USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = Path(os.environ.get('DJANGO_STATIC_ROOT', BASE_DIR / 'staticfiles'))
STATICFILES_DIRS = [BASE_DIR / 'static']

MEDIA_URL = '/media/'
MEDIA_ROOT = Path(os.environ.get('DJANGO_MEDIA_ROOT', BASE_DIR / 'media'))

PRIVATE_MEDIA_ROOT = Path(os.environ.get('DJANGO_PRIVATE_MEDIA_ROOT', BASE_DIR / 'private_media'))

REST_FRAMEWORK = {
    'NUM_PROXIES': _env_int('DRF_NUM_PROXIES', default=0, minimum=0),
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
        'login_ip': '20/minute',
        'register': '3/minute',
        'logout': '10/minute',
        'item_create': '50/hour',
        'item_update': '100/hour',
        'item_delete': '20/hour',
        'qr_generate': '30/minute',
        'item_read': '200/hour',
        'item_export': '10/hour',
        'image_download': '100/hour',
    },
}

if TESTING:
    REST_FRAMEWORK['DEFAULT_THROTTLE_CLASSES'] = []

SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
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

_samesite_override = os.environ.get('JWT_COOKIE_SAMESITE', '').strip()
if _samesite_override in {'Strict', 'Lax', 'None'}:
    JWT_COOKIE_SAMESITE = _samesite_override
else:

    JWT_COOKIE_SAMESITE = 'Strict' if FORCE_SSL else 'Lax'

JWT_COOKIE_DOMAIN = os.environ.get('JWT_COOKIE_DOMAIN') or None
JWT_ACCESS_COOKIE_PATH = '/'
JWT_REFRESH_COOKIE_PATH = '/api/'

# ===============================
# PASSWORD HASHING CONFIGURATION
# Uses Argon2 as the primary hasher for maximum security
# ===============================

PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',     # Primary: Most secure, memory-hard
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',     # Fallback 1: Standard Django default
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher', # Fallback 2: SHA1 variant
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher', # Fallback 3: bcrypt variant
    'django.contrib.auth.hashers.ScryptPasswordHasher',     # Fallback 4: Memory-hard alternative
]

CORS_ALLOWED_ORIGINS = _env_list(
    'CORS_ALLOWED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
)

for origin in CORS_ALLOWED_ORIGINS:
    _validate_https_url(
        origin,
        setting_name='CORS_ALLOWED_ORIGINS',
        allow_local_http=True,
    )

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _env_list(
    'CSRF_TRUSTED_ORIGINS',
    default='http://localhost:5173,http://127.0.0.1:5173',
)

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = FORCE_SSL
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

SECURE_HSTS_SECONDS = 31536000 if FORCE_SSL else 0
SECURE_HSTS_PRELOAD = FORCE_SSL
SECURE_HSTS_INCLUDE_SUBDOMAINS = FORCE_SSL

SECURE_SSL_REDIRECT = SSL_REDIRECT and not TESTING

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

AXES_ENABLED = True
AXES_ONLY_ADMIN_SITE = True
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = timedelta(minutes=15)
AXES_RESET_ON_SUCCESS = True
AXES_LOCKOUT_PARAMETERS = [['ip_address', 'user_agent']]

CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_HEADER_NAME = 'HTTP_X_CSRFTOKEN'
CSRF_COOKIE_SECURE = FORCE_SSL

_csrf_samesite_override = os.environ.get('CSRF_COOKIE_SAMESITE', '').strip()
if _csrf_samesite_override in {'Strict', 'Lax', 'None'}:
    CSRF_COOKIE_SAMESITE = _csrf_samesite_override
else:
    CSRF_COOKIE_SAMESITE = 'Strict' if FORCE_SSL else 'Lax'

CSRF_USE_SESSIONS = False
CSRF_COOKIE_AGE = 31449600

USE_GZIP = True
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

_csp_connect_extra = _env_list('CSP_CONNECT_SRC_EXTRA', default='')
_csp_connect_sources = ["'self'"]
_csp_connect_sources.extend(CORS_ALLOWED_ORIGINS)
_csp_connect_sources.extend(_csp_connect_extra)

_csp_script_sources = ["'self'"]

if DEBUG and _env_bool(os.environ.get('DJANGO_DEBUG_UNSAFE_EVAL'), default=False):
    _csp_script_sources.append("'unsafe-eval'")

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

        'require-trusted-types-for': ["'script'"],
    },
}

ALLOW_USER_REGISTRATION = _env_bool(os.environ.get('ALLOW_USER_REGISTRATION'), default=False)

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

LOG_DIR = Path(os.environ.get('DJANGO_LOG_DIR', str(BASE_DIR / 'logs')))
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
        'json': {
            'format': (
                '{"time": "%(asctime)s", "level": "%(levelname)s", '
                '"message": "%(message)s", "path": "%(pathname)s"}'
            ),
        },
    },
    'handlers': {
        'security_file': {
            'level': 'WARNING',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'security.log',
            'maxBytes': 10485760,
            'backupCount': 100,
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
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.security': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

FRONTEND_LOGIN_URL = os.environ.get('EMMATRESOR_FRONTEND_LOGIN_URL', 'http://127.0.0.1:5173/login')
FRONTEND_BASE_URL = os.environ.get('EMMATRESOR_FRONTEND_BASE_URL', 'http://127.0.0.1:5173')

_validate_https_url(
    FRONTEND_BASE_URL,
    setting_name='FRONTEND_BASE_URL',
    allow_local_http=True,
)
_validate_https_url(
    FRONTEND_LOGIN_URL,
    setting_name='FRONTEND_LOGIN_URL',
    allow_local_http=True,
)
