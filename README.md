# یدک‌پرو (YadakPro) — MVP

Persian (RTL) e-commerce platform for IKCO/SAIPA auto spare parts.

Core business moats (validated with the client via the HTML prototype in `prototype/`):

1. **Fast keyboard-driven price/stock editing** — an Excel-like admin table for a market that reprices hourly.
2. **VIN/chassis verification** — 17-character VIN decoding (NAAP/NAAB = IKCO, NAS = SAIPA) at the storefront and expert confirmation in the order workflow, to prevent wrong-part returns.
3. **Positional variants** — right (passenger) / left (driver) / pair as variants with independent price and stock.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS v4, self-hosted Vazirmatn font |
| Backend | Python 3.12 + Django 5.2 + Django Ninja (REST, swagger at `/api/docs`) |
| Database | PostgreSQL 16 |
| Infra | Docker; Railway now, ArvanCloud VPS + Caddy later (see migration playbook) |

No Celery/Redis: the 15-minute checkout stock hold is a lazy DB computation
(`available = stock − active holds`), so nothing needs a background worker.
Payments (Zibal) and SMS (Kavenegar) sit behind provider interfaces with
mock/console implementations for development.

## Repo layout

```
backend/    Django project (config/) + apps: catalog, orders, accounts, integrations
frontend/   Next.js app: (store) storefront + (admin) dashboard
prototype/  The validated 6-page HTML prototype — behavioral reference only, not shipped
e2e/        Playwright end-to-end tests
docker-compose.yml        full stack (db, backend, frontend, + caddy behind --profile proxy)
docker-compose.dev.yml    dev database only
Caddyfile                 reverse proxy for the Arvan VPS deployment
```

## Quickstart (development loop)

```bash
# 1. Database
docker compose -f docker-compose.dev.yml up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example .env          # defaults work for local dev
./manage.py migrate
./manage.py runserver            # http://localhost:8000/api/docs

# 3. Frontend (new terminal)
cd frontend
npm install
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1' >> .env.local
echo 'API_URL=http://localhost:8000/api/v1' >> .env.local
npm run dev                      # http://localhost:3000
```

Useful commands:

```bash
./manage.py createsuperuser      # admin-panel login (username/password)
./manage.py seed_demo_data       # vehicle taxonomy + demo products (idempotent)
cd backend && pytest             # API tests
node e2e/run.js                  # Playwright E2E (needs the full stack running)
```

## Full stack via Docker

```bash
docker compose up --build        # db :5432, backend :8000, frontend :3000
```

## Environment variables

See `.env.example` — every deployment difference is an env var, never a code change.
The two frontend vars (`NEXT_PUBLIC_API_URL` for browser calls, `API_URL` for
server-side rendering) go in `frontend/.env.local` locally.

## Deployment — Railway (current)

- **frontend**: Docker build from `frontend/Dockerfile`, `NEXT_PUBLIC_API_URL` build arg = public API URL.
- **backend**: Docker build from `backend/Dockerfile`, **attach a volume** mounted at `/data/media` (uploads must survive redeploys), set `MEDIA_ROOT=/data/media`.
- **postgres**: Railway Postgres plugin; set `DATABASE_URL`.
- Migrations run automatically in the container entrypoint.

## Migration playbook — Railway → ArvanCloud VPS

The design keeps this to ~1 hour + DNS propagation:

1. Stop writes (maintenance notice on the storefront).
2. `pg_dump` the Railway Postgres → `pg_restore` into the VPS Postgres container.
3. `rsync` the Railway media volume → the VPS media volume.
4. On the VPS: copy the repo, create `.env` from `.env.example` with production values, then `docker compose --profile proxy up -d --build` (adds Caddy with automatic HTTPS on ports 80/443).
5. Repoint the domain's DNS to the VPS.

The four rules that keep it simple: everything in Docker, config only via env vars,
Postgres accessed only through a standard connection string, media on a volume.

## Testing

- `backend/` — pytest via pytest-django (stock-hold math, batch updates, checkout).
- `e2e/` — Playwright, run against a running stack; uses the local chromium at
  `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome` (same driver as `verify-fixes.js`).
