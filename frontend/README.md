# FutureReady MY — Malaysia Tech Workforce

This folder contains the pnpm workspace for the FutureReady MY frontend and its read-only workforce snapshot adapter, integrated with the Python backend in the repository root.

The frontend provides profile intake, sourced skills/radar evidence, explainable role matches, pathway progress, courses, SDG alignment, and uncertainty scenarios. The adapter uses the disclosed repository snapshot described in `docs/DATASETS.md`; it is not a replacement or live integration for the Python API at `../app`.

## Run locally

From this directory, install dependencies and verify types:

```sh
pnpm install
pnpm run typecheck
```

In separate terminals, start the API adapter and frontend:

```sh
# Terminal 1 — API Snapshot Adapter (http://localhost:5000)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — FutureReady MY Frontend (http://localhost:5173)
pnpm --filter @workspace/workforce run dev

# Terminal 3 — Python FastAPI Intelligence Engine with account routes (http://localhost:8000)
# From repo root:
uvicorn app.extension_entrypoint:app --host 0.0.0.0 --port 8000 --reload
```

To build all production bundles:

```sh
pnpm -r --if-present run build
```

### Local account API (Windows PowerShell)

From the repository root, configure local SQLite account storage and start the account-enabled FastAPI entrypoint:

```powershell
$env:DATABASE_URL = "sqlite+pysqlite:///./local_dev.db"
$env:AUTH_ENABLED = "true"
$env:AUTH_SIGNING_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
$env:AUTH_COOKIE_SECURE = "false"
$env:AUTH_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8000"
$env:CORS_ORIGINS = '["http://localhost:5173","http://127.0.0.1:5173","http://127.0.0.1:8000"]'
python -m uvicorn app.extension_entrypoint:app --host 127.0.0.1 --port 8000 --reload
```

SQLite tables are created at startup; production PostgreSQL tables must be created with the documented manual migrations. Account routes reject requests without an allowlisted `Origin`; authenticated mutations also require `X-CSRF-Token` from the registration/login response. Swagger UI at `/docs` does not automatically attach that CSRF header, and command-line requests must supply `Origin` explicitly.

### Backend & Frontend Connection
- **Vite Proxy Layer (`vite.config.ts`)**: In development, Vite automatically proxies `/api` requests to the API Snapshot Adapter (`http://127.0.0.1:5000`) and `/api/py` requests to the Python FastAPI backend (`http://127.0.0.1:8000`), preventing CORS friction.
- **Client Query Layer (`@workspace/api-client-react`)**: TanStack Query hooks handle real-time fetching, caching, deduplication, and error recovery across all views (Market Overview, Demand Radar, Role Matches, Learning Pathways, and Course Catalog).
- **Default Ports**: `5173` for web frontend, `5000` for API adapter snapshot service, `8000` for Python FastAPI intelligence engine. Override via `API_SERVER_URL` and `BACKEND_API_URL` environment variables if needed.

## Verification & Tests

Run the client-side state and data model verification suites:

```sh
pnpm --filter @workspace/scripts exec tsx --test test-profile-storage.mjs test-journey-flow.mjs test-match-view.mjs test-course-catalog.mjs test-plan-summary.mjs test-learning-progress.mjs
```

When the API server is running on port 5000, you can also run the Python contract verification tests:

```sh
python scripts/test-workforce.py
python scripts/test-journey.py
python scripts/test-course-api.py
```

See `docs/FRONTEND.md`, `docs/COURSES-LEARNING.md`, and `docs/VERIFICATION.md` for architectural details, dataset constraints, and verification milestones. The app requires no external databases or credentials for local development.
