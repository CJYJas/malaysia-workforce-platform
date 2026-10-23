# First frontend milestone verification

## Executed checks

- `python3 scripts/import-workforce.py /tmp/workforce-source` — completed successfully. Counted the three available CSV files, read the source metadata/config/taxonomy, generated the bounded snapshot and source inventory.
- `pnpm --filter @workspace/api-spec run codegen` — completed successfully, including shared-library TypeScript compilation.
- `pnpm run typecheck` — passed across shared libraries, API server, frontend, sandbox and scripts after the completed implementation.
- `python3 scripts/test-workforce.py` — **13 tests passed**, including all supported-role API responses, missing/invalid parameters, case-normalized course lookup, explicit no-indexed-records behavior, count reconciliation, denominator arithmetic, rank ordering, warning thresholds, source-record identifiers and safe course URLs.
- Both managed application workflows started successfully. API and frontend logs showed successful startup; the captured browser console showed no application errors.
- Desktop screenshot at 1440×1080 and mobile screenshot at 390×844 rendered the initial dashboard, real snapshot counts and responsive navigation.

The first API check found that generated query-string coercion accepted a missing skill as the literal string `"undefined"`. Explicit string/nonblank guards were added to both endpoints before schema validation, and the full 13-test suite then passed.

## Not verified

- No automated UI interaction/end-to-end tests or separate code review were run for this first build. Screenshots verify initial rendering, not clicking, typing, CSV downloads or every route state.
- No live RunPod health, deployment, authentication, CORS or API response was tested: no upstream URL was provided.
- The upstream README's test totals are not our results. The Python backend's tests directory is absent from the inspected source revision, so its claimed suite could not be executed.
- The raw JobStreet data is absent. Job-processing counts and role mentions are traceable source-metadata claims, not independent row-level reprocessing results.
- Processed Parquet schema, Malaysia location quality, deduplication correctness and extraction correctness were not independently verified.
- Upstream licensing, present course availability/prices/languages/accessibility and current job-market conditions remain unverified.
- Profile matching, personalized pathways and SDG mappings are intentionally not implemented in this milestone. No results for those features are simulated.

Stop here for review before proceeding to the next milestone.

## Reference-based visual restyle

The frontend was restyled to follow the supplied learning-dashboard reference while retaining the existing API contract and snapshot data. Exact source-based before/after previews are preserved on the design canvas; their data comes from the same repository snapshot, with routing/API integrations isolated for presentation.

- Full workspace `pnpm run typecheck` passed, including both isolated previews.
- The complete available `python3 scripts/test-workforce.py` suite passed: 13 tests.
- Frontend and component-preview workflows restarted successfully; both isolated preview routes responded successfully.
- The live dashboard rendered at 1440×1050, and the real Python course-results route rendered at 390×844. Captured browser consoles contained no application errors.
- No automated interaction tests were run. Backend/data behavior and the earlier RunPod/licensing verification limits remain unchanged.

## Complete personal journey proof of concept

This later milestone adds the six required capabilities; it supersedes the earlier read-only milestone scope.

### Available suite and runtime checks

- Full workspace `pnpm run typecheck` passed after integration. The final role-navigation fix also passed the frontend typecheck.
- `python3 scripts/test-workforce.py`: **13 passed**.
- `python3 scripts/test-journey.py`: **13 passed**. Coverage includes newcomers, profile rejection, duplicate/alias handling, unrecognised skills, score components, all scenarios, all five role pathways, time calculations, plan identity, free-reading references, SDG associations and source provenance.
- A real source refresh succeeded against the WEF digest through the disclosed public text transport, producing 14 attributed skills/roles signals. Publication remains 7 January 2025; retrieval/check times are separate.
- Managed API/frontend workflows restarted successfully. The live home rendered at 1440×1050 with no application errors in its captured browser console.

### Automated browser journey

An isolated browser context verified:

