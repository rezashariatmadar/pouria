"""Settings for pytest — in-memory SQLite keeps the test suite dependency-free.

The codebase avoids Postgres-specific features on purpose so this stays valid.
"""
from .dev import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
