import os

from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h]

# Behind Caddy (Arvan VPS) or Railway's proxy.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
if os.environ.get("SECURE_SSL_REDIRECT", "0") == "1":
    SECURE_SSL_REDIRECT = True

# whitenoise for static; media stays on the local filesystem (ephemeral on
# Railway — reseeded on demand; the Arvan VPS mounts a shared volume).
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
