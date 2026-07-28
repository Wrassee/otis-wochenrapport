# Docker — OTIS Wochenrapport

## Overview

The project uses Docker Compose for local development and containerized deployment. There are three compose files offering different levels of isolation.

| Compose file | Services | Use case |
|---|---|---|
| `docker-compose.yml` | frontend + backend | Full-stack Docker dev — frontend AND backend in containers |
| `docker-compose.backend.yml` | backend only | Backend in Docker, frontend runs locally (`npm run dev`) |
| `docker-compose.local.yml` | frontend + backend (extended) | Reference config for local Supabase (host machine) |

Both Dockerfiles are optimized for development **hot-reload** — source directories are mounted as volumes, so changes in your editor take effect immediately inside the container.

---

## Quick Start

### Full stack in Docker

```bash
# Build and start both services
docker compose up -d

# View logs
docker compose logs -f

# Rebuild after Dockerfile or dependency changes
docker compose build --no-cache
docker compose up -d
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:8000](http://localhost:8000)
- Health check: [http://localhost:8000/health](http://localhost:8000/health)

### Backend only (frontend runs natively)

```bash
# Only the backend runs in Docker
docker compose -f docker-compose.backend.yml up -d

# Frontend runs natively with hot-reload
cd apps/web && npm run dev
```

This is useful when you need the frontend's full Vite HMR speed while keeping the Python backend containerized.

### Stopping

```bash
docker compose down              # stop + remove containers
docker compose down -v           # stop + remove containers + volumes (destroys data)
docker compose -f docker-compose.backend.yml down
```

---

## Compose File Details

### `docker-compose.yml` — Main stack

```yaml
services:
  frontend:
    build: ./apps/web
    ports: ["5173:5173"]
    volumes:
      - ./apps/web/src:/app/src          # HMR for React code
      - ./apps/web/public:/app/public
      - ./apps/web/index.html:/app/index.html
      - ./apps/web/vite.config.ts:/app/vite.config.ts
    environment:
      - VITE_RENDER_URL=http://backend:8000   # Docker DNS → backend container
    depends_on: [backend]

  backend:
    build: ./apps/backend
    ports: ["8000:8000"]
    env_file: ./apps/backend/.env        # Supabase credentials
    volumes:
      - ./apps/backend/src:/app/src      # Hot-reload for Python code
      - ./apps/backend/templates:/app/templates
    command: uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

**Key points:**
- `VITE_RENDER_URL=http://backend:8000` — Docker Compose DNS resolves `backend` to the backend container IP. No need for `localhost`.
- Backend reads `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` from `./apps/backend/.env` via `env_file`.
- Both services use `--reload` (Vite dev server / uvicorn) for instant code reload.

### `docker-compose.backend.yml` — Backend only

Identical backend service definition but without the frontend. Use when you want to run the frontend natively on the host.

**Frontend .env for this setup:**
```
VITE_RENDER_URL=http://localhost:8000
```

### `docker-compose.local.yml` — Local Supabase reference

This file extends the main compose with `host.docker.internal` networking to reach a Supabase instance running on the **host machine** (`npx supabase start`). It is a **reference configuration** only.

**Why it's a reference:**
- Docker containers cannot reach host services via `localhost` — they need `host.docker.internal`.
- For practical local development, run the frontend/backend **natively** and use `.env.development`:

```bash
# Terminal 1: Start local Supabase
cd apps/web && npx supabase start

# Terminal 2: Start frontend + backend natively
cd apps/web && npm run dev
```

---

## Environment Variables

### Backend (`apps/backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Supabase service_role (secret) key |
| `PORT` | ❌ | Backend port (default: `8000`) |
| `FRONTEND_URL` | ❌ | CORS origin (default: `http://localhost:5173`) |

### Frontend (Vite — `apps/web/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase publishable (anon) key |
| `VITE_RENDER_URL` | ✅ | Backend API URL — **must be `http://backend:8000` in Docker** |

---

## Docker Images

### Frontend (`apps/web/Dockerfile`)

```dockerfile
FROM node:22-alpine AS builder
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine
COPY --from=builder /app/node_modules ./node_modules
COPY . .
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
```

- **Two-stage build** — dependencies installed in builder, only artifacts in runtime.
- **Development only** — runs Vite dev server. For production, build with `npm run build` and serve via Nginx/CDN.
- **Volume mounts** — source directories are mounted from the host for instant HMR.

### Backend (`apps/backend/Dockerfile`)

```dockerfile
FROM python:3.12-slim
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
COPY templates/ ./templates/
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- **`python:3.12-slim`** — minimal, no C-ext compilation needed (pure Python, openpyxl removed).
- **Hot-reload** — `uvicorn --reload` watches mounted `src/` for changes.

### `.dockerignore` (`apps/backend/`)

```
__pycache__/
.env
.git
*.pyc
.DS_Store
```

Prevents local artifacts and secrets from leaking into the Docker build context.

---

## Building for Production

### Build and tag images

```bash
# Tagged builds for registry push
docker build -t otis-frontend:latest ./apps/web
docker build -t otis-backend:latest ./apps/backend
```

### Push to registry (example)

```bash
docker tag otis-frontend:latest ghcr.io/wrassee/otis-frontend:latest
docker tag otis-backend:latest ghcr.io/wrassee/otis-backend:latest
docker push ghcr.io/wrassee/otis-frontend:latest
docker push ghcr.io/wrassee/otis-backend:latest
```

### Production compose with built images

Create a `docker-compose.prod.yml` that uses pre-built images (no `build:` section) and a static file server for the frontend (Nginx). The current `docker-compose.yml` is development-oriented — it runs the Vite dev server, not a production build.

---

## Architecture Diagram (Docker)

```
┌──────────────────────────────────────────────────┐
│                  docker-compose.yml               │
│                                                    │
│  ┌─────────────────┐     ┌──────────────────┐     │
│  │   frontend       │     │   backend         │     │
│  │   :5173          │     │   :8000           │     │
│  │                  │     │                   │     │
│  │  Vite dev server │────▶│  FastAPI + uvicorn│     │
│  │  HMR via mounts  │     │  --reload via mount│     │
│  └─────────────────┘     └────────┬──────────┘     │
│                                    │                │
│                           ┌────────▼──────────┐    │
│                           │  Supabase Cloud    │    │
│                           │  (external)        │    │
│                           └───────────────────┘    │
└────────────────────────────────────────────────────┘
```

Services communicate via Docker Compose DNS:
- `http://backend:8000` — frontend → backend
- Backend reads Supabase keys from `env_file: ./apps/backend/.env`

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend can't reach backend (`Failed to fetch`) | `VITE_RENDER_URL` points to `localhost` instead of `http://backend:8000` | Set `VITE_RENDER_URL=http://backend:8000` |
| Backend can't reach Supabase | Missing `env_file: ./apps/backend/.env` with valid keys | Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env` |
| Changes not reflecting in container | Volume mount not working | Check paths in `volumes:` section — must be absolute or relative to compose file |
| `docker compose up` fails with port conflict | Port 5173 or 8000 already in use | Stop other instances: `docker compose down` or change ports |
| `uvicorn --reload` not detecting changes | Source files on Windows have CRLF → Linux LF conversion issues | Add `git config core.autocrlf input` and re-clone |
| Backend Python errors after pulling | Dependencies changed | Rebuild: `docker compose build --no-cache backend` |