- Profile interest validation; Python/SQL level selection; experience, interests and weekly time; explicit save and persistence after reload.
- Rising/declining skills and roles, visible source dates, real refresh action, global/local distinction and all 17 official UN goal links.
- Five ranked role families, readiness components, skill gaps, sample warnings, and changed scores under the AI-acceleration scenario.
- A Data Engineer plan with ordered steps, real resource/course links, SDG explanations, estimates, completion after reload, and no score inflation from checkoffs.
- Profile edits removing a newly working-level ETL gap, changing pacing from 6 to 3 hours/week, and preventing old progress from leaking into the changed plan.
- A valid downloaded JSON plan, responsive controls at 390×844 without document-wide horizontal overflow, cancel/accept reset behavior, no-profile guards, and the Methodology-to-Radar redirect.

The initial pass found that a plan opened with a role query could not switch roles. The selector now updates its URL and subscribes to query changes. A focused follow-up verified Data Engineer → Software Developer → Data Engineer, separate completion states, restored prior progress, and role/scenario/progress persistence after reload. No full second pass was run over unchanged flows.

The browser checks reported no application page/console errors. Individual external course availability/pricing was not exhaustively checked; the UI explicitly treats those records as historical alternatives.

### Remaining proof-of-concept limits

Intake is a form, not a CV parser. Profiles and progress are browser-only, not account-synced. Five technical role families are covered. Readiness and time estimates are disclosed heuristics; scenarios are assumptions, not probabilities. The source is a refreshable fixed annual global report, not a live Malaysian vacancy forecast or an automatic newer-edition discovery service. Original Python/RunPod integration, missing upstream test/raw-data verification and dataset licensing review remain unchanged. No GitHub push or public deployment was performed.

Stop here for review before further feature expansion.

## Approved Fieldnotes design graduation

Applied the user's approved evergreen/paper/chartreuse Fieldnotes treatment to the full working journey, rather than replacing it with the role-only atlas prototype. The six core features, API contracts, matching/scenario calculations, profile storage, plan progress and downloads are unchanged. The original isolated atlas preview remains available for reference.

Typography is 14px body, navigation and controls; supporting labels and previous 8–12px utility text are raised to 13px. Headings remain larger. At wide desktop widths the guide alongside the content explicitly links all six requirements; at smaller sizes the working navigation remains available in a scrollable strip.

Frontend typecheck passed. Screenshots verified the home at 1440×1050 and profile intake at 390×844, with no captured application console errors. No second full journey browser run was warranted for this presentation-only change; the previous functional verification remains applicable. External font imports are consolidated before other CSS statements to avoid the build-time late-import warning.

## Central dashboard, without sidebars

Following user feedback, both global sidebars are removed. The home dashboard now provides six whole-card links to profile, radar, matches, pathway, SDGs and scenarios, plus course/historical/compare tools. The shared header provides Dashboard and Your profile links on every route. SDGs and scenarios have dedicated routes reusing the existing catalog, goal explorer, scenario picker and saved scenario state. Dashboard navigation is no longer blocked while the catalog loads.

Frontend typecheck passed after restoring the role-detail chevron import caught by the first check. The managed frontend restarted cleanly. Screenshots at 1440×1100 (dashboard) and 390×844 (profile) confirmed the sidebar-free layout, readable text, mobile header, and a successfully loaded intake form without application console errors. The catalog endpoint returned HTTP 200; the screenshot's earlier intake loading error was not reproducible. No backend change or claim of a permanent source-error fix is made.

## Whole-app notebook redesign

Reworked the app around the user's ruled-paper reference: expressive ink headings, yellow labels, tactile borders/shadows, and blue/pink/green accents. No global sidebars were reintroduced. The profile now has three intake chapters, the Radar leads with a source docket and separate skill/role chapters, matches separate scenario setup from the ranked shortlist, and pathways separate planning setup from the ordered route and supporting evidence. Shared headings, controls, feedback, supporting routes and responsive navigation use the same treatment.

