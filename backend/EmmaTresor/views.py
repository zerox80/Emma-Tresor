# EmmaTresor Main Views
# =====================
# This module contains the main application views that are not part of any specific app.
# Currently, it provides the landing page that serves as the entry point to the application.

from django.conf import settings                     # Django settings for accessing configuration
from django.views.generic import TemplateView       # Generic class-based view for rendering templates

class LandingPageView(TemplateView):
    """
    Main landing page view for the EmmaTresor application.

    This view serves as the entry point to the web application.
    It displays a simple template that typically redirects users
    to the frontend React application or provides basic information
    about the service.

    Inherits from TemplateView which provides standard template rendering functionality.
    """

    # The HTML template to render for this view
    # Located in the templates/ directory as 'index.html'
    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        """
        Add additional context data to the template.

        This method is called by TemplateView to prepare context variables
        that will be available in the template during rendering.

        Args:
            **kwargs: Additional keyword arguments passed to the view

        Returns:
            dict: Template context data including any additional variables
        """
        # Get the base context from the parent class
        # This includes standard template context variables
        context = super().get_context_data(**kwargs)

        # Add the frontend login URL to the template context
        # This allows the template to redirect users to the React frontend login page
        # The URL is configured in settings.py as FRONTEND_LOGIN_URL
        context['frontend_login_url'] = settings.FRONTEND_LOGIN_URL

        # Return the enhanced context dictionary
        return context
