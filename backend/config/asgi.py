"""ASGI config — kept for future use (channels/websockets); gunicorn WSGI is the MVP path."""
import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

application = get_asgi_application()