- Preserved a source-based isolated dashboard baseline before redesign; sandbox typecheck passed.
- Frontend typecheck passed after the complete changes. Managed frontend restart was successful.
- Desktop dashboard and 390×844 profile screenshots rendered without application console errors. An old hero background utility initially caused dark-on-dark text; removing that obsolete utility was confirmed by a corrected dashboard screenshot.
- A single isolated browser regression passed profile entry/save, all six distinct dashboard routes, Radar skill/role directions and provenance, all 17 official SDG links, scenario selection after reload, five real role matches and component explanations, plan generation, checkoff persistence, cross-role isolation/restoration, and parsed plan JSON download.
- The same browser pass confirmed mobile profile/pathway navigation and no document-wide horizontal overflow. No page/console errors were captured.
- The browser's source-refresh request returned cached data, not a demonstrated new retrieval. Added an explicit live outcome message distinguishing refreshed, cached, bundled and unavailable reports without claiming new data; the existing dates and source-error notes remain authoritative. This final, small feedback change passed typecheck and did not change backend retrieval behavior.

All six required capabilities remain intact. Existing annual/global-versus-historical/local evidence limits, browser-only persistence and dataset licensing caveats still apply. No GitHub push, backend/schema change or public deployment was performed.

## FutureReady MY PRD — Milestone 2

### Delivered

Replaced the notebook presentation with the adopted PRD's professional navy-sidebar shell, responsive bottom/full navigation, contextual topbar, profile menu, source status and FutureReady MY metadata. Existing routes remain, with canonical aliases for Overview, Radar, Role Explorer, Role Matches and SDGs. Aliases reuse existing views; they do not claim that the later dedicated market pages are complete.

The expanded profile uses three stages with real save, validation, analysis and results navigation. Optional context and unassessed skill names remain alongside—not inside—the API profile. Legacy records, scenario/role preferences and completion keys stay compatible. New guards prevent silent cross-tab overwrites, stale analysis navigation and false reset-success feedback.

### Checks actually run

- `node --test scripts/test-profile-storage.mjs`: **12 passed**, covering legacy reads/no automatic rewrite, context round-trip and request separation, metadata-only preservation, unassessed skill boundaries, limits, corruption, storage failures and independent defaults.
- `python3 scripts/test-workforce.py`: **13 passed**.
- `python3 scripts/test-journey.py`: **13 passed**.
- Full workspace typecheck passed. Final frontend typecheck passed after the last small UI/event-feedback fixes.
- Frontend production build passed using process-scoped `PORT=21728 BASE_PATH=/`; the existing non-fatal tooltip source-map diagnostic remains. No dependencies or persistent environment settings were changed.
- Managed frontend restarted cleanly. Desktop Overview and anonymous phone Profile screenshots loaded without application console errors.

### Focused browser evidence

A fresh isolated context loaded an original version-1 SQL/Working-with-data profile and a real, seeded Data Engineer completion entry. The tester changed assessed proficiency to Not sure and back, added an unassessed Rust skill, completed optional context and desired-skill fields, and verified save/reload. Zero weekly hours were rejected without a matching request.

Captured match input contained assessed skills, supported interests, experience and weekly hours. Display/context fields, written experience, Rust, desired Python and the unsupported Cybersecurity direction were absent. Five actual role matches rendered. The original Data Engineer plan identity and checked first step were restored after optional-context edits.

One deliberately intercepted HTTP 503 produced visible failure feedback, retained saved answers and stayed on Profile; retry succeeded. A delayed analysis response did not navigate after the user left for Courses. Profile menu navigation, all eight main destinations and mobile navigation/Escape worked. A second-tab save preserved the first tab's unsaved draft, blocked overwrite and required explicit loading of the latest saved values.

The tester's overall failure flag came from an over-specified expectation that blank `current_role` must appear in the request. Inspection of the actual OpenAPI schema confirms it is optional (not in `JourneyProfile.required`); the form intentionally omits a blank optional value. That is correct contract behavior, not a missing required field. Nonblank current role serialization is retained in the form.

