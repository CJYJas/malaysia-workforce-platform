import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, Info } from "lucide-react";
import {
  getGetJourneyCatalogQueryKey, getGetSkillDemandQueryKey, useGetJourneyCatalog,
  useGetSkillDemand, useGetWorkforceOverview,
} from "@workspace/api-client-react";
import type { DemandSkill } from "@workspace/api-client-react";
import { Link, useSearch } from "wouter";
import { useJourney, profileKey } from "@/lib/journey";
import { canonicalSkill, recognisedAssessment, resolveComparisonRole, roleEvidence } from "@/lib/match-view-model";
import { ErrorPanel, PageHeader, Warn } from "@/components/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv, fmtNum, fmtPct } from "@/lib/format";
import "../matches.css";

const COLOR_A = "#245a9b";
const COLOR_B = "#087e83";

export default function Compare() {
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const overview = useGetWorkforceOverview();
  const catalog = useGetJourneyCatalog({ query: { queryKey: getGetJourneyCatalogQueryKey() } });
  const { profile, results, resultKey, scenario } = useJourney();
  const roles = overview.data?.roles ?? [];
  const roleNames = useMemo(() => roles.map((role) => role.name), [roles]);
  const [selection, setSelection] = useState<{ a: string; b: string } | null>(null);
  const queryLeft = params.get("left");
  const queryRight = params.get("right");
  const queryRequested = queryLeft !== null || queryRight !== null;

  useEffect(() => { setSelection(null); }, [search]);
  useEffect(() => {
    if (!overview.data || selection || catalog.isLoading) return;
    const catalogueRoles = catalog.data?.roles ?? [];
    const leftResolved = resolveComparisonRole(queryLeft, catalogueRoles, roleNames);
    const rightResolved = resolveComparisonRole(queryRight, catalogueRoles, roleNames);
    const fallbackA = roles[0]?.name ?? "";
    const fallbackB = roles.find((role) => role.name !== (leftResolved ?? fallbackA))?.name ?? "";
    const a = leftResolved ?? (rightResolved ? roles.find((role) => role.name !== rightResolved)?.name ?? rightResolved : fallbackA);
    const b = rightResolved ?? roles.find((role) => role.name !== a)?.name ?? "";
    setSelection({ a: a || fallbackA, b: b || fallbackB });
  }, [overview.data, selection, catalog.isLoading, catalog.data, queryLeft, queryRight, roleNames, roles]);

  const left = selection?.a ?? "";
  const right = selection?.b ?? "";
  const leftParams = { role: left };
  const rightParams = { role: right };
  const demandA = useGetSkillDemand(leftParams, {
    query: { enabled: !!left, queryKey: getGetSkillDemandQueryKey(leftParams) },
  });
  const demandB = useGetSkillDemand(rightParams, {
    query: { enabled: !!right, queryKey: getGetSkillDemandQueryKey(rightParams) },
  });

  if (overview.isError) return <div className="compare-page"><ErrorPanel message="Snapshot overview could not be loaded." onRetry={() => overview.refetch()} /></div>;
  if (overview.isLoading || !selection) return <div className="compare-page"><Skeleton className="h-24" /><div className="cp-skeleton" /></div>;

  const skillsA = new Map((demandA.data?.skills ?? []).map((skill) => [skill.skill, skill]));
  const skillsB = new Map((demandB.data?.skills ?? []).map((skill) => [skill.skill, skill]));
  const allSkills = [...new Set([...skillsA.keys(), ...skillsB.keys()])].sort((a, b) => a.localeCompare(b));
  const shared = allSkills.filter((skill) => skillsA.has(skill) && skillsB.has(skill));
  const onlyOne = allSkills.filter((skill) => !(skillsA.has(skill) && skillsB.has(skill)));
  const maxShare = Math.max(1, ...[...skillsA.values(), ...skillsB.values()].map((skill) => skill.posting_share_percentage));
  const snapshotsReady = !!demandA.data && !!demandB.data;
  const invalidLeft = queryLeft !== null && !resolveComparisonRole(queryLeft, catalog.data?.roles ?? [], roleNames);
  const invalidRight = queryRight !== null && !resolveComparisonRole(queryRight, catalog.data?.roles ?? [], roleNames);
  const unsupportedQuery = queryRequested && (invalidLeft || invalidRight);
  const assessment = profile && catalog.data ? recognisedAssessment(profile, catalog.data) : [];
  const methodology = catalog.data?.methodology;
  const marketByCanonical = (values: Map<string, DemandSkill>) => {
    const mapped = new Map<string, DemandSkill>();
    for (const [name, data] of values) mapped.set(canonicalSkill(name, methodology?.aliases ?? {}), data);
    return mapped;
  };
  const marketA = marketByCanonical(skillsA);
  const marketB = marketByCanonical(skillsB);
  const alignedResults = !!profile && !!results && resultKey === profileKey(profile, scenario);
  const alignmentA = alignedResults ? results!.roles.find((role) => role.name === left) : undefined;
  const alignmentB = alignedResults ? results!.roles.find((role) => role.name === right) : undefined;
  const alignmentText = (role: typeof alignmentA) => !role || roleEvidence(role) === "unavailable" || !Number.isFinite(role.score)
    ? "Alignment unavailable"
    : `${role.score.toFixed(1)}% profile alignment`;
  const valueCell = (skill?: { posting_share_percentage: number; mention_count: number }) =>
    skill ? <span className="tabular-nums">{fmtPct(skill.posting_share_percentage)}</span> : <span className="text-xs italic text-muted-foreground">Not in snapshot</span>;

  return (
    <main className="compare-page">
      <header className="cp-heading">
        <div className="mr-kicker">Workforce evidence</div>
        <h1>Compare roles, with evidence.</h1>
        <p>Posting share for each role’s recorded top skills. Shared entries can be compared directly; a skill outside a role’s top list is unknown, not zero. Compare roles without changing your saved target or learning journey.</p>
      </header>
      {unsupportedQuery && (
        <div className="mr-notice" role="status" data-testid="notice-unsupported-compare-role">
          One or more requested roles are not present in the current workforce overview. Showing supported roles instead. Choose any role from the lists below.
        </div>
      )}
      <section className="cp-selectors" aria-label="Choose roles to compare">
        <div className="cp-select-card">
          <label htmlFor="compare-role-a"><span className="cp-side-mark"><i />Role A</span></label>
          <select id="compare-role-a" value={left} onChange={(event) => setSelection({ a: event.target.value, b: right })} data-testid="select-compare-role-a">
            {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
          </select>
        </div>
        <div className="cp-select-card">
          <label htmlFor="compare-role-b"><span className="cp-side-mark cp-side-b"><i />Role B</span></label>
          <select id="compare-role-b" value={right} onChange={(event) => setSelection({ a: left, b: event.target.value })} data-testid="select-compare-role-b">
            {roles.map((role) => <option key={role.name} value={role.name}>{role.name}</option>)}
          </select>
        </div>
      </section>
      {left === right && left && <div className="cp-warning" role="status">Both sides show the same role. Choose a different role for a side-by-side comparison.</div>}
      {[demandA.data?.warning_message, demandB.data?.warning_message].filter(Boolean).map((warning, index) => <div className="cp-warning" key={index}>{warning}</div>)}
      {demandA.data?.sample_size_warning && !demandA.data.warning_message && <div className="cp-warning">Role A has a limited sample; interpret posting shares cautiously.</div>}
      {demandB.data?.sample_size_warning && !demandB.data.warning_message && <div className="cp-warning">Role B has a limited sample; interpret posting shares cautiously.</div>}

      {(demandA.isError || demandB.isError) && (
        <div className="cp-error" role="alert">
          A demand snapshot failed to load.
          {demandA.isError && <button type="button" onClick={() => demandA.refetch()} data-testid="button-retry-compare-a">Retry {left}</button>}
          {demandB.isError && <button type="button" onClick={() => demandB.refetch()} data-testid="button-retry-compare-b">Retry {right}</button>}
        </div>
      )}
      {!snapshotsReady && !demandA.isError && !demandB.isError && <div className="cp-skeleton" role="status" aria-label="Loading role demand snapshots" />}
      {snapshotsReady && (
        <>
          <section className="cp-section">
            <div className="cp-section-top">
              <div>
                <h2>Shared skills: comparable evidence</h2>
                <p className="cp-section-sub">
                  n = {fmtNum(demandA.data!.denominator)} ({left}) vs {fmtNum(demandB.data!.denominator)} ({right}) postings
                  {" · "}{demandA.data!.time_window || "period unavailable"} / {demandB.data!.time_window || "period unavailable"}
                </p>
              </div>
              <div className="cp-legend" aria-label="Chart key"><span><i />{left}</span><span><i className="teal" />{right}</span></div>
              <button
                type="button" className="cp-export" data-testid="button-export-compare"
                onClick={() => downloadCsv(`${left}-vs-${right}.csv`, [["skill", `${left}_share_pct`, `${right}_share_pct`], ...allSkills.map((skill) => [skill, skillsA.get(skill)?.posting_share_percentage ?? "Not in snapshot", skillsB.get(skill)?.posting_share_percentage ?? "Not in snapshot"])])}
              ><Download aria-hidden="true" /> Export CSV</button>
            </div>
            {shared.length === 0 ? (
              <div className="cp-empty" data-testid="empty-shared-skills">These roles share no skills in their recorded top lists, so no direct share comparison is supported.</div>
            ) : (
              <ul className="mt-5 space-y-4" data-testid="list-shared">
                {shared.map((skill) => {
                  const a = skillsA.get(skill)!;
                  const b = skillsB.get(skill)!;
                  return (
                    <li key={skill} className="cp-skill" data-testid={`row-shared-skill-${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
                      <div className="cp-skill-title"><span className="font-medium">{skill}</span><span className="tabular-nums text-xs">{fmtPct(a.posting_share_percentage)} / {fmtPct(b.posting_share_percentage)}</span></div>
                      <div className="cp-skill-bars">
                        <div className="cp-bar-line"><span className="cp-bar-label">A</span><div className="cp-track"><div className="cp-fill" style={{ width: `${a.posting_share_percentage / maxShare * 100}%`, background: COLOR_A }} /></div><span className="cp-value">{fmtPct(a.posting_share_percentage)}</span></div>
                        <div className="cp-bar-line"><span className="cp-bar-label">B</span><div className="cp-track"><div className="cp-fill cp-fill-b" style={{ width: `${b.posting_share_percentage / maxShare * 100}%`, background: COLOR_B }} /></div><span className="cp-value">{fmtPct(b.posting_share_percentage)}</span></div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {onlyOne.length > 0 && (
              <>
                <h3>In one top list only</h3>
                <p className="cp-section-sub">“Not in snapshot” means outside that role’s recorded top skills, not absent from postings. Shares are not inferred.</p>
                <div className="mr-table-scroll" style={{ marginTop: 8 }}>
                  <table className="cp-compare-table">
                    <thead><tr><th scope="col">Skill</th><th scope="col">{left}</th><th scope="col">{right}</th></tr></thead>
                    <tbody>{onlyOne.map((skill) => <tr key={skill}><td>{skill}</td><td>{valueCell(skillsA.get(skill))}</td><td>{valueCell(skillsB.get(skill))}</td></tr>)}</tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          {profile ? (
            <section className="cp-section">
              <div className="cp-section-top">
                <div><h2>Your assessed skills in context</h2><p className="cp-section-sub">Recognised profile entries and the catalogue’s editorial working-level target. Posting-share values are shown only when the skill appears in that role’s recorded list.</p></div>
              </div>
              {catalog.isLoading && <div className="cp-skeleton" role="status" aria-label="Loading recognised profile skills" />}
              {catalog.isError && <div className="cp-error" role="alert">Catalogue skill definitions could not be loaded. Profile levels and editorial targets are unavailable.</div>}
              {catalog.data && (
                <>
                  {assessment.length ? (
                    <div className="mr-table-scroll" style={{ marginTop: 12 }}>
                      <table className="cp-compare-table" data-testid="table-profile-skill-overlay">
                        <thead><tr><th scope="col">Assessed catalogue skill</th><th scope="col">Profile</th><th scope="col">Working target</th><th scope="col">{left} posting share</th><th scope="col">{right} posting share</th></tr></thead>
                        <tbody>
                          {assessment.map((skill) => {
                            const key = canonicalSkill(skill.name, methodology?.aliases ?? {});
                            const a = marketA.get(key);
                            const b = marketB.get(key);
                            return <tr key={skill.name}>
                              <td>{skill.name}</td>
                              <td className="cp-profile-level">Level {skill.level}</td>
                              <td className="cp-profile-level">Level {methodology?.target_skill_level ?? "Unavailable"} · {skill.level >= (methodology?.target_skill_level ?? Infinity) ? "met" : "in development"}</td>
                              <td>{valueCell(a)}</td><td>{valueCell(b)}</td>
                            </tr>;
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="cp-empty">No submitted profile skills are recognised in the current catalogue. No missing skill ability or demand is inferred.</p>}
                  <p className="cp-profile-note"><Info aria-hidden="true" size={14} style={{ display: "inline", marginRight: 5, verticalAlign: "-2px" }} />“In development” compares an assessed level with the working-level editorial target (level {methodology?.target_skill_level ?? "unavailable"}); it is not an employer requirement. A skill absent from your profile has no assumed level.</p>
                </>
              )}
              {alignedResults && (
                <div className="cp-profile-note" data-testid="text-existing-alignment">
                  Existing {scenario.replaceAll("_", " ")} journey alignment: <strong>{left}: {alignmentText(alignmentA)}</strong> · <strong>{right}: {alignmentText(alignmentB)}</strong>. These are the saved matching results for this exact profile and scenario; no new assessment was run.
                </div>
              )}
            </section>
          ) : (
            <section className="cp-section">
              <h2>See your profile alongside role evidence</h2>
              <p className="cp-section-sub">Your profile is optional. Add assessed skills to compare your levels with the catalogue’s working target and role evidence.</p>
              <Link href="/profile" className="mr-button mr-button-primary" data-testid="link-compare-profile">Add profile <ArrowRight aria-hidden="true" size={14} /></Link>
            </section>
          )}
        </>
      )}
    </main>
  );
}
