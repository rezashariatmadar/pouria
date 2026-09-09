#!/bin/sh
# Container startup: apply migrations, collect static files, then exec the CMD (gunicorn).
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec "$@"
