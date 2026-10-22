# Frontend setup and integration

## Run

Use the managed `artifacts/api-server: API Server` and `artifacts/workforce: web` workflows.
The services use the configured `PORT` and the frontend uses `BASE_PATH`.
The same-origin adapter is mounted under `/api/workforce`. There is no hardcoded localhost URL in browser code.

```sh
pnpm install
pnpm --filter @workspace/api-spec run codegen
pnpm run typecheck
python3 scripts/test-workforce.py
python3 scripts/test-journey.py
node --test scripts/test-profile-storage.mjs
node --test scripts/test-journey-flow.mjs
node --test scripts/test-match-view.mjs
node --test scripts/test-learning-progress.mjs scripts/test-course-catalog.mjs
python3 scripts/test-course-api.py
```

Both Python verification commands require the API workflow to be running. They use only the Python standard library. Run them directly: unittest discovery does not discover these hyphenated filenames. No new packages, AI credentials, database or runtime GitHub credentials are needed.

The profile-storage suite uses Node 24's built-in test runner and TypeScript stripping; no package installation is required. For a standalone frontend production-build check, provide the artifact's required process settings, for example `PORT=21728 BASE_PATH=/ pnpm --filter @workspace/workforce run build`. This does not save project environment settings or publish the app.

The current presentation and navigation follow the FutureReady MY PRD. See `JOURNEY.md` for canonical aliases, staged page limits and the expanded browser-only profile context; see `PRD-AUDIT.md` for the adoption baseline.

## Refresh the source snapshot

Clone the source into a separate directory, never over this workspace:

```sh
git clone --depth=1 https://github.com/CJYJas/malaysia-workforce-platform.git /tmp/workforce-source
python3 scripts/import-workforce.py /tmp/workforce-source
```

The importer writes the bounded API snapshot and machine-readable inventory. It reads the Git revision, source metadata, source taxonomy, source thresholds and actual CSV records. It fails explicitly if expected fields/encoding/config layout change; it does not silently insert demo data. Inspect its output before restarting the API. Raw datasets and model embeddings do not enter this project's source tree.

## Local frontend adapter contract

The single contract source is `lib/api-spec/openapi.yaml`.

- `GET /api/workforce/overview`: role metadata, provenance, coverage, processing counts, licenses and limitations.
- `GET /api/workforce/demand?role=<canonical role>`: recorded top skills with calculated shares and denominator. Unknown/missing roles return HTTP 400.
- `GET /api/workforce/courses?skill=<skill>`: actual indexed course records, matching rationale and disclaimers. Unknown skills return no indexed records, not invented recommendations.

This adapter is **not** a replacement for the Python backend and does not pretend to expose its full API. Frontend hooks use `@workspace/api-client-react`. Responses and requests are validated using generated `@workspace/api-zod` schemas. The snapshot is bundled into the API service; no runtime download or token is required.

## Later RunPod connection

See [JOURNEY.md](JOURNEY.md) for the working stateless personal journey, scoring assumptions, source-refresh behavior, browser storage and SDG mapping. It is not a claim that the separate Python backend has been connected.

The repository's documented FastAPI contract includes `/health`, `/metadata`, `/roles`, `/skills/demand`, `/skills/trends`, `/roles/compare`, `/profile/analyze`, `/roles/match`, and `/roadmap/generate`. Verify the deployed API's OpenAPI before integrating; do not assume documentation examples describe a live response.

A subsequent milestone should configure a deployment-wide upstream URL (not a browser-supplied arbitrary proxy URL), validate it and use server-side requests if CORS/auth requires that. Avoid logging user profile bodies. Preserve AI-off operation and transparent upstream errors. No live connection has been configured or verified here.

## Checks and limits

See `docs/VERIFICATION.md` for actual check results. Repository/backend test claims in the upstream README have not been adopted as our results. The backend test directory and raw JobStreet input are missing from the inspected revision.
