# EmmaTresor Backend Dockerfile
# ==============================
# Multi-stage Docker build for Django backend with Python 3.14.
# Optimized for production with security best practices and minimal attack surface.

# syntax=docker/dockerfile:1

# Base stage - Python 3.14 slim image
# ==========================================
# Uses slim Alpine variant for minimal size and security
FROM python:3.14-slim AS base

# Environment variables for Python output
# ==================================
# Prevents Python from buffering stdout/stderr (important for logging)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set working directory
# =====================
# All subsequent commands run from /app directory
WORKDIR /app

# Install system dependencies
# ========================
# Install only essential packages needed for the application
# curl: Useful for debugging and health checks
# Pillow/psycopg: Build dependencies are bundled with pip, so no system packages needed
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
# ==============================
# Create dedicated user and group with UID 1000 for security
# Avoid running application as root to prevent privilege escalation attacks
RUN useradd -m -u 1000 appuser && \
    mkdir -p /vol/web/media /vol/web/static /vol/web/private_media && \
    chown -R appuser:appuser /vol && \
    chown -R appuser:appuser /app

# Install Python dependencies
# =========================
# Copy requirements file and install Python packages
# --upgrade pip: Ensure pip is latest version
# --no-cache-dir: Reduce image size by not storing pip cache
COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy and configure entrypoint script
# ====================================
# Custom entrypoint handles user switching and application startup
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && \
    chown appuser:appuser /entrypoint.sh

# Copy application code
# ====================
# Copy all application files with proper ownership
# --chown ensures files are owned by appuser, not root
COPY --chown=appuser:appuser . .

# Create logs directory with proper permissions
# =======================================
# Directory for application logs with secure permissions
# 755: owner rwx, group rx, others rx (read/execute for web server)
RUN mkdir -p /app/logs && \
    chown -R appuser:appuser /app/logs && \
    chmod -R 755 /app/logs

# Django settings module
# ====================
# Tell Django which settings module to use
ENV DJANGO_SETTINGS_MODULE=EmmaTresor.settings

# Security note about user switching
# ===============================
# We start as root to fix volume permissions in entrypoint,
# then switch to appuser for actual application execution
# The entrypoint.sh script handles this user transition

# Expose application port
# =======================
# Expose Django development server port to other containers
EXPOSE 8000

# Container startup command
# ======================
# Use Gunicorn WSGI server for production deployment
# --bind: Listen on all interfaces (0.0.0.0) for Docker networking
# --workers 4: Reasonable worker count for typical container
ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "EmmaTresor.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
