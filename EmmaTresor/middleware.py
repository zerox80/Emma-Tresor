"""Custom middleware for EmmaTresor."""

import logging
from django.utils.deprecation import MiddlewareMixin

security_logger = logging.getLogger('security')


class SecurityEventLoggingMiddleware(MiddlewareMixin):
    """
    Log security-relevant events for monitoring and alerting.
    """
    
    def process_response(self, request, response):
        """
        Logs security events based on the response status code.

        Args:
            request (HttpRequest): The incoming request.
            response (HttpResponse): The outgoing response.

        Returns:
            HttpResponse: The original response.
        """
        status_code = response.status_code
        
        # Log authentication failures
        if status_code == 401:
            security_logger.warning(
                'Authentication failed',
                extra={
                    'path': request.path,
                    'method': request.method,
                    'ip': self._get_client_ip(request),
                    'user_agent': request.META.get('HTTP_USER_AGENT', '')[:200],
                }
            )
        
        # Log authorization failures
        elif status_code == 403:
            security_logger.warning(
                'Authorization denied',
                extra={
                    'path': request.path,
                    'method': request.method,
                    'user': str(request.user) if request.user.is_authenticated else 'anonymous',
                    'ip': self._get_client_ip(request),
                }
            )
        
        # Log rate limit violations (429)
        elif status_code == 429:
            security_logger.warning(
                'Rate limit exceeded',
                extra={
                    'path': request.path,
                    'ip': self._get_client_ip(request),
                }
            )
        
        return response
    
    def _get_client_ip(self, request):
        """
        Extracts the client's IP address from the request, considering proxy headers.

        Args:
            request (HttpRequest): The incoming request.

        Returns:
            str: The client's IP address.
        """
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return ip
