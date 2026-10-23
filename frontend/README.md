# FutureReady MY — Malaysia Tech Workforce

This folder contains the pnpm workspace for the FutureReady MY frontend and its read-only workforce snapshot adapter. It is added alongside the original Python backend in the repository root; the backend files are unchanged.

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

# (Optional) Terminal 3 — Python FastAPI Intelligence Engine (http://localhost:8000)
# From repo root:
uvicorn app.api:app --host 0.0.0.0 --port 8000 --reload
```

To build all production bundles:

```sh
pnpm -r --if-present run build
```

### Backend & Frontend Connection
- **Vite Proxy Layer (`vite.config.ts`)**: In development, Vite automatically proxies `/api` requests to the API Snapshot Adapter (`http://127.0.0.1:5000`) and `/api/py` requests to the Python FastAPI backend (`http://127.0.0.1:8000`), preventing CORS friction.
- **Client Query Layer (`@workspace/api-client-react`)**: TanStack Query hooks handle real-time fetching, caching, deduplication, and error recovery across all views (Market Overview, Demand Radar, Role Matches, Learning Pathways, and Course Catalog).
- **Default Ports**: `5173` for web frontend, `5000` for API adapter snapshot service, `8000` for Python FastAPI intelligence engine. Override via `API_SERVER_URL` and `BACKEND_API_URL` environment variables if needed.

## Verification & Tests

Run all 52 client-side state and data model verification suites:

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
