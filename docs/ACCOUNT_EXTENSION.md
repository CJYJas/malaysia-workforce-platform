# Account and Learning Persistence

The account API adds email/password accounts, server-persisted pathway-step status, traceable lesson-completion evidence, and versioned role roadmaps. It does not replace the existing role-match calculation or create a new lesson catalog. Guest/browser-local learning behavior remains available.

## Security and behavior boundaries

- The standard Docker bootstrap starts `app.extension_entrypoint:app`, which mounts account routes while preserving the existing API routes. Account operations remain disabled until `AUTH_ENABLED=true`.
- `AUTH_ENABLED` defaults to `false`; account routes return 404 while disabled.
- Passwords are hashed with Argon2. Access tokens are short-lived HMAC-signed values in HTTP-only cookies. Refresh tokens are opaque, stored only as hashes, rotated after use, and reuse revokes their token family.
- Mutating requests require an allowed `Origin` and a CSRF token in `X-CSRF-Token`. Configure the exact browser origins, HTTPS, secure cookies, and a same-origin reverse proxy in production.
- The frontend continues to keep its original profile in browser storage. Account profile synchronization occurs when a pathway is loaded or its status is changed. Guest pathway progress remains browser-local.
- `lesson_completed` evidence is derived server-side from actual course-catalog `skills_gained` tags. Client-submitted skill lists are ignored. A catalog course ID maps only to that course's tags; a pathway skill ID such as `step-python` maps only when a canonical catalog tag normalizes to that skill. Unmatched items return `mapping_status: "no verified mapping"` and award no skills. Completion is not assessed proficiency and does not change role-match scores.
- Evidence records retain the canonical skill, catalog record ID, and original catalog tag. The separate roadmap evidence percentage is completed mapped skill gaps divided by the role's current mapped skill gaps; it is not the existing role-match score.
- Roadmap snapshots are deterministic for matching inputs, versioned on material changes, and retain their prior snapshots. Requirements without matching source courses are returned as unresolved gaps.
- PostgreSQL is the production database. SQLite is supported for local use; its account tables are created automatically when the account-enabled app starts with a SQLite `DATABASE_URL`. PostgreSQL remains migration-only.

## Known Limitations

- Duplicate registration returns HTTP 409, which can reveal whether an email is already registered.
- Profile restoration across devices, password reset, email verification, MFA, and account deletion are out of scope.
- No backup/restore procedure or account-retention/deletion workflow is implemented. Production deployments must establish these operational procedures before launch.

## Configure and migrate

1. Provision PostgreSQL with TLS and a dedicated least-privilege application role. Set `DATABASE_URL` to a `postgresql+psycopg://` URL.
2. Copy `.env.example` to a deployment-managed environment and set:
   - `AUTH_ENABLED=true`
   - `DATABASE_URL` to the PostgreSQL connection string
   - `AUTH_SIGNING_KEY` to at least 32 random bytes (generate, for example, with `python -c "import secrets; print(secrets.token_urlsafe(48))"`)
   - `AUTH_ALLOWED_ORIGINS` to a comma-separated exact allowlist
   - `CORS_ORIGINS` to the same exact frontend origins, not `*`
   - `AUTH_COOKIE_SECURE=true` in HTTPS environments; `false` is only for local HTTP development
