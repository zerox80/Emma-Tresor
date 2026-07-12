from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from inventory.models import Item, Tag, Location

User = get_user_model()

import csv
import shutil
import tempfile
from datetime import date
from io import BytesIO, StringIO
from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.settings import api_settings
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase, APIRequestFactory
from rest_framework_simplejwt.tokens import RefreshToken
import time
from contextlib import contextmanager

from ..api.throttles import LoginIPRateThrottle, LoginRateThrottle
from ..models import Item, ItemImage, ItemList, Location, Tag, DuplicateQuarantine
from ..views import ItemImageViewSet


def set_csrf_cookie(client):

    response = client.get(reverse('csrf_token'))
    csrf_token = response.cookies[settings.CSRF_COOKIE_NAME].value
    client.cookies[settings.CSRF_COOKIE_NAME] = csrf_token
    return csrf_token


@contextmanager
def temporary_rest_framework_settings(rest_framework_settings):
    override = override_settings(REST_FRAMEWORK=rest_framework_settings)
    override.enable()
    api_settings.reload()
    try:
        yield
    finally:
        override.disable()
        api_settings.reload()


def rest_framework_settings_with(**overrides):
    rest_framework_settings = {**settings.REST_FRAMEWORK}
    throttle_rates = overrides.pop('DEFAULT_THROTTLE_RATES', None)
    if throttle_rates is not None:
        rest_framework_settings['DEFAULT_THROTTLE_RATES'] = {
            **settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'],
            **throttle_rates,
        }
    rest_framework_settings.update(overrides)
    return rest_framework_settings


class TimedAPITestCase(APITestCase):

    @contextmanager
    def assertTiming(self, min_seconds):
        
        start = time.perf_counter()
        yield
        end = time.perf_counter()
        duration = end - start
        self.assertTrue(
            duration >= min_seconds,
            f"Operation took {duration:.4f}s, which is less than the minimum of {min_seconds}s."
        )

class BaseViewTestCase(TestCase):

    def setUp(self):

        self.user = User.objects.create_user(username='testuser', password='password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _get_token(self, user):
        refresh = RefreshToken.for_user(user)
        return str(refresh.access_token)
