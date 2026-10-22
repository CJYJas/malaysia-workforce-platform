import { useMemo, useState } from "react";
import { Link, useParams, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw, Search } from "lucide-react";
import { getGetCourseCatalogQueryKey, getGetSkillDemandQueryKey, useGetCourseCatalog, useGetJourneyCatalog, useGetSkillDemand, useGetWorkforceOverview } from "@workspace/api-client-react";
import { PageHeader } from "@/components/shell";
import "../market.css";

type SdgLink = { id: number; title: string; url: string; reason: string };
type CatalogRole = { id: string; name: string; description: string; sdgs?: SdgLink[] };
type CatalogPlus = { roles?: CatalogRole[] };
type RoleDatum = { name: string; description: string; postings: number; sample_warning: boolean };
type SkillDatum = { rank: number; skill: string; category: string; mention_count: number; posting_share: number; posting_share_percentage: number };
const asCatalogRoles = (value: unknown) => (value as CatalogPlus | undefined)?.roles || [];
const prettyDate = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "Not supplied";
const share = (skill: SkillDatum) => skill.posting_share_percentage ?? skill.posting_share * 100;

function LoadingCard() {
  return <div className="market-loading" aria-label="Loading roles"><div className="market-skeleton" style={{ width: "42%" }} /><div className="market-skeleton" /><div className="market-skeleton" style={{ width: "69%" }} /></div>;
}
function ErrorBlock({ retry }: { retry: () => void }) {
  return <div className="market-error" role="alert"><strong>Role data could not be loaded.</strong><p>Try again in a moment. No matching target or journey progress has been changed.</p><button className="market-button secondary" onClick={retry} data-testid="button-roles-retry"><RefreshCw size={15} /> Retry</button></div>;
}

function RolePreviewCard({ role, roleId }: { role: RoleDatum; roleId: string }) {
  const demand = useGetSkillDemand({ role: role.name }, { query: { enabled: !!role.name, queryKey: getGetSkillDemandQueryKey({ role: role.name }) } });
  const topSkills = [...(demand.data?.skills || [])]
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3) as SkillDatum[];
  const lowSample = role.sample_warning || !!demand.data?.sample_size_warning;
  return <article className="market-card market-role-card" data-testid={`card-role-${roleId}`}>
    <div className="market-role-card-head">
      <div>
        <h2 className="market-role-title">{role.name}</h2>
        <p className="market-role-description">{role.description || "Description not supplied by the snapshot."}</p>
      </div>
      <div className="market-role-count">
        <span className="market-mono">{role.postings.toLocaleString()}</span>
        <span className="market-small">postings</span>
      </div>
    </div>
    <div className="market-role-status">
      {lowSample ? <span className="market-pill warn" data-testid={`status-role-sample-${roleId}`}>Low sample · interpret carefully</span> : <span className="market-pill">No low-sample flag</span>}
      {demand.data?.time_window && <span className="market-small">{demand.data.time_window}</span>}
    </div>
    <div className="market-role-skills" aria-label={`Top skills for ${role.name}`}>
      <p className="market-label">Top observed skills</p>
      {demand.isLoading ? <div className="market-preview-state" aria-label={`Loading skill preview for ${role.name}`}><span className="market-skeleton" /><span className="market-skeleton" /><span className="market-skeleton" /></div>
        : demand.isError ? <div className="market-preview-state market-preview-message" role="status"><span>Skill preview unavailable.</span><button type="button" className="market-inline-action" onClick={() => void demand.refetch()} data-testid={`button-role-preview-retry-${roleId}`}>Retry</button></div>
          : topSkills.length ? <ol className="market-preview-list">{topSkills.map((skill) => <li key={skill.skill}><span>{skill.skill}</span><span className="market-mono">{share(skill).toFixed(1)}%</span></li>)}</ol>
            : <p className="market-preview-message" role="status">{demand.data?.status ? `No indexed skill rows (${demand.data.status}).` : "No indexed skills are available for this role."}</p>}
    </div>
    <Link href={`/roles/${encodeURIComponent(roleId)}`} className="market-link-button secondary market-explore-link" data-testid={`link-role-${roleId}`}>Explore role <ArrowRight size={15} /></Link>
  </article>;
}

