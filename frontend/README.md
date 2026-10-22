# FutureReady MY — Malaysia Tech Workforce

This folder contains the pnpm workspace for the FutureReady MY frontend and its read-only workforce snapshot adapter. It is added alongside the original Python backend in the repository root; the backend files are unchanged.

The frontend provides profile intake, sourced skills/radar evidence, explainable role matches, pathway progress, courses, SDG alignment, and uncertainty scenarios. The adapter uses the disclosed repository snapshot described in `docs/DATASETS.md`; it is not a replacement or live integration for the Python API at `../app`.

## Run locally

From this directory, install dependencies and generate the API clients:

```sh
pnpm install
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
```

In separate terminals, start the API adapter and frontend:

```sh
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/workforce run dev
```

The adapter serves `/api/workforce`; the frontend uses the configured base path and same-origin API routes.

## Verify

See `docs/FRONTEND.md`, `docs/COURSES-LEARNING.md`, and `docs/VERIFICATION.md` for setup, dataset limits, and the checks run for this snapshot. The app does not require accounts or a database for this proof of concept.
