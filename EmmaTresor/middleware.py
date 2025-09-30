"""Custom middleware for EmmaTresor."""

from django.utils.deprecation import MiddlewareMixin


class CsrfExemptAPIMiddleware(MiddlewareMixin):
    """
    Exempt API endpoints from CSRF checks.
    
    Since the application uses JWT-based authentication with HttpOnly cookies,
    CSRF protection is not needed for API endpoints. The JWT tokens themselves
    provide sufficient protection against CSRF attacks.
    """
    
    def process_request(self, request):
        """Disable CSRF checks for all /api/ endpoints."""
        if request.path.startswith('/api/'):
            setattr(request, '_dont_enforce_csrf_checks', True)