3. Apply the initial schema to a new database. When upgrading an existing account database, apply the evidence migration after the initial schema:

   ```sh
   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0001_accounts_learning.sql
   psql "$MIGRATION_DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/0002_lesson_completion_evidence.sql
   ```

   `MIGRATION_DATABASE_URL` uses the standard `postgresql://` libpq scheme with the same host/database/credentials as `DATABASE_URL` (omit SQLAlchemy's `+psycopg` suffix). The second migration is safe after an updated initial schema and clears old client-supplied skill claims that cannot be verified. These are manual SQL migrations; no automatic schema creation or Alembic runner is included.
4. Start the account-enabled API (the standard Docker bootstrap uses this entrypoint):

   ```sh
   uvicorn app.extension_entrypoint:app --host 0.0.0.0 --port "${PORT:-8000}"
   ```

   The original `/health` and role-matching routes remain available. Importing the base API also runs its existing configuration and data/retriever initialization behavior.
5. Route the frontend's `/api/py/*` requests to this FastAPI service and strip `/api/py`. The existing Vite development and preview proxy already applies that mapping and can target the service using `BACKEND_API_URL`. For production, configure the equivalent same-origin proxy and forward the browser `Origin` header. Do not expose the database or signing key to the browser.

### Local SQLite setup (Windows PowerShell)

From the repository root, configure SQLite for local-only account testing and start the same account-enabled entrypoint:

```powershell
$env:DATABASE_URL = "sqlite+pysqlite:///./local_dev.db"
$env:AUTH_ENABLED = "true"
$env:AUTH_SIGNING_KEY = (python -c "import secrets; print(secrets.token_urlsafe(48))")
$env:AUTH_COOKIE_SECURE = "false"
$env:AUTH_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:8000"
$env:CORS_ORIGINS = '["http://localhost:5173","http://127.0.0.1:5173","http://127.0.0.1:8000"]'
python -m uvicorn app.extension_entrypoint:app --host 127.0.0.1 --port 8000 --reload
```

The app creates SQLite tables during startup. This automatic initialization does not apply to PostgreSQL; apply both SQL migrations manually before enabling production accounts. Account requests require an allowlisted `Origin` header. Authenticated mutations also require `X-CSRF-Token` from the registration/login response. Swagger UI at `/docs` does not automatically populate this CSRF header; set it for authenticated write requests. Direct PowerShell or `curl` calls must include `Origin` explicitly.

## HTTP contract

All account routes are added to the existing FastAPI service:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create an account and issue session cookies |
| `POST` | `/auth/login` | Authenticate and issue session cookies |
| `POST` | `/auth/refresh` | Rotate refresh token and CSRF cookie |
| `POST` | `/auth/logout` | Revoke the active session and clear cookies |
| `GET` | `/auth/me` | Return the authenticated account |
| `GET`, `PUT` | `/me/profile` | Read or synchronize the authenticated profile and target role |
| `GET` | `/me/lessons` | List the user's saved lesson/pathway statuses |
| `PUT` | `/me/lessons/{item_id}/completion` | Save `not_started`, `in_progress`, or `completed` status |
| `GET` | `/me/skill-evidence` | Return mapped and unmapped self-reported completion evidence |
| `GET` | `/me/roadmap` | Get or reconcile the current empirical roadmap |
| `POST` | `/me/roadmap/reconcile` | Explicitly reconcile the current roadmap |

Registration/login accept `{"email":"person@example.com","password":"at-least-12-characters"}`. Successful authentication returns `{"user":{"id":"…","email":"…"},"csrf_token":"…"}`; session credentials are set as cookies. `PUT /me/profile` accepts `target_role`, `skills` (objects containing a skill `name` and optional `level`), optional `experience_years`, and optional `education`.

The lesson update body is:

```json
{
  "status": "completed",
  "item_type": "pathway_step",
  "title": "Existing pathway step title",
  "skills": ["legacy client values are ignored"]
}
```

`item_type` may be `pathway_step` or `course`. The `skills` field remains accepted for request compatibility but is never used as evidence. A successful response includes `item_id`, `status`, `completed`, `completed_at`, `evidence_type`, `mapping_status`, `mapped_skills`, `unmapped_skills`, and catalog `evidence_sources`. Unmatched items return `"no verified mapping"` with no awarded skills. A `roadmap_error` string is included when progress is saved but current job data cannot produce a roadmap; the client must show the warning. All records are scoped to the authenticated user; item IDs are unique per user.

Known errors use HTTP 401 for missing/invalid sessions, 403 for Origin/CSRF rejection, 404 while disabled, 409 for duplicate email or missing target role, 422 for invalid input/insufficient role evidence, 429 for rate limiting, and 503 when account storage/signing configuration or required market data is unavailable. Do not treat a successful browser-side optimistic update as saved if the API reports an error.

## Persistence and provenance

`migrations/0001_accounts_learning.sql` creates the initial schema. `migrations/0002_lesson_completion_evidence.sql` adds catalog-source evidence and clears previous client-supplied skill claims because they cannot be verified:

- `users`: normalized unique email, Argon2 password hash, account state and creation time.
- `refresh_sessions` and `refresh_tokens`: session families, CSRF hash, expiration/revocation, and hashed one-time refresh tokens.
- `auth_attempts`: hashed email/IP rate-limit fingerprints and attempt timestamps; no submitted profile text is logged.
- `learner_profiles`: target role and learner-supplied profile attributes.
- `lesson_completions`: status, item identity/type/title, catalog-derived canonical skills, unmapped catalog tags, source record references, evidence type, and timestamps.
- `roadmap_snapshots`: versioned JSON payload, input fingerprint, change reason, and one active snapshot per user.

Use PostgreSQL backups with encryption and access controls. Define retention and deletion procedures for user account/profile data and auth-attempt records before production launch. The initial migration is not a substitute for a reviewed production data-retention policy.

## Tests and CI

Run the backend suite from the repository root:

```sh
python -m pytest tests -v
```

Account tests are in `tests/test_auth_extension.py`; they use an in-memory SQLite database for account, cookie, CSRF, ownership, catalog-derived progress/evidence, refresh-replay, and profile/reconciliation checks. They do not replace a PostgreSQL migration/integration test.

Run frontend TypeScript validation from `frontend/`:

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
```

Run the frontend account-request contract tests from `frontend/`:

```sh
pnpm --filter @workspace/scripts run test:account
```

The repository's existing frontend behavior tests are Node scripts under `frontend/scripts` and are documented in the root README; there is no configured React component test runner. The GitHub Actions workflow at `.github/workflows/extension.yml` runs the full Python tests, frontend workspace typecheck, and account API contract tests on pushes and pull requests.

## Deployment review checklist

- [ ] `AUTH_ENABLED=true` only after both migrations and secret provisioning.
- [ ] Production signing key is random, private, stable across replicas, and rotated through a planned session-invalidation procedure.
- [ ] `AUTH_ALLOWED_ORIGINS` and `CORS_ORIGINS` contain only the deployed browser origin(s).
- [ ] TLS is enabled and `AUTH_COOKIE_SECURE=true`.
- [ ] `/api/py` is proxied to the account-enabled FastAPI entrypoint; cookie path and forwarded Origin remain same-origin.
- [ ] PostgreSQL backups, restore drills, access control, and user-data retention are defined.
- [ ] Health checks, database connectivity, and migration state are monitored without logging email/password/profile contents.
- [ ] Product copy continues to distinguish learning completion from assessed proficiency and hiring readiness.