The phone check measured no document-wide overflow but found the third step partly clipped inside a horizontal strip. Replaced it with a three-column mobile indicator and increased bottom-navigation space, including safe-area allowance. A final 390×844 screenshot confirms all three step labels and bottom navigation labels are visible. The small final event/feedback changes were confirmed by typecheck/build, not another full browser pass.

No unintentional page/console errors were observed in the browser journey; the intentional 503 naturally emitted its failed-resource diagnostic. No live RunPod integration, AI inference, account/cross-device persistence, deployment or GitHub push was added or claimed. Milestone 2 is ready for review; later PRD milestones remain open.

## Guided four-stage journey refinement

User feedback replaced parallel core navigation with a sequential Profile → Radar → Role matches → Pathway flow. Duplicate `/skills` and Methodology-redirect sidebar entries were removed; the genuine supporting tools remain available once each. The home surface now starts/resumes the first incomplete stage rather than presenting six equal journey options.

### Verification

- The 12 new pure journey-state checks and 12 profile-storage checks passed. They cover stage gating, explicit completion, legacy-profile defaults, reloads, metadata independence, changed input/scenario/role invalidation, repeat visits, malformed records and preserving separate learning progress.
- Frontend typecheck and production build passed. The previously documented non-fatal tooltip source-map diagnostic remains. The final sidebar-label adjustment was copy-only.
- Desktop Overview screenshot loaded successfully with no application console errors, and the managed frontend restarted cleanly.
- One focused browser journey confirmed that direct future-stage URLs show prerequisites without API calls; hours=0 is rejected; Profile save continues to Radar without requesting matches; and matches remain gated until the explicit Radar action.
- A deliberate matching HTTP 503 showed a retry state with Pathway still locked. Retry returned real scored roles. Choosing Data Engineer generated a successful actual pathway and completed the fourth setup stage, while its learning checklist still correctly began at 0/10.
- Checking Python foundations changed the checklist to 1/10; reload preserved it. Display-name-only save triggered no matching request and retained journey flags and the checked step. Returning through Radar preserved downstream completion. A different-role pathway deep link required match review instead of silently requesting a new plan.

The initial phone pass reported 412px document width at a 390px viewport. A focused follow-up in the retained completed context after removing duplicated numeric label text could not reproduce it: document/body scroll widths and client width were all 375px, with the remaining 15px being the vertical scrollbar. No descendant extended beyond client width and no relevant pseudo-element was found. The specific cause of the earlier measurement is unconfirmed; no speculative CSS clipping workaround was added.

That same focused follow-up completed the mobile checks: full labels in the open drawer, navigation to Profile, reopening and Escape-to-close while keeping the same profile/journey context. The home primary link was inspected in code rather than exercised in the browser pass (the tester entered Profile through the prerequisite CTA). No full second journey was rerun.

No backend/schema changes, private-context transmission, GitHub push or publishing occurred. Guided setup completion means the plan is prepared, not that its learning resources have been completed.

## Market-intelligence milestone verification

- All **32** browser-storage/journey/plan-summary model tests passed, including actual step-ID counts, no fabricated initial learning completion, matching-scope summaries, remaining-gap selection and explicit corrupt-storage handling.
- Both Python suites passed: **13 journey API checks + 13 snapshot invariant checks**. A separate live public-catalogue assertion confirmed configured scoring points total 100, canonical aliases and genuine role SDG rationales for all five roles.
- Generated API libraries, frontend and backend typechecks passed. The production frontend build passed with the known non-fatal tooltip source-map diagnostic and a bundle-size advisory. The final catalogue-card refinement separately passed frontend typecheck. Managed API/frontend workflows were restarted after their changes; no new dependencies or secrets were required.
- A fresh desktop screenshot of the running public Role Explorer showed the approved shared shell and no application browser errors. Its catalogue was then refined to one responsive card per role with actual top-skill previews, sample notices and readable dates rather than raw timestamps.

One focused browser pass reused the existing completed Data Engineer profile and learning checklist rather than rerunning or forging the guide:

