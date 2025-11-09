import logging
from django.utils.deprecation import MiddlewareMixin
security_logger = logging.getLogger('security')

class SecurityEventLoggingMiddleware(MiddlewareMixin):

    def process_response(self, request, response):
        status_code = response.status_code
        if status_code == 401:
            security_logger.warning('Authentication failed', extra={'path':
                request.path, 'method': request.method, 'ip': self.
                _get_client_ip(request), 'user_agent': request.META.get(
                'HTTP_USER_AGENT', '')[:200]})
        elif status_code == 403:
            security_logger.warning('Authorization denied', extra={'path':
                request.path, 'method': request.method, 'user': str(request
                .user) if request.user.is_authenticated else 'anonymous',
                'ip': self._get_client_ip(request)})
        elif status_code == 429:
            security_logger.warning('Rate limit exceeded', extra={'path':
                request.path, 'ip': self._get_client_ip(request)})
        return response

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR', 'unknown')
        return ip
