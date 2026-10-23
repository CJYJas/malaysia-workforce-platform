# Courses, learning progress and SDG alignment

## Bounded public course index

The new read-only `GET /api/workforce/course-catalog` searches the existing snapshot's deduplicated course records by title or actual skill/index evidence. It does not import, refresh or search the full source catalogue. Current coverage is 205 unique retained records from an 8,370-record source. Repeated source IDs retain their indexed retrieval skills, not multiple fabricated courses.

Queries support submitted `q` search, an independent exact `skill` filter, recorded `provider` and `level` facets, and `page`/`page_size` (20 by default, maximum 50). Search is case-insensitive. Results use deterministic alphabetical title/ID order, not a semantic relevance, course quality or employer-demand ranking. Counts distinguish filtered results, index coverage and the independent source total. Invalid pagination/provider/level queries return 400; an arbitrary skill with no index records returns an honest empty result.

`GET /api/workforce/course-catalog/:courseId` returns one exact retained record or 404. Existing `/workforce/courses?skill=...` and pathway retrieval remain compatible and unchanged. Indexing preserves recorded provider, level, rating, duration, URL, tags, match note and source record. Missing description, prerequisites, price or availability are never invented. Historical ratings and course quantities are not employer-demand evidence. Course duration is distinct from editorial pathway planning hours.

The catalogue and details live at `/courses`, with URL-backed search/facets/pagination and `?course=...` detail context. Detail navigation preserves catalogue filters. Only the explicit `from=pathway` flag enables the safe `/pathway` return link; arbitrary return URLs are not followed. Pathway course cards now open these records and preserve skill context, while original-provider links remain available. Gaps with no indexed course remain visible and unresolved.

No profile, selected target, scenario, assessment or guide completion is changed by public course/SDG exploration. Opening these views does not run personal matching.

## Self-reported learning status

The existing per-plan storage key and plan/step IDs are unchanged. The shared progress reader accepts old `true` as Completed and old `false` as Not started, plus `not_started`, `in_progress` and `completed`. Migration occurs in memory on reading; a learner's next deliberate status change writes the current plan's string statuses. It does not re-key a plan or erase prior completed steps. Unknown steps are not counted for another plan; malformed values fail explicitly.

Each pathway step has a three-state selector and the existing quick-complete action. Overview counts only Completed as completed and separately reports In progress; the next skill remains the first unfinished skill in the suggested sequence. Storage failures produce warnings instead of claiming durable saving. Browser-local state can be cleared and does not sync across devices/accounts.

These statuses are self-reported task tracking, not certification, verified skill acquisition or permission to change assessed proficiency or match scores. Prepared journey stages and actual learning completion remain separate.

## SDG connections

Both `/goals` and `/sdg-alignment` show all 17 official titles, URL-selected goal detail, actual catalogue role/skill mappings and their editorial rationale. Unsupported goals and goals without mappings have explicit states. Official UN links remain available; mapping navigation opens the in-app rationale consistently. Skill links open the matching public course filter and role links public role evidence, not confirmation of a new target.

Public `JourneyCatalog.skill_sdgs` exposes the existing `skillSdgs` editorial mappings already used in pathway gaps. The original `skills` intake vocabulary remains a string array; consumers must not cast it into structured skill objects. The goal page uses generated contract types. Current Goal 9 coverage is four role mappings and 31 skill mappings. The role explorer's course preview now uses the same bounded catalogue endpoint as the catalogue page, so AWS reports eight retained matches in both places rather than labelling the legacy wider source-match count of 82 as an index count.

Potential alignment is not UN endorsement or measured impact. Completing a course or checking a step does not automatically achieve an SDG. No scoring model, remote backend, new dependency, database, account system, GitHub push or publishing is introduced.
