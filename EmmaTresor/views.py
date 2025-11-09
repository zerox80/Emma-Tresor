from django.conf import settings
from django.views.generic import TemplateView

class LandingPageView(TemplateView):
    template_name = 'index.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['frontend_login_url'] = settings.FRONTEND_LOGIN_URL
        return context
