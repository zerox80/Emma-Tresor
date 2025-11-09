from __future__ import annotations
from django.conf import settings
from rest_framework import authentication
from rest_framework.request import Request
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

class CookieJWTAuthentication(JWTAuthentication):

    def authenticate(self, request: Request) ->(tuple[authentication.User,
        str] | None):
        header = self.get_header(request)
        if header is not None:
            return super().authenticate(request)
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if not raw_token:
            return None
        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            return None
        return self.get_user(validated_token), validated_token
