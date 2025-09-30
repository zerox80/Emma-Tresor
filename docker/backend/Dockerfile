# syntax=docker/dockerfile:1

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (curl for debugging, build deps for Pillow/psycopg are already bundled)
RUN apt-get update \
    && apt-get install --no-install-recommends -y curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 appuser && \
    mkdir -p /vol/web/media /vol/web/static /vol/web/private_media && \
    chown -R appuser:appuser /vol && \
    chown -R appuser:appuser /app

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY docker/backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && \
    chown appuser:appuser /entrypoint.sh

COPY --chown=appuser:appuser . .

# Create logs directory for security logging
RUN mkdir -p /app/logs && chown -R appuser:appuser /app/logs

ENV DJANGO_SETTINGS_MODULE=EmmaTresor.settings

# Switch to non-root user
USER appuser

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "EmmaTresor.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "4"]