1. Public catalogue search/sort and Cloud Engineer details worked with the actual 35-posting caution, categories, skill search/sorting, indexed AWS/Google Cloud courses and editorial SDG 7/9/13 rationales. Unknown role IDs displayed “Role not found.” Public exploration did not POST matching/pathway requests or change the confirmed target/guide.
2. Methodology remained its own page. Actual counts reconciled: 69,024 raw, 4,974 duplicates, 198 excluded, 63,852 retained and 1,553 target-role postings. It showed actual 75/15/10 configured readiness points, 18/9/12-hour estimates, dated global versus local evidence, and unresolved redistribution/license notices.
3. Radar deep linking to Data Engineer/SQL selected the intended scope, not an early-loading default role. SQL displayed 78/104 = 75%; valid read-only demand queries matched the displayed Data Engineer and Cloud rows. Cloud selection showed denominator 35 and its small-sample warning without changing the saved Data Engineer context. Category filtering, Terraform search and alphabetical sorting worked. No invented monthly trend appeared; Radar Continue was not activated by the test.
4. The actual Data Engineer pathway retained Python checked at **1/10**. Overview displayed the same 1/10 after navigation and reload, a 174-hour last generated plan and all four setup stages complete. Its unloaded current-match count correctly stayed a dash with “No background analysis” messaging, not an invented count. Saved match/pathway metadata stayed balanced/Data Engineer.
5. At 390×844, completed Overview and Role Explorer both measured 375px client/document/body width, with no horizontal offenders. The remaining 15px was the vertical scrollbar. The mobile drawer showed full labels, navigated to Role Explorer and closed, and reopened/closed correctly.

The tester's initial manual endpoint probes missing the required displayed role-name parameter produced expected 400s, not UI failures. A transient post-restart Vite/HMR resource diagnostic did not persist; the fresh Overview reload and source page rendered without application errors.

No database/account integration, new scoring model, remote inference contract, private-context processing, raw-data refresh, GitHub push or publishing was introduced. Reliable role-level monthly trends and full-course-catalogue title search remain later/upstream work.

## Milestone 4 matching verification

All **41** frontend state/model checks passed, including nine new checks for canonical recognised skills, maximum duplicate/alias levels, nonmutating deterministic sorting, real interest points, evidence filters, unassessed sorting and supported comparison URL resolution. Frontend typecheck and production build passed with the existing non-fatal source-map and bundle-size advisories. A final small focus-effect correction passed typecheck separately. The managed frontend was restarted after the code batches.

A fresh public comparison screenshot loaded Data Engineer/Cloud Engineer with the correct independent denominators and real shares, and no application browser errors. No new API/backend changes were made, so the prior backend/invariant results were not needlessly rerun.

### Focused browser pass

- A single intercepted initial matching 503 produced a clear retry state without losing profile/checklist data. Retry returned five real roles, one recognised assessed skill and two limited-sample roles. Data Engineer's actual 37-point result displayed 12/75 skills, 15/15 interests and 10/10 experience; scores were labelled alignment, not hiring probability.
- Score, fully-matched-skill and interest sorts, name search, recorded/limited/unavailable evidence filters and breakdown toggles did not trigger extra matching requests. Limited returned the actual 35/32-posting roles; recorded returned three. Filtered-empty/reset states worked independently of an empty service response.
- SQL's assessed level 2 met the model target; profile-absent skills were described as not recorded/development areas, not proven lack of ability. Expanded details displayed actual configured points and source-backed evidence.
- The initial pass found that role query parameters did not open the intended breakdown. A focused effect now expands a valid requested result and clears filters that would hide it. The follow-up confirmed Cloud focus and internal Role Explorer → Cloud → Check My Match reuse, without another assessment request. Unknown role parameters displayed notices and did not replace Data Engineer as the target. A full hard navigation requesting assessment is expected because results are deliberately memory-only, not a filter-induced request.
- Supported role IDs and legacy displayed-name comparison parameters worked; invalid inputs fell back to supported roles. Local comparison choices did not alter the saved target or request matching. Actual CSV export completed with real shares and “Not in snapshot” values.
- A deliberately delayed AI-acceleration response arrived after Human-centred, but Human-centred retained its own selected scope/results. Explicitly choosing Data Engineer sent the correct `human_centred` plan request. Restoring Balanced/Data Engineer through the UI returned the correct actual plan and original Python **1/10** completion without toggling it. Overview retained 1/10 and all four setup stages complete.
- At 390×844, both Matches and Compare measured 375px document/body/client width: no page-level horizontal overflow. Actual body text measured 14px and labels 13px. Wide evidence tables stayed inside their own horizontal scrollers; the full mobile drawer fit and closed without changing the route.

