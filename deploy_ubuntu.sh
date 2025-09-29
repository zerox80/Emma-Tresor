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
pip install -r requirements.txt

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install
npm run build
cd ..

# Run Django migrations
echo "Running Django migrations..."
python manage.py migrate

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if needed
echo "Creating Django superuser..."
echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@example.com', 'admin123')" | python manage.py shell

echo "=== Deployment completed successfully! ==="
echo "You can now start the server with:"
echo "source venv/bin/activate"
echo "python manage.py runserver 0.0.0.0:8000"
