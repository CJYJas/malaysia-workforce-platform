import { useGetJourneyCatalog, useGetJourneySignals, useGetSkillCourses, useGetSkillDemand, useGetWorkforceOverview, getGetSkillCoursesQueryKey, getGetSkillDemandQueryKey } from "@workspace/api-client-react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/shell";
import "../market.css";

type MethodConfig = { skill_points?: number; interest_points?: number; experience_points?: number; target_skill_level?: number; aliases?: Record<string, string>; new_skill_hours?: number; improve_skill_hours?: number; project_hours?: number };
type CatalogExtended = { methodology?: MethodConfig };
const fmtNum = (n?: number) => typeof n === "number" ? n.toLocaleString() : "Not supplied";
const fmtDate = (value?: string) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : "Not supplied by source";

function LoadingBlock() {
  return <div className="market-loading" aria-label="Loading methodology"><div className="market-skeleton" style={{ width: "42%" }} /><div className="market-skeleton" /><div className="market-skeleton" style={{ width: "72%" }} /><div className="market-skeleton" style={{ width: "56%" }} /></div>;
}

export function MethodologyPage() {
  const overview = useGetWorkforceOverview();
  const catalog = useGetJourneyCatalog();
  const signals = useGetJourneySignals();
  const methods = (catalog.data as CatalogExtended | undefined)?.methodology;
  const role = overview.data?.roles?.[0]?.name || "";
  const demand = useGetSkillDemand({ role }, { query: { enabled: !!role, queryKey: getGetSkillDemandQueryKey({ role }) } });
  const skill = demand.data?.skills?.[0]?.skill || "";
  const courses = useGetSkillCourses({ skill }, { query: { enabled: !!skill, queryKey: getGetSkillCoursesQueryKey({ skill }) } });
  const data = overview.data;
  const methodSignal = signals.data;

  if (overview.isLoading || catalog.isLoading) return <div className="market-page"><div className="market-shell"><PageHeader kicker="Methods & sources" title="What the evidence can—and cannot—say">A transparent account of the Malaysian posting snapshot, matching model, learning catalogue, and global signals.</PageHeader><LoadingBlock /></div></div>;
  if (overview.isError || catalog.isError || !data) return <div className="market-page"><div className="market-shell"><PageHeader kicker="Methods & sources" title="What the evidence can—and cannot—say">A transparent account of the Malaysian posting snapshot, matching model, learning catalogue, and global signals.</PageHeader><div className="market-error" role="alert"><strong>Source metadata is temporarily unavailable.</strong><p>Retry the public evidence endpoints.</p><button className="market-button secondary" onClick={() => { void overview.refetch(); void catalog.refetch(); }} data-testid="button-methodology-retry"><RefreshCw size={15} /> Retry</button></div></div></div>;

  return <div className="market-page"><div className="market-shell">
    <header className="market-hero"><p className="market-eyebrow">FutureReady MY · evidence notes</p><h1 className="market-title">How to read the signal.</h1><p className="market-lede">Three different evidence layers sit beside one another: a historical Malaysian posting snapshot, a lexical readiness heuristic, and separately sourced learning and global-outlook records. None is an employment guarantee.</p></header>

    <section className="market-grid" aria-label="Snapshot summary">
      <div className="market-card market-span-4"><p className="market-eyebrow">Source records</p><div className="market-stat">{fmtNum(data.raw_postings)}</div><p>Raw postings reported by the source</p></div>
      <div className="market-card market-span-4"><p className="market-eyebrow">Processing</p><div className="market-stat">{fmtNum(data.duplicates_removed)} / {fmtNum(data.excluded_postings)}</div><p>Duplicates removed / excluded records. Counts are source-reported.</p></div>
      <div className="market-card market-span-4"><p className="market-eyebrow">Retained</p><div className="market-stat">{fmtNum(data.total_postings)}</div><p>Retained postings in the available dataset</p></div>
      <div className="market-card market-span-6"><p className="market-eyebrow">Target-role subset</p><div className="market-stat">{fmtNum(data.target_postings)}</div><p>Postings assigned to target roles by the source. This is not the whole Malaysian labour market.</p></div>
      <div className="market-card market-span-6"><p className="market-eyebrow">Observed period</p><div className="market-stat" style={{ fontSize: 24 }}>{data.coverage_start || "Unknown"} — {data.coverage_end || "Unknown"}</div><p>{fmtNum(data.observed_months)} observed months · processed {fmtDate(data.processed_at)}</p></div>
    </section>

    <section className="market-grid">
      <article className="market-card market-span-7"><p className="market-eyebrow">01 · Malaysian posting snapshot</p><h2 style={{ fontSize: 25 }}>From collected records to visible rows</h2>
        <ol className="market-list">
          <li><strong>Raw records.</strong> {fmtNum(data.raw_postings)} source postings are reported before de-duplication and exclusions.</li>
          <li><strong>De-duplicate.</strong> {fmtNum(data.duplicates_removed)} repeated records were removed under this policy: {data.deduplication_policy || "Policy not supplied."}</li>
          <li><strong>Exclude.</strong> {fmtNum(data.excluded_postings)} records were excluded. The public overview does not expose a more detailed reason-by-reason breakdown.</li>
          <li><strong>Retain and classify.</strong> The snapshot reports {fmtNum(data.total_postings)} retained postings, of which {fmtNum(data.target_postings)} are in target roles. Role skill denominators come from role-specific demand responses.</li>
        </ol>
        <div className="market-rule" /><p><strong>Geography:</strong> Malaysia. <strong>Coverage:</strong> {data.coverage_start || "start unavailable"} to {data.coverage_end || "end unavailable"}. This is a fixed source snapshot; monthly history or time-filtered comparisons are not available here.</p>
        <p><strong>Pipeline version:</strong> {data.pipeline_version || "Not exposed"} · <strong>Source mode:</strong> {data.source_mode || "Not exposed"} · <strong>Source commit:</strong> {data.source_commit || "Not supplied"}.</p>
        <p className="market-small">{data.repository_url ? <a className="market-inline-link" href={data.repository_url} target="_blank" rel="noreferrer">Open source repository <ExternalLink size={13} style={{ display: "inline" }} /></a> : "Repository URL not supplied."} Processed timestamp comes from the overview API; no claim is made that a live repository refresh or raw pipeline run was independently verified.</p>
      </article>
      <article className="market-card market-span-5"><p className="market-eyebrow">Limits of extraction</p><h2 style={{ fontSize: 25 }}>What is not exposed</h2>
        {data.limitations?.length ? <ul className="market-list">{data.limitations.map((item, i) => <li key={`${i}-${item}`}>{item}</li>)}</ul> : <ul className="market-list"><li>Raw job-ad text and exact cleaning decisions are not exposed by this public overview.</li><li>Observed aliases and alias-level counts are not exposed. Configured matching aliases are not proof that each phrase appeared in a posting.</li><li>Category labels are snapshot classifications; missing categories are unknown or unclassified.</li><li>There is no supported time-series comparison or growth claim in this view.</li></ul>}
        {data.trend_reason && <p className="market-pill warn" style={{ marginTop: 15 }}>Trend status: {data.trend_status || "not supplied"} · {data.trend_reason}</p>}
      </article>
      <article className="market-card market-span-12"><p className="market-eyebrow">Dataset licenses</p><h2 style={{ fontSize: 22 }}>License records from the source overview</h2>{data.licenses?.length ? <div className="market-grid">{data.licenses.map((license, i) => <div key={`${license.filename}-${i}`} className="market-card market-span-4"><strong>{license.filename}</strong><p className="market-small">Status: {license.status || "Not supplied"}</p></div>)}</div> : <div className="market-empty">No license status records were supplied by the overview.</div>}</article>
    </section>

    <section className="market-grid">
      <article className="market-card market-span-7"><p className="market-eyebrow">02 · Role matching</p><h2 style={{ fontSize: 25 }}>A lexical readiness heuristic</h2><p>The match compares profile skills, interests, and experience with indexed role requirements. It uses lexical matching—not semantic AI, an employer assessment, or a probability of being hired.</p>
        <div className="market-grid" style={{ marginTop: 10 }}>
          <div className="market-card market-span-4"><span className="market-stat">{methods?.skill_points ?? 75}</span><p>skill points</p></div><div className="market-card market-span-4"><span className="market-stat">{methods?.interest_points ?? 15}</span><p>interest points</p></div><div className="market-card market-span-4"><span className="market-stat">{methods?.experience_points ?? 10}</span><p>experience points</p></div>
        </div>
        <ul className="market-list">
          <li>These are weighted component points, not a percentage or hiring odds.</li>
          <li>Beginner skill evidence contributes half credit; Working and Confident count fully against the Working target level where that rule applies.</li>
          <li>Target skill level: {methods?.target_skill_level ?? 2}. Weights: {methods?.skill_points ?? 75} skill / {methods?.interest_points ?? 15} interest / {methods?.experience_points ?? 10} experience points.</li>
          <li>Aliases support lexical comparison; the snapshot does not expose which raw alias strings were observed per posting.</li>
          <li>Balanced, AI acceleration, and Human-centred are alternative what-if scenarios, not forecasts. Scenario-specific numeric multipliers are not exposed in the public methodology configuration.</li>
        </ul>
        {methods?.aliases ? <p className="market-small">The catalog exposes {Object.keys(methods.aliases).length} configured alias entries, not a historical per-alias observation list.</p> : <p className="market-small">Alias configuration is not exposed by the loaded catalog response.</p>}
      </article>
      <article className="market-card market-span-5"><p className="market-eyebrow">03 · Learning-hour estimates</p><h2 style={{ fontSize: 25 }}>Planning assumptions, not guarantees</h2><p>Pathway hours are editorial planning estimates—not credential duration, job readiness, or an employment promise.</p><div className="market-rule" />
        <div className="market-row"><span>Learn a new skill</span><span className="market-mono">{methods?.new_skill_hours != null ? `${methods.new_skill_hours} hours` : "Not supplied"}</span></div>
        <div className="market-row"><span>Improve an existing skill</span><span className="market-mono">{methods?.improve_skill_hours != null ? `${methods.improve_skill_hours} hours` : "Not supplied"}</span></div>
        <div className="market-row"><span>Build a project</span><span className="market-mono">{methods?.project_hours != null ? `${methods.project_hours} hours` : "Not supplied"}</span></div><p className="market-small">Values are read from the catalog methodology config; missing values remain unavailable.</p>
      </article>
    </section>

    <section className="market-grid">
      <article className="market-card market-span-6"><p className="market-eyebrow">04 · Course index</p><h2 style={{ fontSize: 24 }}>Bounded catalog matches</h2>
        {demand.isLoading ? <LoadingBlock /> : demand.isError ? <div className="market-error"><strong>Course example could not be loaded.</strong><button className="market-button secondary" onClick={() => void demand.refetch()}>Retry</button></div> : !skill ? <div className="market-empty">No indexed skill is currently available for an example response.</div> : courses.isLoading ? <LoadingBlock /> : courses.isError ? <div className="market-error"><strong>Course-method details unavailable.</strong><button className="market-button secondary" onClick={() => void courses.refetch()}>Retry</button></div> : courses.data ? <><p><strong>Example skill:</strong> {skill} · <strong>matches:</strong> {fmtNum(courses.data.total_matches)}</p><p><strong>Matching method:</strong> {courses.data.method || "Not supplied by catalog"}</p><p><strong>Disclaimer:</strong> {courses.data.disclaimer || "Not supplied by catalog"}</p><p>The course index does not measure skill demand or course quality. Overview reports {fmtNum(data.course_count)} indexed records.</p></> : <div className="market-empty">Course method and disclaimer are not exposed.</div>}
      </article>
      <article className="market-card market-span-6"><p className="market-eyebrow">05 · Global outlook source</p><h2 style={{ fontSize: 24 }}>Separate context, separate provenance</h2>
        {signals.isLoading ? <LoadingBlock /> : signals.isError ? <div className="market-error"><strong>Global outlook source details unavailable.</strong><button className="market-button secondary" onClick={() => void signals.refetch()} data-testid="button-global-source-retry"><RefreshCw size={15} /> Retry</button></div> : methodSignal ? <><p><strong>{methodSignal.source_title || "Source title not supplied"}</strong></p><p className="market-small">Published {fmtDate(methodSignal.published_at)} · retrieved {fmtDate(methodSignal.retrieved_at)} · checked {fmtDate(methodSignal.checked_at)} · status {methodSignal.status || "unknown"}.</p>{methodSignal.source_url ? <p><a className="market-inline-link" href={methodSignal.source_url} target="_blank" rel="noreferrer">Open source <ExternalLink size={13} style={{ display: "inline" }} /></a></p> : <p className="market-small">Source URL not supplied.</p>}<p>{methodSignal.scope || "Scope not supplied."}</p><p>{methodSignal.caveat || "No caveat supplied."}</p>{methodSignal.error && <p className="market-pill warn">{methodSignal.error}</p>}</> : <div className="market-empty">Global outlook metadata was not returned.</div>}
      </article>
    </section>
    <section className="market-card" style={{ marginTop: 16 }}><p className="market-eyebrow">Editorial connections</p><h2 style={{ fontSize: 22 }}>Sustainable Development Goals</h2><p>Role and skill connections to the SDGs are editorial associations for exploration—not UN endorsement, measured impact, or a claim about the role.</p><Link href="/roles" className="market-inline-link">Explore role evidence <ExternalLink size={13} style={{ display: "inline" }} /></Link></section>
  </div></div>;
}
