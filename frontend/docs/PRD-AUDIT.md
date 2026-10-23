# FutureReady MY — PRD adoption audit

Milestone 1 · 23 October 2026 (Malaysia)

**Status:** The sections below record the adoption audit baseline. Milestone 2 has since been implemented; see the completion note at the end and `VERIFICATION.md`. Statements about the notebook preview describe the baseline, not the current UI.

## Decision and scope

The user explicitly selected **“Follow the full PRD, including the sidebar design.”** The newly supplied PRD is the implementation target, including its working FutureReady MY identity, professional dashboard shell and dedicated methodology page. Earlier notebook/no-sidebar and methodology-redirect preferences are superseded. The readable 14px body / minimum 13px supporting-label requirement remains compatible and should be preserved.

This milestone audits the existing implementation. It does **not** replace the interface yet. No application source, API schema, dependency, persistent environment setting, workflow or upstream repository was changed. The existing preview still has its notebook presentation.

Source specification: `attached_assets/Pasted--Product-Requirements-Document-PRD-Malaysia-Tech-Workfo_1792695789075.txt`.

## Files and components inspected

- Workspace/frontend/API package manifests, `replit.md`, and frontend Vite configuration.
- Frontend routing in `artifacts/workforce/src/App.tsx`; existing journey/profile screens and course list/search implementation.
- Express app and health/workforce/journey route definitions.
- `lib/api-spec/openapi.yaml`, including the actual profile and course schemas.
- `config/workforce.json` and scoring/scenario settings in `config/journey.json`.
- The imported snapshot's structure and coverage, machine-readable `docs/source-inventory.json`, and existing dataset/integration/journey documentation.
- Existing Python verification entry points and the available temporary upstream working tree.

The temporary upstream directory currently contains only `.git`, not checked-out source files. This audit did not fetch current GitHub HEAD or revalidate the separate Python backend's implementation. Previous source-import findings are not presented as a fresh upstream inspection.

## What already works and must survive

The current app uses React/Vite, Wouter, TanStack Query, generated API hooks and generated Zod validation. The API is an Express adapter, not the user's FastAPI service.

- Profile creation/editing, recognised/custom skills, proficiency, interests, experience and weekly learning time.
- Deterministic role alignment: configured 75 skill + 15 interest + 10 experience points, with gaps, strengths, evidence and limitations. Not hiring probabilities.
- Real historical role/skill posting shares, qualified comparisons and indexed course retrieval.
- Dated global WEF skill/role outlook, identifiable source refresh/fallback statuses, and explicit separation from Malaysian historical evidence.
- Ordered learning plans, real learning resources/course alternatives, transparent practice-time assumptions and JSON download.
- Browser-only profile, role/scenario preferences and per-plan completion, including role-switch isolation and restoration.
- All 17 official SDG definitions, editorial role/skill associations with rationales, and three uncertain planning scenarios.
- Input validation, recovery states, no raw profile-body logging, AI-off operation and responsive controls.

Do not discard these controllers or replace them with decorative mock data during the shell redesign. Preserve saved data and old deep links through compatible schemas, deliberate migrations and route aliases.

## Actual data availability

| Evidence | Verified local availability | Limitation |
| --- | --- | --- |
| Malaysian posting snapshot | 69,024 raw records reported; 4,974 duplicates and 198 exclusions; 63,852 retained overall | Overall retained count is not the supported technology-role denominator |
| Supported role evidence | 1,553 postings: Software Engineer/Developer 1,326; Data Engineer 104; Data Scientist 56; ML/AI Engineer 32; Cloud Engineer 35 | Minimum threshold 30; warnings below 50. Preserve small-sample notices |
| Coverage | 23 March 2023–8 May 2025; processed 22 October 2026; 19 observed months reported | Global coverage does not establish per-role/per-skill monthly observations |
| Skill observations | Recorded top-ten skills per role, 39 distinct dashboard skills | Unlisted skills are unknown, not zero-demand; no complete skills inventory |
| Courses | Original inventory reports 8,370 records; the adapter retains 228 bounded course entries across skill lookups | Entries are not asserted to be distinct courses. The adapter is not a searchable copy of all 8,370 records |
| Trends | Snapshot explicitly reports unavailable role-level historical trends | Show an explanatory state, not a synthetic line chart or unsupported time filter |
| AI outlook | Separately attributed, refreshable fixed WEF 2025 annual report | Not live Malaysian vacancies or automatic discovery of later editions |

