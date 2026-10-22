import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { getGetSkillCoursesQueryKey, getGetSkillDemandQueryKey, useGetJourneyCatalog, useGetSkillCourses, useGetSkillDemand, useGetWorkforceOverview } from "@workspace/api-client-react";
import { useJourney } from "@/lib/journey";
import "../market.css";

type MarketSkill = { rank: number; skill: string; category: string; mention_count: number; posting_share: number; posting_share_percentage: number };
type ExtendedCatalog = { roles?: Array<{ id: string; name: string; sdgs?: Array<{ id: number; title: string; url: string; reason: string }> }> };
const pct = (n: number) => `${Number(n).toFixed(1)}%`;

function LoadingRadar() {
  return <div className="market-loading" aria-label="Loading Malaysian role data"><div className="market-skeleton" style={{ width: "38%" }} /><div className="market-skeleton" /><div className="market-skeleton" style={{ width: "76%" }} /><div className="market-skeleton" style={{ width: "54%" }} /></div>;
}

export function MalaysianRadar() {
  const overview = useGetWorkforceOverview();
  const catalog = useGetJourneyCatalog();
  const searchString = useSearch();
  const { selectedRole } = useJourney();
  const params = new URLSearchParams(searchString);
  const initialRoleId = params.get("role") || selectedRole;
  const [roleChoice, setRole] = useState("");
  const requestedRole = catalog.data?.roles.find(item => item.id === initialRoleId);
  const role = roleChoice || (initialRoleId && !catalog.data ? "" : requestedRole?.name || overview.data?.roles[0]?.name || "");
  const [skill, setSkill] = useState(params.get("skill") || "");
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("All categories");
  const [sort, setSort] = useState<"share" | "name">("share");

  useEffect(() => {
    const query = new URLSearchParams(searchString);
    setRole(""); setSkill(query.get("skill") || ""); setFilter(""); setCategory("All categories");
  }, [searchString]);
  const demand = useGetSkillDemand({ role }, { query: { enabled: !!role, queryKey: getGetSkillDemandQueryKey({ role }) } });
  const skills = (demand.data?.skills || []) as MarketSkill[];
  const categories = useMemo(() => ["All categories", ...Array.from(new Set(skills.map((s) => s.category || "Unclassified"))).sort()], [skills]);
  const visible = useMemo(() => skills.filter((item) =>
    item.skill.toLowerCase().includes(filter.trim().toLowerCase()) &&
    (category === "All categories" || (item.category || "Unclassified") === category)
  ).sort((a, b) => sort === "share" ? b.posting_share - a.posting_share : a.skill.localeCompare(b.skill)), [skills, filter, category, sort]);
  const selectedSkill = skills.find((item) => item.skill === skill) || skills[0];
  const activeSkill = selectedSkill?.skill || "";
  const courses = useGetSkillCourses({ skill: activeSkill }, { query: { enabled: !!activeSkill, queryKey: getGetSkillCoursesQueryKey({ skill: activeSkill }) } });

  if (overview.isLoading || catalog.isLoading) return <section className="market-radar"><p className="market-eyebrow">Malaysian hiring snapshot</p><LoadingRadar /></section>;
  if (overview.isError || catalog.isError) return <section className="market-error" role="alert"><strong>Market snapshot unavailable.</strong><p>We could not load the current role catalogue. Your saved journey is unchanged.</p><button className="market-button secondary" onClick={() => { void overview.refetch(); void catalog.refetch(); }} data-testid="button-radar-retry"><RefreshCw size={15} /> Retry</button></section>;
  if (!overview.data?.roles.length) return <section className="market-empty"><strong>No role snapshot is available.</strong><p>There are no indexed roles to show at this time.</p></section>;

  return <section className="market-radar" aria-labelledby="market-radar-title">
    <div className="market-radar-head">
      <div><p className="market-eyebrow">Market intelligence · fixed snapshot</p><h2 id="market-radar-title" style={{ margin: 0, fontSize: 25, letterSpacing: "-.035em" }}>What Malaysian postings ask for</h2><p className="market-small" style={{ maxWidth: 650, marginBottom: 0 }}>Observed skills for a selected role, not a forecast. Every share uses the role snapshot denominator and this one all-snapshot period.</p></div>
      <div className="market-field" style={{ maxWidth: 320, flexBasis: 220 }}><label className="market-label" htmlFor="radar-role">Role in this view</label><select className="market-select" id="radar-role" value={role} onChange={(e) => { setRole(e.target.value); setSkill(""); }} data-testid="select-radar-role">{overview.data.roles.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></div>
    </div>
    {demand.isLoading ? <div style={{ marginTop: 18 }}><LoadingRadar /></div> : demand.isError ? <div className="market-error" style={{ marginTop: 18 }} role="alert"><strong>Skills for this role could not be loaded.</strong><p>Retry the demand snapshot. Other parts of your journey remain available.</p><button className="market-button secondary" onClick={() => void demand.refetch()} data-testid="button-radar-demand-retry"><RefreshCw size={15} /> Retry</button></div> : !skills.length ? <div className="market-empty" style={{ marginTop: 18 }}>No skill rows are indexed for this role snapshot.</div> : <>
      <div className="market-toolbar">
        <label className="market-field" style={{ maxWidth: 280 }}><span className="market-label">Search skills</span><span style={{ position: "relative", display: "block" }}><Search size={15} style={{ position: "absolute", left: 11, top: 14, color: "#63736d" }} /><input className="market-input" style={{ paddingLeft: 34 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find an observed term" data-testid="input-radar-skill-search" /></span></label>
        <label className="market-field" style={{ maxWidth: 220 }}><span className="market-label">Category</span><select className="market-select" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-radar-category">{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
        <label className="market-field" style={{ maxWidth: 190 }}><span className="market-label">Sort rows</span><select className="market-select" value={sort} onChange={(e) => setSort(e.target.value as "share" | "name")} data-testid="select-radar-sort"><option value="share">Posting share</option><option value="name">Skill name</option></select></label>
        <span className="market-pill" style={{ marginTop: 22 }}>{demand.data?.denominator ?? 0} postings · {demand.data?.time_window || "date not supplied"}</span>
      </div>
      {demand.data?.sample_size_warning && <p className="market-pill warn" role="note" data-testid="status-radar-sample-warning">{demand.data.warning_message || "Use caution: this role snapshot is based on a limited sample."}</p>}
      {demand.data?.scope_note && <p className="market-small">{demand.data.scope_note}</p>}
      <div className="market-skill-grid">
        {visible.map((item) => {
          const value = item.posting_share_percentage ?? item.posting_share * 100;
          return <div key={item.skill} className={`market-skill-item ${item.skill === activeSkill ? "selected" : ""}`} data-testid={`radar-skill-${item.rank}`}>
            <button onClick={() => setSkill(item.skill)} aria-pressed={item.skill === activeSkill} data-testid={`button-radar-skill-${item.rank}`}>{item.skill}</button>
            <div><div className="market-bar-track" aria-label={`${pct(value)} of role postings`}><div className="market-bar" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div><span className="market-small">{item.category || "Unclassified"} · {item.mention_count} mentions</span></div>
            <span className="market-mono">{pct(value)}</span>
          </div>;
        })}
        {!visible.length && <div className="market-empty">No observed skills match these filters.</div>}
      </div>
      {selectedSkill && <div className="market-grid" style={{ marginTop: 18 }}>
        <div className="market-card market-span-7" style={{ padding: 17 }}>
          <p className="market-eyebrow">Selected observed term</p><h3 style={{ fontSize: 20 }}>{selectedSkill.skill}</h3>
          <p className="market-small">{selectedSkill.mention_count} mentions across {demand.data?.denominator ?? 0} postings ({pct(selectedSkill.posting_share_percentage ?? selectedSkill.posting_share * 100)}), {demand.data?.time_window || "time period not supplied"}. Category: {selectedSkill.category || "unknown / unclassified"}.</p>
          <p className="market-small">Raw phrase counts and alias-level observations are not exposed in this snapshot. Configured matching aliases should not be read as observed posting terms.</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}><Link className="market-link-button secondary" href={`/courses?skill=${encodeURIComponent(selectedSkill.skill)}`}>Browse exact-skill courses <ExternalLink size={14} /></Link><Link className="market-link-button secondary" href="/compare">Compare courses</Link></div>
        </div>
        <div className="market-card market-span-5" style={{ padding: 17 }}>
          <p className="market-eyebrow">Course index · separate evidence</p>
          {courses.isLoading ? <div className="market-skeleton" /> : courses.isError ? <div className="market-error"><strong>Course matches unavailable.</strong><button className="market-button secondary" onClick={() => void courses.refetch()} data-testid="button-radar-course-retry">Retry</button></div> : courses.data ? <>
            <h3 style={{ fontSize: 20 }}>{courses.data.total_matches} indexed matches</h3><p className="market-small">{courses.data.method || "Matching method not supplied."}</p>
            <p className="market-small">{courses.data.disclaimer || "Course indexing is not a measure of hiring demand."}</p>
            {courses.data.courses.slice(0, 3).map((course) => <div key={course.id} className="market-sdg"><a className="market-inline-link" href={course.url || `/courses?skill=${encodeURIComponent(selectedSkill.skill)}`} target={course.url ? "_blank" : undefined} rel={course.url ? "noreferrer" : undefined}>{course.title}</a><div className="market-small">{course.provider || "Provider not listed"}{course.level ? ` · ${course.level}` : ""}</div></div>)}
          </> : <p className="market-small">Course metadata is not available.</p>}
        </div>
      </div>}
      <p className="market-small" style={{ margin: "18px 0 0" }}>Snapshot source: {overview.data.repository_url ? <a className="market-inline-link" href={overview.data.repository_url} target="_blank" rel="noreferrer">public repository</a> : "source URL not supplied"}. Coverage {overview.data.coverage_start || "unknown"} to {overview.data.coverage_end || "unknown"}; processed {overview.data.processed_at || "date not supplied"}. <Link className="market-inline-link" href="/methodology">How this evidence is built</Link>.</p>
    </>}
  </section>;
}