The tester continued only the failed focus assertion and previously untested comparison/race/mobile flows, not the already-passed retry/filter journey. No tester edited files or restarted workflows. No score weights, remote service, private-context processing, persistence format, learning checklist, database, GitHub push or publishing was introduced by this milestone.

## Milestone 5 learning/SDG verification

- **52 state/model tests passed:** the prior 41 plus six progress migration/status tests and five deduplicated course-index/filter tests. Legacy summary assertions now include the independently counted In progress field.
- **32 API/snapshot checks passed:** `python3 scripts/test-workforce.py` (13), `python3 scripts/test-journey.py` (13), and `python3 scripts/test-course-api.py` (6 with invalid-query subcases). New checks cover independent 205/8,370 counts, disjoint pages, real title/skill/provider/level filtering, exact details, empty/404 handling, query validation, unchanged intake vocabulary and public skill-to-SDG traceability.
- OpenAPI codegen/library checks, API/frontend typechecks and the final frontend production build passed. Existing source-map/bundle-size advisories remain non-fatal. Managed services were restarted after coherent batches and served cleanly; intentionally invalid API tests returned expected 400/404 statuses, not application crashes.

### Browser coverage and fixes

The retained Balanced/Data Engineer plan initially restored Python Completed and the other nine steps Not started from legacy storage. Keyboard selection of ETL In progress survived reload under the **same plan ID**; Overview showed 1/10 complete and one active step. Completed increased the total to 2/10, and Not started restored 1/10. The existing quick-complete action also worked, then was reset. Python's completion was preserved.

The real Python course record opened from the pathway without a matching request, displayed actual supplied metadata and explicit unavailable fields, and returned to the same 1/10 pathway. The provider URL was the actual HTTPS source with safe external-link attributes. Subsequent catalogue checks verified title/skill search, combined facets, clear, paging, URL/detail/back preservation, no matches, unknown-ID handling and automatic recovery after a single injected catalogue GET 503. React Query recovered through a real 200 retry before a manual error control was needed.

The initial mobile check caught scope-count width plus margin exceeding the container by nine pixels. Grid sizing and a correctly sized source-ID column fixed it. The follow-up measured 375px document/body/client widths at a 390×844 viewport with 14px body text; no page-level horizontal overflow remained.

All 17 SDG cards and official links, editorial disclaimers, Goal 9 role rationale, Goal 14's unmapped state, invalid Goal 99 notice, and in-app pathway/role mapping links were verified without changing the target or triggering personal assessment. The browser found that the frontend expected structured skill mappings while the public intake vocabulary was actually strings. A dedicated `skill_sdgs` contract field now exposes existing backend mappings without changing that vocabulary. The final API check and screenshot confirm Goal 9's **4 roles / 31 skills**. The old role course preview's 82 wider-source matches were replaced by the bounded endpoint's actual **8 AWS records**, matching the catalogue.

The last two presentation/data-contract fixes were confirmed by generated types, API regressions, production build and fresh public screenshots, not another full browser pass. No further learning statuses were changed. Browser errors were limited to the intentional 404/503 probes; fresh public screenshots had no application errors. Whole-journey integration, AI-disabled deployment validation and broader release checks remain the explicit Milestone 6 review, not claimed complete here.

No private biography processing, inference integration, course certification, measured SDG impact, accounts, database changes, GitHub push or publishing was introduced. Search does not cover all 8,370 source records; current provider availability and source licensing were not independently verified.
