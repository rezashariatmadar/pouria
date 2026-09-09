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
NEXT_PUBLIC_API_URL=https://<backend>.up.railway.app   # origin ONLY — code appends /api/v1 itself
PORT=3000                                              # Next standalone binds $PORT; the domain targets 3000
```

Deploy order matters: deploy **backend first**, generate its public domain,
then set that origin in the frontend's `NEXT_PUBLIC_API_URL` — Next inlines
`NEXT_PUBLIC_*` at build time, so the frontend must be built with the final
backend URL (any change to it triggers a rebuild).

## After the first deploy

`DATABASE_URL` resolves to the private network (`postgres.railway.internal`),
so `railway run` (which executes locally) can't reach the database. Run
management commands **inside the container** via SSH instead:

```bash
# seed the demo catalog (12 products / 3 variants)
railway ssh --service backend python manage.py seed_demo_data

# admin user for /login (generate a real password; this one is an example)
railway ssh --service backend env DJANGO_SUPERUSER_PASSWORD='<password>' \
  python manage.py createsuperuser --noinput --username pouria --email pouria@yadakpro.ir
```

(SSH needs a key: `ssh-keygen -t ed25519` once, `railway ssh keys add`, and
`ssh-keyscan -t ed25519 ssh.railway.com >> ~/.ssh/known_hosts` on headless
machines. `entrypoint.sh` already runs `migrate` + `collectstatic` on every
deploy.)

## Media

Product images live under `MEDIA_ROOT`. On Railway, either attach a volume
mounted at `/data/media` or keep serving the seeded remote/placeholder images
(the seed works without any media files).