export function RoleExplorerPage() {
  const overview = useGetWorkforceOverview();
  const catalog = useGetJourneyCatalog();
  const search = useSearch();
  const requestedId = new URLSearchParams(search).get("role") || "";
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "postings">("name");
  const catalogRoles = asCatalogRoles(catalog.data);
  const roles = useMemo(() => {
    const items = (overview.data?.roles || []).filter((role: RoleDatum) => role.name.toLowerCase().includes(query.trim().toLowerCase()));
    return [...items].sort((a: RoleDatum, b: RoleDatum) => sort === "name" ? a.name.localeCompare(b.name) : b.postings - a.postings);
  }, [overview.data, query, sort]);
  if (overview.isLoading || catalog.isLoading) return <div className="market-shell"><PageHeader kicker="Market intelligence" title="Explore Malaysian roles">A public catalogue of role evidence, independent of your profile.</PageHeader><LoadingCard /></div>;
  if (overview.isError || catalog.isError) return <div className="market-shell"><PageHeader kicker="Market intelligence" title="Explore Malaysian roles">A public catalogue of role evidence, independent of your profile.</PageHeader><ErrorBlock retry={() => { void overview.refetch(); void catalog.refetch(); }} /></div>;
  const requested = catalogRoles.find((role) => role.id === requestedId);
  const startRole = requested && overview.data?.roles.find((role: RoleDatum) => role.name === requested.name);
  return <div className="market-page"><div className="market-shell">
    <header className="market-hero"><p className="market-eyebrow">FutureReady MY · Role library</p><h1 className="market-title">A clearer view of the work ahead.</h1><p className="market-lede">Explore roles indexed from a Malaysian job-posting snapshot. These counts describe the dataset, not the whole labour market or a forecast.</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}><span className="market-pill">{overview.data?.roles.length || 0} roles in this snapshot</span><span className="market-pill">Coverage {prettyDate(overview.data?.coverage_start)} — {prettyDate(overview.data?.coverage_end)}</span></div></header>
    {startRole && requested && <div className="market-card" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 16, borderColor: "#c66b4e" }}><div><span className="market-eyebrow">Shared role link</span><p style={{ margin: 0 }}>You were sent to <strong>{requested.name}</strong>. Explore its evidence without changing your confirmed journey target.</p></div><Link className="market-link-button secondary" href={`/roles/${encodeURIComponent(requested.id)}`}>Open role evidence <ArrowRight size={15} /></Link></div>}
    <div className="market-toolbar">
      <label className="market-field" style={{ maxWidth: 450 }}><span className="market-label">Find a role</span><span style={{ position: "relative", display: "block" }}><Search size={15} style={{ position: "absolute", left: 11, top: 14, color: "#63736d" }} /><input className="market-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by role name" style={{ paddingLeft: 34 }} data-testid="input-role-search" /></span></label>
      <label className="market-field" style={{ maxWidth: 220 }}><span className="market-label">Sort roles</span><select className="market-select" value={sort} onChange={(e) => setSort(e.target.value as "name" | "postings")} data-testid="select-role-sort"><option value="name">Role name</option><option value="postings">Snapshot postings</option></select></label>
    </div>
    {!roles.length ? <div className="market-empty"><strong>No roles match this search.</strong><p>Try a broader role name.</p></div> : <section className="market-role-grid" aria-label="Malaysian role catalogue">
      {roles.map((role: RoleDatum) => {
        const entry = catalogRoles.find((item) => item.name === role.name);
        return <RolePreviewCard key={role.name} role={role} roleId={entry?.id || role.name} />;
      })}
    </section>}
    <section className="market-grid">
      <div className="market-card market-span-7"><p className="market-eyebrow">Read the evidence carefully</p><h2 style={{ fontSize: 22 }}>A snapshot, not a promise</h2><p>Posting volume and skill shares reflect indexed records inside the stated source window. They are not vacancy totals, salaries, growth rates, or a personalized match score.</p><Link href="/methodology" className="market-inline-link">Read the methodology <ArrowRight size={14} style={{ display: "inline", verticalAlign: "middle" }} /></Link></div>
      <div className="market-card market-span-5"><p className="market-eyebrow">Your next step</p><h2 style={{ fontSize: 22 }}>Profile → Radar → Matches → Pathway</h2><p>Role exploration is public. The guided sequence remains separate; choosing a role here does not confirm a target or unlock later steps.</p><Link className="market-link-button secondary" href="/profile">Start with your profile <ArrowRight size={15} /></Link></div>
    </section>
  </div></div>;
}

