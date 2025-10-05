#!/bin/sh
set -o errexit
set -o nounset
set -o pipefail

# Fix volume permissions (we start as root to handle mounted volumes)
mkdir -p /vol/web/static /vol/web/media /vol/web/private_media
chown -R appuser:appuser /vol/web/static /vol/web/media /vol/web/private_media

if [ "${DB_VENDOR:-sqlite}" = "postgres" ]; then
    echo "Waiting for PostgreSQL to become available..."
    python <<'PY'
import os
import time
import psycopg

host = os.environ.get("POSTGRES_HOST", "postgres")
port = os.environ.get("POSTGRES_PORT", "5432")
db = os.environ.get("POSTGRES_DB", "postgres")
user = os.environ.get("POSTGRES_USER", "postgres")
password = os.environ.get("POSTGRES_PASSWORD", "")

for attempt in range(60):
    try:
        with psycopg.connect(host=host, port=port, dbname=db, user=user, password=password, connect_timeout=3):
            print("PostgreSQL connection established.")
            break
    except psycopg.OperationalError as exc:
        print(f"PostgreSQL not ready (attempt {attempt + 1}/60): {exc}")
        time.sleep(1)
else:
    raise SystemExit("Could not connect to PostgreSQL after 60 attempts")
PY
fi

# Run migrations with extra safety
echo "Running database migrations..."
python manage.py migrate --noinput --verbosity=2

echo "Collecting static files..."
python manage.py collectstatic --noinput

if [ "${AUTO_CREATE_SUPERUSER:-false}" = "true" ]; then
    python manage.py shell <<'PY'
import os
from django.contrib.auth import get_user_model

username = os.environ.get("DJANGO_SUPERUSER_USERNAME")
email = os.environ.get("DJANGO_SUPERUSER_EMAIL")
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD")

if username and email and password:
    User = get_user_model()
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username=username, email=email, password=password)
        print("Superuser created:", username)
    else:
        print("Superuser already exists:", username)
else:
    print("Skipping superuser creation; incomplete credentials")
PY
fi

# Switch to appuser for running the application (we started as root to fix permissions)
echo "Switching to appuser for application execution..."
exec su appuser -c "exec $*"
