# Role matching milestone

## Active frontend

The router uses `pages/matches.tsx` for both `/role-matches` and the compatible `/matches` URL. It owns assessment requests, retry/loading/error states, scope guards and explicit pathway selection. `components/match-results.tsx` handles the returned results and expanded evidence, with pure normalisation/filter/sort helpers in `lib/match-view-model.ts`. Older unrouted exports in `pages/journey.tsx` are not the active controller.

The existing matching service, score weights, plan identity, API contracts and saved checklists are unchanged. No remote/RunPod contract, embedding model or LLM is connected by this milestone.

## Summary and controls

- Counts use actual returned roles, recognised canonical assessed skills and source sample cautions.
- Profile aliases collapse at the highest assessed level using the public matching configuration. Unknown/unassessed context is not inferred ability.
- Sorting supports actual alignment score, distinct fully matched skills and the implemented interest-points component.
- Role-name/description search and recorded/limited/unavailable evidence filters are local. Filtered-empty and genuinely empty responses have separate states.
- A requested `?role=` opens viewing context only; it does not confirm the career target. Unsupported/not-returned IDs produce a notice.
- Refresh is an explicit assessment action. Sorting, filters, breakdowns and public comparison do not POST personal matching requests.

## Evidence and score meaning

Scores are the implemented readiness/alignment heuristic, never hiring probabilities or a declaration that the highest numerical role is “best.” Component points and configured maxima come from the response/public configuration.

Fully matched skills meet the configured target; beginner/underdeveloped skills remain gaps and may receive partial credit. Target proficiency is an editorial model assumption, not an observed employer proficiency requirement. Profile omission does not prove lack of ability.

Expanded breakdowns show recognised assessed levels, actual matches/gaps, SDG rationales and independently loaded posting evidence with numerator, denominator, period and source cautions. Public evidence requests have their own loading/error/retry states.

Scenario-adjusted gap `importance` is a relative priority within the modelled top skills, **not** raw job-posting share. Posting share is taken from the demand endpoint. A top-list absence is unknown, not zero demand.

Positive but small samples remain explicitly exploratory. Roles with no usable posting/modelled-skill evidence are unassessed: no meaningful score claim, no pathway choice, and no ranking above assessed roles based on a meaningless returned number. The sample-caution flag alone is not a statistical confidence estimate.

## Request and journey boundaries

The controller ignores late, superseded, wrong-scenario and unmounted responses. It never stores a mismatched response as current results. Shared results must belong to the current profile/scenario key.

Matching responses remain in memory, not persistent storage. A hard reload on Matches legitimately requests a fresh assessment after the existing journey prerequisite gate; internal navigation/query changes reuse an already-current response. This is distinct from the read-only Overview, which never runs matching just to fill a metric.

Only the explicit Build Learning Pathway action calls the guide's role confirmation. Refreshing disables pathway selection while the assessment is pending. Viewing a breakdown or comparison does not replace the target, advance stages or overwrite a checklist.

## Comparison

`/compare?left=...&right=...` resolves current catalogue IDs and legacy displayed names against supported metadata. A single requested role gets a different supported default counterpart. Invalid parameters produce a notice and safe supported fallback, never an arbitrary demand API query. URL changes reset local pair selection; picker changes remain local.

The page preserves real posting-share comparisons, separate denominators, source cautions, unknown top-list absences, loading/errors and CSV export. The optional profile overlay uses actual assessed levels and the model's documented target. Existing alignment points appear only for an already-loaded current-scope response; opening comparison does not run assessment.

Broader course search, tri-state learning migration and later integrated validation remain separate milestones.
