"""JWT auth for Django Ninja, backed by djangorestframework-simplejwt.

- JWTAuth: any authenticated user (customers log in via OTP — M4).
- StaffAuth: admin panel users (is_staff), the single-superuser MVP model.
"""
from django.contrib.auth import get_user_model
from ninja.security import HttpBearer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


class JWTAuth(HttpBearer):
    def authenticate(self, request, token):
        try:
            validated = AccessToken(token)
            user = User.objects.get(pk=validated["user_id"], is_active=True)
        except (TokenError, User.DoesNotExist):
            return None
        request.user = user
        return user


class StaffAuth(JWTAuth):
    def authenticate(self, request, token):
        user = super().authenticate(request, token)
        if user is not None and user.is_staff:
            return user
        return None