The raw upstream CSVs were not re-imported during this audit. Course counts and processing totals are checked against the retained import/inventory, not newly recomputed from raw postings. JobStreet/Coursera redistribution rights remain unresolved; restricted-source attribution and license caveats must remain visible.

## API contracts and integration gap

The actual same-origin endpoints are:

```text
GET  /api/healthz
GET  /api/workforce/overview
GET  /api/workforce/demand?role=<canonical role>
GET  /api/workforce/courses?skill=<skill>
GET  /api/journey/catalog
GET  /api/journey/signals[?refresh=true]
POST /api/journey/matches
POST /api/journey/pathway
```

Their implemented contract is `lib/api-spec/openapi.yaml`; existing browser hooks should continue using this generated layer.

The PRD's FastAPI `/health`, `/metadata`, `/roles`, `/skills/demand`, `/skills/trends`, `/profile/analyze`, `/roles/match` and `/roadmap/generate` are **proposed endpoint families**, not verified live endpoints. No deployed RunPod base URL, live OpenAPI, CORS/auth requirements or upstream health result has been supplied/verified. Configure and validate the actual connection before adding an upstream adapter; do not fabricate a successful connection or silently swap response shapes.

No new dependency is presently required for the next shell/profile milestone: routing, forms, accessible primitives, icons, querying, schema validation and chart libraries are already installed. Missing **capabilities/contracts**, rather than package installation, are the main work.

## PRD gaps

| Area | Current implementation | Needed change |
| --- | --- | --- |
| Identity and shell | Fieldnotes notebook styling; Dashboard/Profile header | FutureReady MY professional shell, navy collapsible desktop sidebar, mobile navigation, page context and source status |
| Overview | Six-entry feature hub plus basic profile context | `/dashboard`: real state-derived snapshot, target-role direction, demand evidence and actionable next steps |
| Profile | Core matching inputs; no education/status/name/experience-summary fields | Expanded progressive form, schema-compatible metadata, clear analysis submission and data-preserving migration. Explain any fields not used in scoring |
| Radar | WEF outlook at `/radar`; Malaysian top-skill browser at `/skills` | `/skills-radar` led by Malaysian role demand; coverage, documented categories and skill details; separate AI outlook; honest unavailable trend state |
| Role Explorer | Historical role selector and comparison, but no dedicated catalogue/detail route | `/roles` and `/roles/:roleId`, using actual role descriptions, sample sizes, skills, resources and SDG mappings |
| Matches | Five scored role cards with explanations | `/role-matches`, summary, supported sorts/filters, direct role comparison and consistent alignment-score language |
| Pathway | Ordered resource/course steps and boolean completion | Overview counts, unresolved-course-gap language, transparent ordering and not-started/in-progress/completed states without losing existing completion |
| Courses | Skill-index lookup and actual course cards | Title/skill search over explicitly available records, supported metadata filters/detail views and return-to-pathway context; extend the API rather than implying full-catalog search |
| SDGs | All 17 goals and documented associations at `/goals` | `/sdg-alignment`, consistent selection/context and accessible role/skill/pathway connections |
| Methodology | `/methodology` redirects to contextual Radar disclosures | Dedicated page covering data cleaning, denominators, normalization, thresholds, scoring, retrieval, outlook and editorial mapping |
| Connected state | Profile, target role, scenarios and checkoffs shared; some market filters remain page-local | Preserve relevant profile/filter/target-role state across the connected application |