export function RoleDetailPage() {
  const { roleId = "" } = useParams<{ roleId: string }>();
  const overview = useGetWorkforceOverview();
  const catalog = useGetJourneyCatalog();
  const catalogRoles = asCatalogRoles(catalog.data);
  const decodedId = decodeURIComponent(roleId);
  const entry = catalogRoles.find((role) => role.id === decodedId) || catalogRoles.find((role) => role.name === decodedId);
  const role = overview.data?.roles.find((item: RoleDatum) => item.name === entry?.name);
  const demand = useGetSkillDemand({ role: role?.name || "" }, { query: { enabled: !!role?.name, queryKey: getGetSkillDemandQueryKey({ role: role?.name || "" }) } });
  const [selectedSkill, setSelectedSkill] = useState("");
  const [searchSkill, setSearchSkill] = useState("");
  const [category, setCategory] = useState("All categories");
  const [sort, setSort] = useState<"share" | "name">("share");
  const skills = (demand.data?.skills || []) as SkillDatum[];
  const categories = useMemo(() => ["All categories", ...Array.from(new Set(skills.map((item) => item.category || "Unclassified"))).sort()], [skills]);
  const visible = useMemo(() => skills.filter((item) => item.skill.toLowerCase().includes(searchSkill.trim().toLowerCase()) && (category === "All categories" || (item.category || "Unclassified") === category)).sort((a, b) => sort === "share" ? share(b) - share(a) : a.skill.localeCompare(b.skill)).slice(0, 10), [skills, searchSkill, category, sort]);
  const active = skills.find((item) => item.skill === selectedSkill) || visible[0] || skills[0];
  const courseParams = { skill: active?.skill || "", page: 1, page_size: 3 };
  const courses = useGetCourseCatalog(courseParams, { query: { enabled: !!active?.skill, queryKey: getGetCourseCatalogQueryKey(courseParams) } });
  if (overview.isLoading || catalog.isLoading) return <div className="market-shell"><LoadingCard /></div>;
  if (overview.isError || catalog.isError) return <div className="market-shell"><ErrorBlock retry={() => { void overview.refetch(); void catalog.refetch(); }} /></div>;
  if (!entry || !role) return <div className="market-page"><div className="market-shell"><div className="market-empty"><p className="market-eyebrow">Role not found</p><h1 style={{ margin: "0 0 8px" }}>This role is not in the current snapshot.</h1><p>It may not have a matching catalogue ID, or the source snapshot may have changed.</p><Link className="market-link-button secondary" href="/roles"><ArrowLeft size={15} /> Browse roles</Link></div></div></div>;
  const sdgs = entry.sdgs || [];
  return <div className="market-page"><div className="market-shell">
    <Link href="/roles" className="market-inline-link" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 0 18px" }}><ArrowLeft size={15} /> All roles</Link>
    <header className="market-hero"><p className="market-eyebrow">Malaysian snapshot role · {role.postings.toLocaleString()} indexed postings</p><h1 className="market-title">{role.name}</h1><p className="market-lede">{role.description || entry.description || "No role description is supplied in the source snapshot."}</p><div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 20 }}><Link className="market-link-button" href={`/role-matches?role=${encodeURIComponent(entry.id)}`}>Check My Match <ArrowRight size={15} /></Link><Link className="market-link-button secondary" href={`/pathway?role=${encodeURIComponent(entry.id)}`}>Build Pathway <ArrowRight size={15} /></Link></div><p className="market-small" style={{ position: "relative", zIndex: 1 }}>These links retain the required profile and confirmed-match gates. Browsing does not change journey state.</p></header>
    <section className="market-grid">
      <div className="market-card market-span-8"><p className="market-eyebrow">Demand evidence</p><div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 10, alignItems: "center" }}><h2 style={{ fontSize: 24 }}>Skills in the snapshot</h2><span className="market-pill">{demand.data?.denominator ?? role.postings} posting denominator</span></div>
        {demand.isLoading ? <LoadingCard /> : demand.isError ? <div className="market-error" role="alert"><strong>Skill evidence unavailable.</strong><button className="market-button secondary" onClick={() => void demand.refetch()} data-testid="button-role-demand-retry"><RefreshCw size={15} /> Retry</button></div> : <>
          {demand.data?.sample_size_warning && <p className="market-pill warn" role="note" data-testid="status-role-low-sample">{demand.data.warning_message || "Low sample warning: interpret role percentages with care."}</p>}
          <div className="market-toolbar" style={{ marginBottom: 10 }}>
            <label className="market-field" style={{ maxWidth: 280 }}><span className="market-label">Search top skills</span><input className="market-input" value={searchSkill} onChange={(e) => setSearchSkill(e.target.value)} placeholder="Observed term" data-testid="input-role-skill-search" /></label>
            <label className="market-field" style={{ maxWidth: 190 }}><span className="market-label">Category</span><select className="market-select" value={category} onChange={(e) => setCategory(e.target.value)} data-testid="select-role-skill-category">{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label className="market-field" style={{ maxWidth: 165 }}><span className="market-label">Sort by</span><select className="market-select" value={sort} onChange={(e) => setSort(e.target.value as "share" | "name")} data-testid="select-role-skill-sort"><option value="share">Posting share</option><option value="name">Skill name</option></select></label>
          </div>
          {demand.data?.scope_note && <p className="market-small">{demand.data.scope_note}</p>}
          {visible.length ? visible.map((item) => <button key={item.skill} onClick={() => setSelectedSkill(item.skill)} className="market-row" style={{ width: "100%", borderTop: 0, borderLeft: 0, borderRight: 0, background: active?.skill === item.skill ? "#f3f5ed" : "transparent", textAlign: "left", cursor: "pointer" }} aria-pressed={active?.skill === item.skill} data-testid={`button-role-skill-${item.rank}`}>
            <span><span className="market-row-title" style={{ display: "block" }}>{item.skill}</span><span className="market-small">{item.category || "Unknown / unclassified"} · {item.mention_count} mentions</span></span><span><span className="market-bar-track" style={{ display: "block" }}><span className="market-bar" style={{ display: "block", width: `${Math.max(0, Math.min(100, share(item)))}%` }} /></span></span><span className="market-mono">{share(item).toFixed(1)}%</span></button>) : <div className="market-empty">No top skills match your filters.</div>}
          <p className="market-small">Top 10 shown from this fixed snapshot · {demand.data?.time_window || "date window not supplied"} · {demand.data?.denominator ?? role.postings} denominator. This view does not provide monthly changes. Raw phrases and alias-level counts are not exposed; matching aliases are not evidence of observed terms.</p>
        </>}
      </div>
      <div className="market-card market-span-4"><p className="market-eyebrow">Course index</p><h2 style={{ fontSize: 22 }}>{active?.skill || "Choose a skill"}</h2>
        {!active ? <div className="market-empty">No indexed skill rows are available for this role.</div> : courses.isLoading ? <LoadingCard /> : courses.isError ? <div className="market-error"><strong>Course matches unavailable.</strong><button className="market-button secondary" onClick={() => void courses.refetch()} data-testid="button-role-course-retry">Retry</button></div> : courses.data ? <><p><strong>{courses.data.total.toLocaleString()}</strong> matches in the bounded course index.</p><p className="market-small">{courses.data.scope_note}</p><p className="market-small">{courses.data.indexed_total.toLocaleString()} indexed records · {courses.data.source_total.toLocaleString()} source records</p>{courses.data.items.map((course) => <div key={course.id} className="market-sdg">
          <Link className="market-inline-link" href={`/courses?course=${encodeURIComponent(course.id)}&skill=${encodeURIComponent(active.skill)}`} data-testid={`link-role-course-detail-${course.id}`}>{course.title}</Link>
          <div className="market-small">{course.provider || "Provider not recorded"} · {course.level || "Level not recorded"}{course.duration_hours != null ? ` · ${course.duration_hours}h` : " · duration not recorded"}</div>
          {course.url && <a className="market-inline-link" href={course.url} target="_blank" rel="noreferrer noopener" data-testid={`link-role-course-provider-${course.id}`}>Original provider page <ExternalLink size={13} style={{ display: "inline" }} /></a>}
        </div>)}<div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 13 }}><Link className="market-link-button secondary" href={`/courses?skill=${encodeURIComponent(active.skill)}`}>Browse courses</Link><Link className="market-link-button secondary" href="/compare">Compare</Link></div></> : <p className="market-small">Course metadata is unavailable.</p>}
      </div>
      {sdgs.length > 0 && <div className="market-card market-span-12"><p className="market-eyebrow">Editorial connections</p><h2 style={{ fontSize: 22 }}>Related Sustainable Development Goals</h2><p>These role connections are editorial context, not an endorsement by the United Nations.</p><div className="market-grid" style={{ marginTop: 4 }}>{sdgs.map((sdg) => <article className="market-card market-span-4 market-sdg" key={sdg.id}>
        <Link className="market-inline-link" href={`/sdg-alignment?goal=${sdg.id}`} title={sdg.reason} aria-label={`Open Goal ${sdg.id}: ${sdg.title}. ${sdg.reason}`} data-testid={`link-role-sdg-${sdg.id}`}>
          <span className="market-pill">SDG {sdg.id}</span><h3 style={{ marginTop: 10 }}>{sdg.title}</h3><p className="market-small">{sdg.reason}</p><span>View catalogue connection</span>
        </Link>
        <a className="market-inline-link" href={sdg.url} target="_blank" rel="noreferrer noopener" aria-label={`Official United Nations information for Goal ${sdg.id}: ${sdg.title}`} data-testid={`link-role-sdg-official-${sdg.id}`}>UN goal information <ExternalLink size={13} style={{ display: "inline" }} /></a>
      </article>)}</div></div>}
    </section>
    <section className="market-card" style={{ marginTop: 16 }}><p className="market-eyebrow">Source and scope</p><h2 style={{ fontSize: 21 }}>Dataset coverage</h2><p className="market-small">Malaysia · {overview.data?.coverage_start || "coverage start unknown"} to {overview.data?.coverage_end || "coverage end unknown"} · processed {prettyDate(overview.data?.processed_at)}. {overview.data?.repository_url ? <a className="market-inline-link" href={overview.data.repository_url} target="_blank" rel="noreferrer">Source repository <ExternalLink size={13} style={{ display: "inline" }} /></a> : "Repository URL not supplied."}</p><Link className="market-inline-link" href="/methodology">Read source details and limitations <ArrowRight size={14} style={{ display: "inline" }} /></Link></section>
  </div></div>;
}
