# Deploying YadakPro — Railway

Two Docker services + a managed Postgres, all from this monorepo. The Docker
containers are identical to the `docker compose` stack (`docker-compose.yml`),
so the same images later move to the ArvanCloud VPS unchanged.

## Services

| Service  | Root directory | Build                | Notes                                    |
|----------|----------------|----------------------|------------------------------------------|
| Postgres | —              | Railway Data plugin  | provides `DATABASE_URL`                  |
| backend  | `backend/`     | `backend/Dockerfile` | gunicorn :8000, whitenoise, auto-migrates (`entrypoint.sh`) |
| frontend | `frontend/`    | `frontend/Dockerfile`| standalone Next.js :3000                 |

## Variables

**backend** (service variables):

```bash
DJANGO_SETTINGS_MODULE=config.settings.prod     # already the image default
DJANGO_SECRET_KEY=<openssl rand -base64 40>
DJANGO_ALLOWED_HOSTS=<backend>.up.railway.app
DATABASE_URL=${{Postgres.DATABASE_URL}}
CORS_ALLOWED_ORIGINS=https://<frontend>.up.railway.app
FRONTEND_URL=https://<frontend>.up.railway.app
PAYMENT_PROVIDER=mock        # zibal بعداً
SMS_PROVIDER=console         # kavenegar بعداً
```

**frontend** (service variables — `NEXT_PUBLIC_API_URL` is a **build** arg,
wired through `frontend/railway.json`):

```bash
NEXT_PUBLIC_API_URL=https://<backend>.up.railway.app/api/v1   # browser-side
API_URL=http://backend.railway.internal:8000/api/v1           # RSC server-side (private net)
```

Deploy order matters: deploy **backend first**, generate its public domain,
then set that URL in the frontend's `NEXT_PUBLIC_API_URL` — Next inlines
`NEXT_PUBLIC_*` at build time, so the frontend must be built with the final
backend URL.

## After the first deploy

```bash
# seed the demo catalog (12 products / 3 variants)
railway run --service backend python manage.py seed_demo_data

# admin user for /login
railway run --service backend python manage.py createsuperuser
```

(`entrypoint.sh` already runs `migrate` + `collectstatic` on every deploy.)

## Media

Product images live under `MEDIA_ROOT`. On Railway, either attach a volume
mounted at `/data/media` or keep serving the seeded remote/placeholder images
(the seed works without any media files).
