"""Typed environment parsing and validation helpers for Django settings."""

import os
from pathlib import Path
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured

def load_env_file(base_dir: Path) -> None:
    """
    Load environment variables from .env file if it exists.
    This allows local development without exporting environment variables.
    Format: KEY=value or KEY="quoted value"
    Lines starting with # are ignored as comments.
    """
    env_file = base_dir / '.env'
    if not env_file.exists():
        env_file = base_dir.parent / '.env'
    if not env_file.exists():
        return

    # Read and parse each line of the .env file
    for raw_line in env_file.read_text(encoding='utf-8').splitlines():
        line = raw_line.strip()
        # Skip empty lines and comments
        if not line or line.startswith('#'):
            continue

        # Split at first '=' to separate key and value
        key, sep, value = line.partition('=')
        if not sep:
            continue

        key = key.strip()
        # Skip if key is empty or already exists in environment
        if not key or key in os.environ:
            continue

        # Clean value by removing quotes and whitespace
        cleaned_value = value.strip().strip('"').strip("'")
        os.environ[key] = cleaned_value

def _env_bool(value: str | None, *, default: bool = False) -> bool:
    """
    Convert environment variable string to boolean.

    Args:
        value: Environment variable value as string
        default: Default value if environment variable is None

    Returns:
        boolean: True if value is one of: 1, true, yes, on (case insensitive)
    """
    if value is None:
        return default
    return value.lower() in {'1', 'true', 'yes', 'on'}

def _env_int(key: str, *, default: int, minimum: int | None = None) -> int:
    """
    Convert environment variable string to integer with optional lower bound.

    Args:
        key: Environment variable key
        default: Default value if environment variable is missing
        minimum: Optional minimum accepted value

    Returns:
        int: Parsed integer value
    """
    value = os.environ.get(key)
    if value in {None, ''}:
        return default

    try:
        parsed = int(value)
    except ValueError as exc:
        raise ImproperlyConfigured(f'{key} must be an integer.') from exc

    if minimum is not None and parsed < minimum:
        raise ImproperlyConfigured(f'{key} must be at least {minimum}.')

    return parsed

def _env_list(key: str, *, default: str = '') -> list[str]:
    """
    Convert comma-separated environment variable to list of strings.

    Args:
        key: Environment variable key
        default: Default value as comma-separated string

    Returns:
        list[str]: List of non-empty, trimmed values
    """
    value = os.environ.get(key)
    if not value:
        value = default
    return [item.strip() for item in value.split(',') if item.strip()]

def _https_host_allowed(hostname: str, allowed_hosts: list[str]) -> bool:
    """
    Check if hostname is allowed by the allowed_hosts patterns.
    Supports wildcards and subdomain matching.

    Args:
        hostname: Hostname to check
        allowed_hosts: List of allowed host patterns

    Returns:
        bool: True if hostname is allowed
    """
    if not allowed_hosts:
        return False
    for pattern in allowed_hosts:
        # Wildcard allows any host
        if pattern == '*':
            return True
        # Subdomain pattern (.example.com allows example.com and *.example.com)
        if pattern.startswith('.'):
            suffix = pattern[1:]
            if hostname == suffix or hostname.endswith(f'.{suffix}'):
                return True
        # Exact hostname match
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
    """
    Validate URL configuration for security settings.

    Args:
        value: URL to validate
        setting_name: Name of the setting (for error messages)
        allow_local_http: Whether HTTP is allowed for localhost
        allowed_https_hosts: List of allowed HTTPS host patterns

    Raises:
        ImproperlyConfigured: If URL validation fails
    """
    parsed = urlparse(value)
    if not parsed.scheme or not parsed.netloc:
        raise ImproperlyConfigured(
            f"{setting_name} muss eine vollständige HTTP/HTTPS-URL mit Hostnamen enthalten."
        )
    if parsed.scheme not in {'http', 'https'}:
        raise ImproperlyConfigured(f"{setting_name} unterstützt nur HTTP- oder HTTPS-URLs.")
    hostname = parsed.hostname or ''
    # Only allow HTTP for localhost in development
    if parsed.scheme == 'http' and (not allow_local_http or hostname not in {'localhost', '127.0.0.1'}):
        raise ImproperlyConfigured(
            f"{setting_name} darf nur mit HTTP verwendet werden, wenn die Domain localhost oder 127.0.0.1 ist."
        )
    # Validate HTTPS hosts against allowed list
    if parsed.scheme == 'https' and allowed_https_hosts:
        if not _https_host_allowed(hostname, allowed_https_hosts):
            raise ImproperlyConfigured(
                f"{setting_name}: Host '{hostname}' ist nicht in der zugelassenen HTTPS-Liste enthalten."
            )
