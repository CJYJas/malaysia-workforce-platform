import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Info, RotateCw, Search } from "lucide-react";
import type { JourneyCatalog, JourneyProfile, RoleMatch, SdgLink } from "@workspace/api-client-react";
import { useGetSkillDemand, getGetSkillDemandQueryKey, useGetWorkforceOverview } from "@workspace/api-client-react";
import { Link } from "wouter";
import { comparisonHref, recognisedAssessment, roleEvidence, visibleMatches, type EvidenceFilter, type MatchResultsViewProps, type MatchSort } from "@/lib/match-view-model";
import "../matches.css";

function SdgPills({ links }: { links: SdgLink[] }) {
  if (!links.length) return null;
  return (
    <div className="mr-sdg-list" aria-label="Related Sustainable Development Goals">
      {links.map((sdg) => (
        <div className="mr-sdg" key={`${sdg.id}-${sdg.title}`}>
          <Link href={`/sdg-alignment?goal=${sdg.id}`} title={sdg.reason} aria-label={`Open Sustainable Development Goal ${sdg.id}: ${sdg.title}`} data-testid={`link-match-sdg-${sdg.id}`}>
            SDG {sdg.id} · {sdg.title}: {sdg.reason}
          </Link>
        </div>
      ))}
    </div>
  );
}

