from django.conf import settings
from django.test import TestCase
from django.urls import reverse
from unittest import mock


class LandingPageTests(TestCase):
    def test_landing_page_uses_configured_frontend_login_url(self):
        custom_url = 'https://app.example.com/login'
        with mock.patch.object(settings, 'FRONTEND_LOGIN_URL', custom_url):
            response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 200)
        self.assertIn(custom_url, response.content.decode('utf-8'))
