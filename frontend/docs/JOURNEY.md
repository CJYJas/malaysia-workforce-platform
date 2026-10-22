# Personal career journey

The proof of concept covers profile intake → future skills/roles radar → explainable role matches → an ordered personal learning plan. All 17 SDGs are explorable, with editorial SDG associations on radar signals, recommended roles, gaps and plan steps. Three explicit what-if scenarios address uncertainty.

## Screens and API

The FutureReady MY shell uses a persistent desktop sidebar, contextual header/profile menu, and mobile bottom navigation plus a full navigation menu. `/dashboard` aliases the journey home at `/`. `/skills-radar` aliases the existing dated outlook at `/radar`; `/role-matches` aliases `/matches`; `/sdg-alignment` aliases `/goals`. `/roles` currently opens the working historical role/skill browser also available at `/skills`. `/courses`, `/compare` and `/scenarios` remain accessible. Old routes and deep links still work.

These aliases are navigation compatibility, not a claim that later PRD milestones are complete. The richer personalised Overview, Malaysian-first Radar, dedicated Role Explorer/detail pages and standalone Methodology page are subsequent work. `/methodology` still redirects to the existing Radar source disclosures.

The contract source remains `lib/api-spec/openapi.yaml`; client hooks and server validation are generated from it.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/journey/catalog` | Intake vocabulary, five role families, scenarios and 17 goal definitions |
| `GET /api/journey/signals` | Attributed, dated global outlook signals |
| `GET /api/journey/signals?refresh=true` | Wait for a source recheck, subject to a one-minute minimum remote-check interval |
| `POST /api/journey/matches` | Validated profile + scenario → ranked roles, weighted points, gaps and SDGs |
| `POST /api/journey/pathway` | Profile + scenario + role ID → ordered steps, resources, time estimates, SDGs and a stable plan ID |

The profile form satisfies the CV upload/form/questionnaire alternative. It does not pretend to parse uploaded CVs. Zero declared skills are supported for newcomers; at least one interest is required. Unknown skills are disclosed and not assigned invented market weights.

## Privacy and persistence

Profiles are saved explicitly in versioned browser storage, not in a server database. Matching inputs are POSTed for calculation but neither retained nor logged. Current role is descriptive, not an inferred employment history. No AI service, account, database or GPU is required.

The expanded profile uses three form stages: About you, Your skills and Your direction. Display name, status, education, field of study, written experience, additional career directions, desired skills and unassessed (“Not sure”) skill names are optional **browser-only context**, stored alongside the unchanged core profile in its existing version-1 envelope. Legacy records without these fields receive empty defaults on read, without an automatic rewrite. Invalid extra context does not discard a valid original skills profile.

Only assessed skills/proficiencies, supported matching interests, experience years, weekly hours and optional current role enter the API profile. Extra directions such as Cybersecurity are not scored against an unsupported role universe. “Not sure” is not coerced to beginner or an invented zero level: those skill names stay outside the API until the user selects an assessed proficiency. New fields must not be presented as scored or AI-extracted.

Save profile performs only the browser write. **Save & continue to Radar** validates and saves, then opens step 2—not a shortcut straight to matches. Failed persistence leaves the answers on screen. A saved-profile change from another tab blocks overwriting until the user explicitly loads the latest saved values.

## Guided four-stage journey

The main navigation is now Overview plus exactly four numbered stages. Optional Courses, SDG Impact, Malaysian workforce evidence, scenarios and comparison are grouped once as supporting tools. `/skills` is no longer a duplicate sidebar entry for `/roles`, and the Methodology redirect is not a second sidebar entry for Radar. Legacy URLs remain registered.

1. **Profile:** complete after a valid profile is explicitly saved. A legacy saved profile satisfies this stage; no other past stages are invented.
2. **Future Skills Radar:** unlocks after profile save. The learner must explicitly continue after source-backed signals load. Opening the page alone does not mark it complete, and an unavailable/empty report cannot finish the stage.
3. **Role matches:** unlocks after Radar review. Real API matching happens here, with scores, gaps and failure/retry states. The stage finishes only when the learner chooses a role actually present in the current profile/scenario response.
4. **Learning pathway:** unlocks after that choice. A different role in a deep link requires reviewing and choosing that role from matches first. The journey completes only when the requested role/scenario plan successfully loads. This means a plan is prepared, **not** that all its courses or skills are finished.

The home screen resumes the first incomplete stage. Completed stages remain revisitable; future-stage direct URLs show a prerequisite explanation rather than bypassing the guide. Progress is browser-local and scoped to effective assessed inputs. Metadata/current-role text edits do not reset it; changed assessed inputs require fresh guidance, while changed scenario/role requires a fresh role confirmation. Revisiting the same Radar or role does not erase downstream completion.

Guided setup state is separate from existing per-plan learning checklists. Failed progress writes show a warning instead of claiming durable storage, cross-tab changes are observed, and profile reset clears both setup state and the existing learning progress. No new fields or private profile context are transmitted.

Role/scenario preferences and per-plan completion stay in this browser. Clearing browser storage removes them; there is no cross-device sync. Profile and progress updates have same-browser cross-tab freshness. Reset asks for confirmation. Corrupted or blocked storage surfaces feedback rather than silently claiming persistence.

A plan ID depends on profile, role, scenario and generated plan content. Completion does not leak into a changed plan. The plan can be downloaded as actual JSON. Checking a step never raises a readiness score; skill self-assessments must be edited separately.

## Explainable assumptions

Weights, thresholds, scenario multipliers, reference experience, foundation ordering and practice budgets live in `config/journey.json`.

- Readiness points: **75 skills + 15 relevant interests + 10 general experience**.
- Recorded posting shares among a role's **top ten skills** determine the skill weights.
- Beginner earns half credit; working/confident earns full credit against a working-level target.
- Duplicate skills and aliases cannot inflate scores. Unlisted skills are unknown, not zero market demand.
- Experience references of 1–2 years are editorial learning-readiness assumptions, not employer requirements.
- Each component is rounded; its points add to the displayed score. Scores are not hiring probabilities or guarantees.
- Steady transition uses baseline weights. Faster AI adoption and a human-centred transition apply disclosed skill multipliers. These are scenario assumptions, not measured future changes or probabilities.
- Global future-role group mappings are editorial. Cloud Engineer receives no unsupported growth claim. Local denominators and low-sample warnings remain visible.

Every missing/beginner skill receives an ordered practice step, followed by a role-specific SDG portfolio project. Working/confident skills skip foundation steps. Practice hours are editorial budgets, not provider course durations or promised readiness dates. Weekly time determines pacing.

Each step has a free reading/documentation reference; optional hosted labs, compute and certificates may cost extra. Catalog alternatives are actual historical Coursera records with source identifiers. Current prices and availability are unknown and are not described as free.

SDG explanations describe possible concrete project applications. Skills do not inherently achieve a goal; these associations are neither measured impact nor UN endorsement. Goal links point to official UN pages.

## Refreshable source and honest limits

The WEF *Future of Jobs Report 2025* was published **7 January 2025** and covers global employer expectations for **2025–2030**. This is separate from the historical Malaysian posting dataset.

The service fetches the actual public digest through Jina's unauthenticated public text transport because this environment's direct publisher requests receive HTTP 403. No user information is sent. A successful remote refresh was verified during implementation.

The source is checked in the background after six hours or through the refresh action. Initial responses can use a bundled verified extract with its real retrieval date. Failed checks remain explicit and preserve the last verified evidence. Bounded vocabulary extraction requires each label to appear in the source's growing/declining context; format changes fail visibly rather than inventing trends.

Refreshing this **fixed annual edition** does not discover newer reports or turn the evidence into a live vacancy feed. Publication, retrieval and check dates remain distinct. This POC covers five technical role families, not all careers or a complete inventory of skills.

The existing JobStreet/Coursera licensing review and missing-upstream-test/raw-data limitations still apply. The separate GitHub Python backend remains unchanged and unconnected; no GitHub push was made.

## Verification

Run the managed API and frontend workflows, then:

```sh
pnpm run typecheck
python3 scripts/test-workforce.py
python3 scripts/test-journey.py
```

The Python scripts use standard library HTTP requests. Run them directly, not unittest discovery, because their filenames contain hyphens. Actual results and browser checks are recorded in `VERIFICATION.md`.
