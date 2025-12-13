# EmmaTresor Security Event Logging Middleware
# ============================================
# This middleware logs security-related events to help with monitoring,
# intrusion detection, and compliance requirements.

import logging
from django.utils.deprecation import MiddlewareMixin

# Dedicated security logger for all security events
security_logger = logging.getLogger('security')

class SecurityEventLoggingMiddleware(MiddlewareMixin):
    """
    Django middleware for logging security events.

    Automatically logs important security events:
    - 401 Unauthorized: Authentication failures
    - 403 Forbidden: Authorization denials
    - 429 Too Many Requests: Rate limiting violations

    This helps with:
    - Security monitoring and alerting
    - Intrusion detection
    - Compliance auditing
    - Performance analysis
    """

    def process_response(self, request, response):
        """
        Process HTTP responses and log security events.

        Args:
            request: Django HTTP request object
            response: Django HTTP response object

        Returns:
            response: Unmodified response object
        """
        status_code = response.status_code

        # Log authentication failures (401)
        if status_code == 401:
            security_logger.warning(
                'Authentication failed',
                extra={
                    'path': request.path,
                    'method': request.method,
                    'ip': self._get_client_ip(request),
                    'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200]
                }
            )

        # Log authorization denials (403)
        elif status_code == 403:
            security_logger.warning(
                'Authorization denied',
                extra={
                    'path': request.path,
                    'method': request.method,
                    'user': str(request.user) if request.user.is_authenticated else 'anonymous',
                    'ip': self._get_client_ip(request)
                }
            )

        # Log rate limiting violations (429)
        elif status_code == 429:
            security_logger.warning(
                'Rate limit exceeded',
                extra={
                    'path': request.path,
                    'ip': self._get_client_ip(request)
                }
            )

        return response

    def _get_client_ip(self, request):
        """
        Extract the real client IP address from request.

        Handles cases where the application is behind a proxy/load balancer
        by checking the X-Forwarded-For header first.

        Args:
            request: Django HTTP request object

        Returns:
            str: Client IP address or 'unknown' if cannot be determined
        """
        # Check for proxy-forwarded IP first
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            # X-Forwarded-For can contain multiple IPs, take the first (original client)
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            # Fall back to direct connection IP
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return ip
