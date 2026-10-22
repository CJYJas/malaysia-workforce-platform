# Market intelligence milestone

This extends the approved professional app without changing the sequential Profile → Radar → Role matches → Pathway guide.

## Overview

The guide and its next action remain primary. The career snapshot below it uses:

- Distinct recognised **assessed** skills, canonicalised using the matching service's public alias configuration. Unassessed context is not ability.
- Supported roles in the dataset, explicitly **not** a count of roles visited.
- Roles in an existing, current-profile/scenario matching response. A reload with no response shows unavailable, not an invented count or background assessment.
- Actual completed/total step IDs from the last generated, matching-scope pathway and its existing checklist. Preparing a plan does not complete its learning steps.

Direction and next-action links use the saved target preference and actual remaining plan gaps. Target demand rows show posting numerator/denominator, dated source context and course links. Missing public metrics have loading/error/retry states.

The small last-plan summary is browser-local and derived only from a successful plan response. It does not replace old checklists. A legacy plan gains a summary when opened again; matching plan IDs restore its existing checks. Summary scope must match assessed inputs, role and scenario. Reset clears this summary alongside the existing local profile/progress reset.

## Malaysian-first Radar

The Radar stage begins with the Malaysian historical role snapshot. Its role selector is exploratory, not a new confirmed career choice. It supports actual skill/category filters, name/share sorting, skill details, indexed course lookup and comparison links.

Coverage, actual posting shares and small-sample cautions are explicit. The only available period is the full snapshot. Monthly trends and observed raw term aliases are not exposed by the aggregate data, so the page does not invent them. Historical frequency must not be labelled growth.

The dated global WEF outlook, source refresh and explicit Radar continuation remain separate below this local evidence. Simply opening or filtering evidence does not complete the stage.

## Public role exploration

`/roles` contains a searchable/sortable card per supported role, actual descriptions and coverage/sample notices, ranked skill previews, and explicit detail links. Preview errors are local to their card.

`/roles/:roleId` shows source role data, skill shares, sample cautions, relevant indexed courses and editorial SDG rationales. Unknown role IDs have an explicit not-found state. Exploring a role does not silently alter the confirmed target or guide completion. Match/pathway links retain the requested role ID; the existing prerequisite and role-confirmation gates still apply.

`/skills` remains a compatible historical-browser URL. It is not a second copy in the sidebar.

## Sources and methodology

`/methodology` is now its own page, not a redirect to Radar. It separates Malaysian posting evidence, global employer outlook, matching assumptions, course retrieval, editorial SDGs and unresolved licenses. It displays actual processing counts, coverage, repository provenance, caveats and applicable sample notices. Missing row-level data and unsupported historical trends remain explicit limitations.

`GET /api/journey/catalog` now additionally exposes each role's actual configured SDG rationales and public scoring/alias/planning parameters. The additive OpenAPI contract is generated into the shared React client and Zod validator. This avoids sending a dummy personal profile just to retrieve public metadata. Scoring behaviour and the actual matching/pathway endpoints are unchanged.

No remote backend contract, new authentication, database, secrets, raw-data pipeline refresh, publishing or GitHub push is implied. Matching refinements and broader course-title search remain later milestones.
