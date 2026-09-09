from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, re_path
from django.views.static import serve as static_serve

from config.api import api

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", api.urls),
    # Media is served by Django in every environment for now: on Railway there is
    # no proxy in front, and at MVP traffic this is fine. On the Arvan VPS,
    # Caddy takes over /media directly from the shared volume (see Caddyfile).
    re_path(r"^media/(?P<path>.*)$", static_serve, {"document_root": settings.MEDIA_ROOT}),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
