from django.conf import settings
from django.views.generic import TemplateView


class LandingPageView(TemplateView):
    """
    Renders the landing page.
    """
    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        """
        Gets the context data for the template.

        Args:
            **kwargs: Arbitrary keyword arguments.

        Returns:
            dict: The context data.
        """
        context = super().get_context_data(**kwargs)
        context['frontend_login_url'] = settings.FRONTEND_LOGIN_URL
        return context
