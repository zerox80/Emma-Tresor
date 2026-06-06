#!/bin/bash
# Ubuntu Server Deployment Script for EmmaTresor
# This script handles the deployment on Ubuntu/Debian systems

set -e  # Exit on any error

echo "=== EmmaTresor Ubuntu Server Deployment ==="

# Update system packages
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install system dependencies
echo "Installing system dependencies..."
sudo apt install -y python3 python3-pip python3-venv nodejs npm nginx

# Use current directory as project directory (more flexible)
PROJECT_DIR="$(pwd)"
echo "Using project directory: $PROJECT_DIR"
cd "$PROJECT_DIR"

# Create Python virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip in virtual environment
echo "Upgrading pip in virtual environment..."
pip install --upgrade pip setuptools wheel

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm ci
npm run build
cd ..

# Run Django migrations
echo "Running Django migrations..."
python backend/manage.py migrate

# Collect static files
echo "Collecting static files..."
python backend/manage.py collectstatic --noinput

# Create superuser only when explicitly requested with safe credentials
if [ "${AUTO_CREATE_SUPERUSER:-false}" = "true" ]; then
    echo "Validating Django superuser configuration..."
    : "${DJANGO_SUPERUSER_USERNAME:?DJANGO_SUPERUSER_USERNAME must be set when AUTO_CREATE_SUPERUSER=true}"
    : "${DJANGO_SUPERUSER_EMAIL:?DJANGO_SUPERUSER_EMAIL must be set when AUTO_CREATE_SUPERUSER=true}"
    : "${DJANGO_SUPERUSER_PASSWORD:?DJANGO_SUPERUSER_PASSWORD must be set when AUTO_CREATE_SUPERUSER=true}"

    if [ "${#DJANGO_SUPERUSER_PASSWORD}" -lt 16 ]; then
        echo "DJANGO_SUPERUSER_PASSWORD must be at least 16 characters long." >&2
        exit 1
    fi

    insecure_admin_password="admin""123"
    case "$(printf '%s' "$DJANGO_SUPERUSER_PASSWORD" | tr '[:upper:]' '[:lower:]')" in
        "$insecure_admin_password"|password|change-me|your-secure-password-here)
            echo "DJANGO_SUPERUSER_PASSWORD uses a known default value; aborting." >&2
            exit 1
            ;;
    esac

    python backend/manage.py shell <<'PY'
import os

from django.contrib.auth import get_user_model

username = os.environ['DJANGO_SUPERUSER_USERNAME'].strip()
email = os.environ['DJANGO_SUPERUSER_EMAIL'].strip()
password = os.environ['DJANGO_SUPERUSER_PASSWORD']

if not username or not email or not password:
    raise SystemExit('Superuser environment variables must not be empty.')

User = get_user_model()
existing = User.objects.filter(username=username).first()
if existing:
    if not (existing.is_staff and existing.is_superuser):
        raise SystemExit(
            f"User '{username}' already exists but is not a staff superuser; aborting without changing credentials."
        )
    print(f"Superuser '{username}' already exists; leaving credentials unchanged.")
else:
    User.objects.create_superuser(username=username, email=email, password=password)
    print(f"Superuser '{username}' created.")
PY
else
    echo "Skipping automatic superuser creation. Set AUTO_CREATE_SUPERUSER=true with secure DJANGO_SUPERUSER_* values, or run createsuperuser interactively."
fi

echo "=== Deployment completed successfully! ==="
echo "Start Django behind Nginx with Gunicorn bound to localhost, for example:"
echo "source venv/bin/activate"
echo "gunicorn EmmaTresor.wsgi:application --chdir backend --bind 127.0.0.1:8000 --workers 3"