function RoleDemand({ role }: { role: RoleMatch }) {
  const params = { role: role.name };
  const demand = useGetSkillDemand(params, {
    query: { enabled: true, queryKey: getGetSkillDemandQueryKey(params) },
  });

  return (
    <section className="mr-demand" aria-label={`Posting requirements for ${role.name}`}>
      <div className="mr-demand-header">
        <div>
          <h3>Skills named in this role’s postings</h3>
          {demand.data && (
            <p>
              {demand.data.status === "unavailable"
                ? "This role has no published skill-demand snapshot."
                : `${demand.data.denominator.toLocaleString()} postings · ${demand.data.time_window || "period not specified"}`}
              {demand.data.sample_size_warning ? " · Small sample; interpret cautiously." : ""}
            </p>
          )}
        </div>
        {demand.data?.sample_size_warning && demand.data.warning_message && (
          <span className="mr-small-note">{demand.data.warning_message}</span>
        )}
      </div>
      {demand.isLoading && <div className="mr-skeleton" role="status" aria-label="Loading role posting skills" />}
      {demand.isError && (
        <div className="mr-error" role="alert">
          Could not load this role’s posting requirements.
          <button type="button" onClick={() => demand.refetch()} data-testid={`button-retry-demand-${role.id}`}>Retry</button>
        </div>
      )}
      {demand.data && demand.data.status === "unavailable" && (
        <p className="mr-small-note">Posting-level skill evidence is unavailable for this role. No requirements are inferred.</p>
      )}
      {demand.data && demand.data.status !== "unavailable" && demand.data.skills.length > 0 && (
        <div className="mr-table-scroll">
          <table className="mr-demand-table">
            <thead><tr><th scope="col">Posting skill</th><th scope="col">Postings mentioning it</th><th scope="col">Posting share</th></tr></thead>
            <tbody>
              {demand.data.skills.map((skill) => (
                <tr key={skill.skill}>
                  <td>{skill.skill}</td>
                  <td>{skill.mention_count.toLocaleString()} / {demand.data!.denominator.toLocaleString()}</td>
                  <td>{skill.posting_share_percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mr-target-note">Posting share is observed frequency in this snapshot. Skills outside this recorded list are unknown, not zero-demand.</p>
        </div>
      )}
      {demand.data && demand.data.status !== "unavailable" && demand.data.skills.length === 0 && (
        <p className="mr-small-note">No skills are listed in the available snapshot; this does not establish that the role has no skill requirements.</p>
      )}
    </section>
  );
}

function MatchBreakdown({ role, profile, catalog }: { role: RoleMatch; profile: JourneyProfile; catalog: JourneyCatalog }) {
  const assessed = useMemo(() => recognisedAssessment(profile, catalog), [profile, catalog]);
  const fullyMatched = new Set(role.matched_skills.map((name) => name.trim().toLowerCase()));
  const methods = catalog.methodology;
  const points = [
    { name: "Skills", actual: role.components.skills, max: methods.skill_points },
    { name: "Interests", actual: role.components.interests, max: methods.interest_points },
    { name: "Experience", actual: role.components.experience, max: methods.experience_points },
  ];
  return (
    <div className="mr-detail" id={`breakdown-${role.id}`}>
      <h3>How this profile aligns</h3>
      <div className="mr-detail-grid">
        <section className="mr-detail-section">
          <h3>Recognised profile skills</h3>
          {assessed.length ? (
            <div className="mr-skill-list">
              {assessed.map((skill) => {
                const matches = fullyMatched.has(skill.name.trim().toLowerCase());
                return (
                  <div className="mr-skill-line" key={skill.name}>
                    <span>{skill.name}{skill.supplied.length > 1 && <span className="mr-target-note"> · combined aliases</span>}</span>
                    <span className="mr-level">Level {skill.level}{matches ? " · target met" : ""}</span>
                  </div>
                );
              })}
            </div>
          ) : <p className="mr-small-note">No assessed profile skills are recognised in this catalogue. This is missing profile evidence, not evidence of missing ability.</p>}
          <p className="mr-target-note">Skill names are matched through the catalogue’s explicit alias normalisation. “Fully matched” means the recorded current level meets the configured working-level target (level {methods.target_skill_level}). A beginner-level skill remains a development gap.</p>
        </section>
        <section className="mr-detail-section">
          <h3>Component points</h3>
          <div className="mr-points">
            {points.map((point) => (
              <div className="mr-point" key={point.name}>
                <span>{point.name}</span>
                <strong>{Number.isFinite(point.actual) ? point.actual.toFixed(1) : "—"} / {Number.isFinite(point.max) ? point.max.toFixed(1) : "—"}</strong>
              </div>
            ))}
          </div>
          <p className="mr-target-note">Points and maxima come from the configured methodology: skills {methods.skill_points}, interests {methods.interest_points}, experience {methods.experience_points}. No embeddings or language model are used; this is a planning aid, not a hiring or employment prediction.</p>
        </section>
      </div>
      <section className="mr-demand">
        <h3>Skill development areas</h3>
        {role.gaps.length ? (
          <>
            <div className="mr-skill-list">
              {role.gaps.map((gap) => (
                <div className="mr-skill-line" key={gap.skill}>
                  <span>
                    <strong>{gap.skill}</strong>
                    <span className="mr-target-note"> · {gap.current_level <= 0 ? "Not recorded in profile" : `Current level ${gap.current_level}`} → target level {gap.target_level}</span>
                  </span>
                  <span className="mr-level">Scenario weight {Number.isFinite(gap.importance) ? gap.importance.toFixed(1) : "—"}</span>
                </div>
              ))}
            </div>
            <p className="mr-target-note">The target is an editorial planning benchmark, not an employer requirement. Scenario weight is relative importance within this top-10 match list—not the share of postings requiring the skill. Unrecorded profile skills are not assumed to be absent.</p>
          </>
        ) : <p className="mr-small-note">No development gaps were returned for this role under the configured target.</p>}
      </section>
      <RoleDemand role={role} />
      <SdgPills links={role.sdgs} />
      {role.gaps.some((gap) => gap.sdgs.length > 0) && (
        <div className="mr-demand">
          <h3>Development areas and SDG links</h3>
          {role.gaps.filter((gap) => gap.sdgs.length > 0).map((gap) => (
            <div key={gap.skill} className="mr-skill-line">
              <span>{gap.skill}</span><SdgPills links={gap.sdgs} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchResultsView({
  profile, catalog, results, requestedRoleId, refreshing, onRefresh, onChooseRole,
}: MatchResultsViewProps) {
  const [sort, setSort] = useState<MatchSort>("score");
  const [evidence, setEvidence] = useState<EvidenceFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const overview = useGetWorkforceOverview();
  const roles = results.roles;
  const shown = visibleMatches(roles, sort, evidence, query);
  const assessed = recognisedAssessment(profile, catalog);
  const limitedCount = roles.filter((role) => roleEvidence(role) === "limited").length;
  const evaluableCount = roles.filter((role) => roleEvidence(role) !== "unavailable").length;
  const requested = requestedRoleId ? roles.find((role) => role.id === requestedRoleId) : undefined;
  const requestedResultId = requested?.id ?? null;
  useEffect(() => {
    if (!requestedResultId) return;
    setExpanded(current => current.includes(requestedResultId) ? current : [...current, requestedResultId]);
    setQuery(""); setEvidence("all");
  }, [requestedResultId]);
  const requestedExists = !requestedRoleId || !!catalog.roles.find((role) => role.id === requestedRoleId);
  const unsupportedRequest = !!requestedRoleId && !requested && !requestedExists;
  const coverage = overview.data?.coverage_start && overview.data?.coverage_end
    ? `${overview.data.coverage_start}–${overview.data.coverage_end}`
    : null;
  const toggleExpanded = (id: string) => setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <main className="match-results">
      <header className="mr-intro">
        <div>
          <div className="mr-kicker">Your role matches</div>
          <h1>Explore where your skills could take you.</h1>
          <p>Compare profile alignment with recorded Malaysian workforce evidence, then choose a role to build a learning pathway. These results support exploration—not hiring decisions.</p>
        </div>
        <button type="button" className="mr-refresh" onClick={onRefresh} disabled={refreshing} data-testid="button-retry-matches">
          <RotateCw aria-hidden="true" className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing matches…" : "Refresh matches"}
        </button>
      </header>

      {unsupportedRequest && (
        <div className="mr-notice" role="status" data-testid="notice-unknown-role">
          The requested role could not be identified in the current match results. Your existing target role has not been changed; browse the returned roles below.
        </div>
      )}
      {requestedRoleId && !requested && requestedExists && (
        <div className="mr-notice" role="status" data-testid="notice-role-not-returned">
          This catalogue role was not returned in the current results. No target role has been changed.
        </div>
      )}

      <div className="mr-summary" aria-label="Match result summary">
        <div className="mr-stat">
          <span className="mr-stat-label">Roles returned</span>
          <strong className="mr-stat-value" data-testid="summary-roles-returned">{roles.length}</strong>
          <span className="mr-stat-note">of {roles.length} roles evaluated in this response</span>
        </div>
        <div className="mr-stat">
          <span className="mr-stat-label">Recognised profile skills</span>
          <strong className="mr-stat-value" data-testid="summary-recognised-skills">{assessed.length}</strong>
          <span className="mr-stat-note">Distinct catalogue skills assessed</span>
        </div>
        <div className="mr-stat">
          <span className="mr-stat-label">Limited-sample roles</span>
          <strong className="mr-stat-value" data-testid="summary-limited-sample">{limitedCount}</strong>
          <span className="mr-stat-note">{evaluableCount} roles have enough recorded evidence to display alignment</span>
        </div>
      </div>
      <div className="mr-method">
        <strong>How to read these results.</strong> Profile alignment is calculated from the API-configured component weights: skills {catalog.methodology.skill_points}, interests {catalog.methodology.interest_points}, and experience {catalog.methodology.experience_points} points. Skill aliases are normalised to catalogue terms. The score is not a probability, and missing profile information does not demonstrate missing ability.
        {overview.isLoading && <span> Workforce evidence period is loading.</span>}
        {overview.isError && <span> Workforce evidence period is unavailable. <button type="button" onClick={() => overview.refetch()} className="mr-text-button">Retry period</button></span>}
        {coverage && <span> Current posting snapshot coverage: {coverage}.</span>}
      </div>
      {refreshing && (
        <div className="mr-notice" role="status" aria-live="polite">
          Updating match results. Previous valid results remain visible; pathway selection is paused until the refresh finishes.
        </div>
      )}

      <section className="mr-controls" aria-label="Filter and sort matches">
        <div className="mr-field">
          <label htmlFor="match-search">Search roles</label>
          <div style={{ position: "relative" }}>
            <Search aria-hidden="true" size={15} style={{ color: "#71849a", left: 10, position: "absolute", top: 11 }} />
            <input id="match-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Role name or description" style={{ paddingLeft: 32 }} data-testid="input-match-search" />
          </div>
        </div>
        <div className="mr-field">
          <label htmlFor="match-sort">Sort by</label>
          <select id="match-sort" value={sort} onChange={(event) => setSort(event.target.value as MatchSort)} data-testid="select-match-sort">
            <option value="score">Profile alignment</option>
            <option value="skills">Fully matched skills</option>
            <option value="interests">Interest component points</option>
          </select>
        </div>
        <div className="mr-field">
          <label htmlFor="match-evidence">Evidence</label>
          <select id="match-evidence" value={evidence} onChange={(event) => setEvidence(event.target.value as EvidenceFilter)} data-testid="select-match-evidence">
            <option value="all">All evidence states</option>
            <option value="recorded">Recorded</option>
            <option value="limited">Limited sample</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
        <div className="mr-count" aria-live="polite">{shown.length} of {roles.length} roles</div>
      </section>

      {roles.length === 0 ? (
        <div className="mr-empty" data-testid="empty-no-match-results">
          <Info aria-hidden="true" />
          <div><h3>No role results were returned</h3><p>There is no match response to display yet. Try refreshing after checking your profile details.</p></div>
        </div>
      ) : shown.length === 0 ? (
        <div className="mr-empty" data-testid="empty-filtered-matches">
          <Info aria-hidden="true" />
          <div>
            <h3>No roles fit these filters</h3>
            <p>Clear your search or evidence filter to return to the full set of {roles.length} roles.</p>
            <button type="button" className="mr-button" onClick={() => { setQuery(""); setEvidence("all"); }} data-testid="button-reset-match-filters">Reset filters</button>
          </div>
        </div>
      ) : (
        <div className="mr-card-list">
          {shown.map((role) => {
            const state = roleEvidence(role);
            const unavailable = state === "unavailable";
            const isExpanded = expanded.includes(role.id);
            const matchedCount = new Set(role.matched_skills).size;
            return (
              <article key={role.id} className={`mr-card ${requested?.id === role.id ? "mr-card-focus" : ""}`} data-testid={`card-match-${role.id}`}>
                <div className="mr-card-top">
                  <div>
                    <h2 className="mr-role-title">{role.name}</h2>
                    <p className="mr-role-description">{role.description}</p>
                  </div>
                  <div className="mr-score">
                    {unavailable ? <><strong>—</strong><span>Insufficient evidence</span></> : <><strong>{Number.isFinite(role.score) ? `${role.score.toFixed(1)}%` : "—"}</strong><span>Profile alignment</span></>}
                  </div>
                </div>
                <div className="mr-card-meta">
                  <span className={`mr-evidence mr-evidence-${state}`}>{state === "recorded" ? "Recorded evidence" : state === "limited" ? "Limited sample" : "Insufficient evidence"}</span>
                  <span>{Number.isFinite(role.postings) ? role.postings.toLocaleString() : "—"} postings recorded</span>
                  <span>{matchedCount} fully matched {matchedCount === 1 ? "skill" : "skills"}</span>
                  {role.sample_warning && state !== "limited" && <span>Snapshot sample caution</span>}
                </div>
                <div className="mr-card-data">
                  <div>
                    <div className="mr-data-label">Fully matched skills</div>
                    {role.matched_skills.length ? <div className="mr-chip-row">{role.matched_skills.map((skill) => <span className="mr-chip" key={skill}>{skill}</span>)}</div> : <span className="mr-small-note">No skills met the configured working-level target in this profile.</span>}
                  </div>
                  <div>
                    <div className="mr-data-label">Development areas</div>
                    {role.gaps.length ? <div className="mr-chip-row">{role.gaps.slice(0, 6).map((gap) => <span className="mr-chip mr-chip-gap" key={gap.skill}>{gap.skill}</span>)}{role.gaps.length > 6 && <span className="mr-chip">+{role.gaps.length - 6} more</span>}</div> : <span className="mr-small-note">No gaps returned</span>}
                  </div>
                </div>
                <div className="mr-card-bottom">
                  <span className="mr-small-note">{role.outlook || "No outlook note is available for this role."}</span>
                  <div className="mr-card-actions">
                    <Link className="mr-button" href={comparisonHref(role.name)} data-testid={`link-compare-${role.id}`}>Compare role <ArrowRight aria-hidden="true" size={14} /></Link>
                    <button type="button" className="mr-text-button" aria-expanded={isExpanded} aria-controls={`breakdown-${role.id}`} onClick={() => toggleExpanded(role.id)} data-testid={`button-expand-${role.id}`}>
                      {isExpanded ? "Hide breakdown" : "View breakdown"} {isExpanded ? <ChevronUp aria-hidden="true" size={15} /> : <ChevronDown aria-hidden="true" size={15} />}
                    </button>
                    <button type="button" className="mr-button mr-button-primary" disabled={refreshing || unavailable} title={unavailable ? "A pathway is unavailable without sufficient role evidence." : undefined} onClick={() => onChooseRole(role)} data-testid={`button-pathway-${role.id}`}>
                      Build learning pathway <ArrowRight aria-hidden="true" size={14} />
                    </button>
                  </div>
                </div>
                {isExpanded && <MatchBreakdown role={role} profile={profile} catalog={catalog} />}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default MatchResultsView;