Optional CV extraction, unsupported historical trends, cross-device accounts and unverified forecasts must not be introduced merely to fill visual space. Keep the earlier six core journey capabilities, including uncertainty scenarios, reachable within the PRD navigation.

## Smallest implementation sequence

1. **Milestone 2 — shell and profile:** replace the shared presentation with the approved professional direction; add accessible desktop/mobile navigation and compatible route aliases; extend the profile progressively with safe persistence/schema migration. Reuse all existing matching/plan controllers. Keep other working views functional under the shared shell.
2. **Milestone 3 — market intelligence:** add state-derived Overview, Malaysian-first Radar, Role Explorer/detail routes and data/methodology disclosures, using the existing snapshot and explicit evidence limits.
3. **Milestone 4 — matching:** complete PRD summary, sorting/comparison and evidence handling; integrate a live backend only once its real contract is verified.
4. **Milestone 5 — learning/SDGs:** finish course search/details over disclosed available records, pathway tri-state migration and consistent SDG navigation. Preserve unresolved gaps and per-plan progress.
5. **Milestone 6 — integration/validation:** verify the connected journey, failure/AI-off states, mobile accessibility, traceability and builds; document any remaining upstream or licensing blockers.

Stop for review after each milestone, as the adopted PRD requires. Do not implement all remaining work as one uncontrolled rewrite.

## Verification run in this audit

| Check | Actual result |
| --- | --- |
| `pnpm run typecheck` | Passed across shared libraries, API, sandbox, frontend and scripts |
| `python3 scripts/test-workforce.py` | 13 passed |
| `python3 scripts/test-journey.py` | 13 passed |
| Bare frontend build | Initially failed because the standalone shell lacked required `PORT` |
| `PORT=21728 BASE_PATH=/ pnpm --filter @workspace/workforce run build` | Passed; these values were scoped to this build process, not saved as project settings |

The successful build emitted a non-fatal source-map diagnostic concerning `src/components/ui/tooltip.tsx`; it exited successfully. No dependency or source change was made to conceal it.

No new browser pass was run for this documentation-only audit. The earlier notebook regression remains recorded in `docs/VERIFICATION.md`; it does not validate the still-unimplemented PRD interface. No live RunPod connection, latest GitHub revision, complete raw-dataset reprocessing, source licensing clearance or published deployment was verified. No GitHub push or public deployment was performed.

## Milestone 2 completion

Implemented the FutureReady MY professional shared shell, desktop sidebar, mobile bottom/full navigation, contextual header, profile menu and historical-data status. Canonical route aliases point to working existing views while preserving previous deep links. Notebook styling has been retired.

The progressive three-stage profile now captures optional display/status/education/study/experience context, assessed and unassessed skills, existing matching interests, additional unscored directions, target role, desired skills and weekly learning time. Save and Analyse are separate real actions. Analysis uses the existing API contract and only its actual core inputs; successful analysis navigates to Role Matches.

Legacy profiles receive defaults without an automatic rewrite. Optional metadata does not alter scored inputs or plan identity. Storage failures, analysis failures/retry, abandoned responses and cross-tab overwrite conflicts are handled explicitly. Browser-only privacy and the meaning of Not sure are visible.

Verification: 12 new storage checks plus 26 existing API/data checks passed; workspace typecheck passed, and final frontend typecheck/production build passed. A focused browser pass verified legacy-profile expansion, private-context exclusion from requests, restored original plan completion, analysis failure/retry, stale-response navigation protection, mobile navigation, all eight main destinations and cross-tab conflict resolution. The mobile step-strip clipping identified during that pass was corrected and confirmed with a final phone screenshot. Full results and the corrected optional-field test expectation are in `VERIFICATION.md`.

The richer personal Overview, Malaysian-first Radar, dedicated Role Explorer/detail pages, standalone Methodology, broader course search and later matching/pathway enhancements remain staged work—not completed merely by adding route aliases. The RunPod and licensing limitations still apply. Milestone 2 stops here for user review.

