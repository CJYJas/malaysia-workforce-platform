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
```

To build all production bundles:

```sh
pnpm -r --if-present run build
```

The adapter serves `/api/workforce` and `/api/journey`; the frontend connects via same-origin/configured API routes. Default ports (`5173` for web, `5000` for API) and base paths (`/`) are automatically applied without requiring manual environment variables.

## Verification & Tests

Run the client-side state and data model verification suites:

```sh
node --test scripts/test-profile-storage.mjs
node --test scripts/test-journey-flow.mjs
node --test scripts/test-match-view.mjs
node --test scripts/test-course-catalog.mjs
node --test scripts/test-plan-summary.mjs
```

When the API server is running on port 5000, you can also run the Python contract verification tests:

```sh
python scripts/test-workforce.py
python scripts/test-journey.py
python scripts/test-course-api.py
```

See `docs/FRONTEND.md`, `docs/COURSES-LEARNING.md`, and `docs/VERIFICATION.md` for architectural details, dataset constraints, and verification milestones. The app requires no external databases or credentials for local development.
