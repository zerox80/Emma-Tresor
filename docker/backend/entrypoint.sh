#!/bin/sh
# EmmaTresor Backend Container Entrypoint
# ======================================
# This script initializes the Django application container with proper
# security settings, database connectivity checks, and user management.

set -o errexit          # Exit immediately if a command exits with a non-zero status.
set -o nounset          # Treat unset variables as an error when substituting.
set -o pipefail         # Exit immediately if a pipeline returns a non-zero status.

# Fix volume permissions
# ===================
# We start as root to handle mounted volumes with proper permissions,
# then switch to non-root user for application execution
mkdir -p /vol/web/static /vol/web/media /vol/web/private_media # Create necessary directories for static, media, and private media files if they don't exist.
chown -R appuser:appuser /vol/web/static /vol/web/media /vol/web/private_media # Change ownership of these directories to 'appuser' to ensure proper permissions.

# Fix app logs directory permissions
# ==============================
# Create logs directory with secure permissions for security logging
mkdir -p /app/logs # Create the logs directory if it doesn't exist.
chown -R appuser:appuser /app/logs # Change ownership of the logs directory to 'appuser'.
chmod -R 755 /app/logs # Set read, write, and execute permissions for the owner, and read and execute for group and others.

# Database connectivity check
# ==========================
# Wait for PostgreSQL database to be ready before starting the application
# This prevents race conditions where Django starts before database is ready
if [ "${DB_VENDOR:-sqlite}" = "postgres" ]; then # Check if the DB_VENDOR environment variable is set to 'postgres', defaulting to 'sqlite' if not set.
    echo "Waiting for PostgreSQL to become available..." # Print a message indicating that the script is waiting for PostgreSQL.
    
    # Python script to test database connectivity
    python <<'PY' # Start an inline Python script.
import os # Import the 'os' module for interacting with the operating system.
import time # Import the 'time' module for time-related functions.
import psycopg # Import the 'psycopg' module for PostgreSQL database interaction.

# Get database connection parameters from environment
host = os.environ.get("POSTGRES_HOST", "postgres") # Get the PostgreSQL host from environment variable, default to 'postgres'.
port = os.environ.get("POSTGRES_PORT", "5432") # Get the PostgreSQL port from environment variable, default to '5432'.
db = os.environ.get("POSTGRES_DB", "postgres") # Get the PostgreSQL database name from environment variable, default to 'postgres'.
user = os.environ.get("POSTGRES_USER", "postgres") # Get the PostgreSQL user from environment variable, default to 'postgres'.
password = os.environ.get("POSTGRES_PASSWORD", "") # Get the PostgreSQL password from environment variable, default to an empty string.

# Retry database connection for up to 60 seconds
for attempt in range(60): # Loop up to 60 times to attempt database connection.
    try: # Start a try block to catch potential exceptions during connection.
        with psycopg.connect(host=host, port=port, dbname=db, user=user, password=password, connect_timeout=3): # Attempt to connect to the PostgreSQL database.
            print("PostgreSQL connection established.") # Print a success message if connection is established.
            break # Exit the loop if connection is successful.
    except psycopg.OperationalError as exc: # Catch 'OperationalError' if the connection fails.
        print(f"PostgreSQL not ready (attempt {attempt + 1}/60): {exc}") # Print an error message with the attempt number and exception details.
        time.sleep(1) # Wait for 1 second before retrying.
else: # This block executes if the loop completes without a 'break' (i.e., connection failed after all attempts).
    # Exit if database is not PostgreSQL after 60 attempts
    raise SystemExit("Could not connect to PostgreSQL after 60 attempts") # Raise a SystemExit exception, terminating the script with an error message.
PY # End of the inline Python script.
fi # End of the 'if' statement.

# Django application setup
# ======================
# Run database migrations to create/update database schema
echo "Running database migrations..." # Print a message indicating that database migrations are being run.
python manage.py migrate --noinput --verbosity=2 # Execute Django database migrations without user interaction and with verbosity level 2.

# Collect static files for serving
echo "Collecting static files..." # Print a message indicating that static files are being collected.
python manage.py collectstatic --noinput # Collect all static files into the STATIC_ROOT directory without user interaction.

# Superuser creation
# ==================
# Automatically create a Django superuser if configured
# This is useful for automated deployments and initial setup
if [ "${AUTO_CREATE_SUPERUSER:-false}" = "true" ]; then # Check if the AUTO_CREATE_SUPERUSER environment variable is set to 'true', defaulting to 'false' if not set.
    python manage.py shell <<'PY' # Start an inline Python script within the Django shell.
import os # Import the 'os' module.
from django.contrib.auth import get_user_model # Import 'get_user_model' to get the active user model.

# Get superuser credentials from environment variables
username = os.environ.get("DJANGO_SUPERUSER_USERNAME") # Get the superuser username from environment variable.
email = os.environ.get("DJANGO_SUPERUSER_EMAIL") # Get the superuser email from environment variable.
password = os.environ.get("DJANGO_SUPERUSER_PASSWORD") # Get the superuser password from environment variable.

# Create superuser only if it doesn't already exist
if username and email and password: # Check if all superuser credentials are provided.
    User = get_user_model() # Get the custom user model.
    if not User.objects.filter(username=username).exists(): # Check if a superuser with the given username already exists.
        User.objects.create_superuser(username=username, email=email, password=password) # Create a new superuser if one doesn't exist.
        print("Superuser created:", username) # Print a success message.
    else: # If a superuser with the username already exists.
        print("Superuser already exists:", username) # Print a message indicating the superuser already exists.
else: # If any superuser credentials are missing.
    print("Skipping superuser creation; incomplete credentials") # Print a message indicating superuser creation is skipped due to incomplete credentials.
PY # End of the inline Python script.
fi # End of the 'if' statement.

# Switch to non-root user for security
# =================================
# Switch from root to appuser for actual application execution
# This follows security best practices by not running as root
echo "Switching to appuser for application execution..." # Print a message indicating the user switch.
exec su appuser -c "exec $*" # Execute the remaining command-line arguments as 'appuser', replacing the current shell process.