### Subsequent navigation correction from user feedback

The latest user instruction takes priority over the initial eight-item parallel Workspace layout: the core app must guide Profile → Radar → Role matches → Pathway in that order after each stage is completed. The current sidebar/home/progress gates implement that sequence; supporting tools are secondary and nonduplicated. Future Overview or market-page work must preserve this guide, saved completion and separate learning checklists. See `JOURNEY.md` and the guided-refinement section of `VERIFICATION.md`.

## Milestone 3 completion

After the user approved continuing, the market-intelligence milestone added the state-derived Overview, Malaysian-first Radar, public role catalogue/detail routes and a genuine Methodology page. Public configured scoring/planning/alias metadata and role SDG rationales are now served through the additive catalogue contract; no scoring model or private-context transmission was introduced. The guide remains primary, while market browsing does not unlock it or silently change the confirmed target. Existing plan checklists are used for actual Overview learning counts, not replaced by a new progress system.

See `MARKET-INTELLIGENCE.md` for the implemented scope and evidence limits and `VERIFICATION.md` for the checks. Reliable monthly trends, observed raw aliases and full-catalogue course-title search remain unavailable, not fabricated. Milestone 4 matching refinements are the next review boundary; no unverified remote/RunPod contract has been connected.

## Milestone 4 completion

The user approved starting the matching milestone. The active `/role-matches` and compatible `/matches` controller now separates request scope/confirmation from local results presentation. It adds real summary counts, score/fully-matched-skill/interest sorting, search/evidence filters, distinct empty states, source-backed breakdowns and sample cautions. Role query parameters focus a breakdown but do not persist a target; only explicit pathway selection confirms the role. Public comparison resolves supported IDs/names and adds assessed-profile context without running a personal assessment.

The existing matching model, configured weights, API contract, backend, plan identity and stored checklists were preserved. Late/mismatched/unmounted response guards and disabled pending-pathway actions protect scenario changes. The focused browser checks verified retries, local controls, URL focus, comparison/CSV, a delayed scenario race, mobile layout and restoration of Balanced/Data Engineer with its original 1/10 learning completion. See `ROLE-MATCHES.md` and `VERIFICATION.md`.

Milestone 5—course search/details, pathway progress states and SDG consistency—is the next review boundary. No unverified remote backend or inference integration was added.

## Milestone 5 completion

The approved learning/SDG milestone now includes a deduplicated public index search and exact course records, actual metadata facets/pagination, preserved pathway return context, and explicit unresolved-course gaps. Coverage is labelled 205 retained unique records versus the independent 8,370-record source, not a full-catalogue search claim. The original provider links and unavailable metadata remain honest.

Pathway statuses support Not started, In progress and Completed on the existing plan/step/storage identities. Legacy checked booleans restore as Completed. Overview separately reports active learning without treating it as completed, skill proficiency or guide setup.

All 17 SDGs are browsable with official links, documented role/skill editorial rationale and read-only course/role exploration. The public contract now exposes existing skill mappings independently of the unchanged string-based intake vocabulary. SDG mapping navigation is consistent across radar, matches, roles and pathway; no automatic measured-impact claim is made.

The 52 state/model checks, 32 API/snapshot checks, frontend/API typechecks and frontend production build passed. Focused browser verification covered legacy migration/status roundtrips, Overview counts, course details/back, search/facets/pagination/empty/404/retry recovery, responsive layout, SDG valid/unmapped/invalid states and read-only route safety. It found and led to fixes for mobile scope-count overflow, missing public skill mappings and the role preview's mismatched course-count scope. The final metadata/count fixes were checked through contract/API tests, strong frontend types and a fresh goal-page screenshot, not another whole-journey browser replay.

See `COURSES-LEARNING.md` and `VERIFICATION.md`. Milestone 6—integration and validation of the complete journey, failures, AI-disabled operation, source traceability and deployment build—is the next review boundary. Full-source course ingestion, live course availability, license verification and a remote inference contract were not introduced by this milestone.
