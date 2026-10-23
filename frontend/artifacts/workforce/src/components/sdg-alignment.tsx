import { useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowUpRight, BookOpen, BriefcaseBusiness, ExternalLink, Info } from "lucide-react";
import { useGetJourneyCatalog } from "@workspace/api-client-react";
import { ErrorPanel, PageHeader } from "@/components/shell";
import "../courses.css";

const goalTitles = [
  "No Poverty", "Zero Hunger", "Good Health and Well-being", "Quality Education", "Gender Equality",
  "Clean Water and Sanitation", "Affordable and Clean Energy", "Decent Work and Economic Growth",
  "Industry, Innovation and Infrastructure", "Reduced Inequalities", "Sustainable Cities and Communities",
  "Responsible Consumption and Production", "Climate Action", "Life Below Water", "Life on Land",
  "Peace, Justice and Strong Institutions", "Partnerships for the Goals",
];
const goalUrl = (id: number) => `https://sdgs.un.org/goals/${id}`;

export function SdgAlignment() {
  const query = useGetJourneyCatalog();
  const search = useSearch();
  const [location, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const rawGoal = params.get("goal");
  const selected = rawGoal && /^\d+$/.test(rawGoal) && Number(rawGoal) >= 1 && Number(rawGoal) <= 17 ? Number(rawGoal) : null;
  const catalog = query.data;
  const mappings = (id: number) => ({
    roles: (catalog?.roles || []).filter((role) => role.sdgs.some((item) => item.id === id)),
    skills: (catalog?.skill_sdgs || []).filter((row) => row.sdgs.some((item) => item.id === id)),
  });
  const selectGoal = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set("goal", String(id)); else next.delete("goal");
    const value = next.toString();
    const path = location.split("?")[0] || "/sdg-alignment";
    navigate(`${path}${value ? `?${value}` : ""}`);
  };
  const invalidGoal = rawGoal !== null && !selected;

  return <main className="course-page course-shell sdg-page">
    <PageHeader kicker="Skills with purpose · public catalogue" title="Explore the 17 global goals.">
      Browse the official Sustainable Development Goals and see which public role and skill records have editorial links in this catalogue.
    </PageHeader>
    <div className="sdg-editorial-note" data-testid="text-sdg-methodology"><Info size={18} /><p>These are editorial connections between catalogue records and goals—not UN or employer endorsement, evidence of an employer’s intent, or measured social impact.</p></div>
    {invalidGoal && <p className="sdg-invalid" role="status" data-testid="status-sdg-invalid">That goal number is not valid. Choose one of the 17 goals below.</p>}
    {query.isLoading && <div className="sdg-loading" role="status" aria-label="Loading goal mappings">{[1, 2, 3, 4, 5, 6].map((n) => <div key={n} />)}</div>}
    {query.isError && <ErrorPanel message="Public goal mappings could not be loaded. The 17 official goals remain available to browse." onRetry={() => void query.refetch()} />}
    <section className="sdg-grid" aria-label="All 17 Sustainable Development Goals">
          {goalTitles.map((title, index) => {
            const id = index + 1;
            const linked = mappings(id);
            const active = selected === id;
            return <article className={`sdg-card ${active ? "is-selected" : ""}`} key={id} data-testid={`card-sdg-${id}`}>
              <button type="button" className="sdg-card-select" onClick={() => selectGoal(active ? null : id)} aria-pressed={active} data-testid={`button-sdg-select-${id}`}>
                <span className="sdg-number">GOAL <strong>{String(id).padStart(2, "0")}</strong></span>
                <span className="sdg-card-title">{title}</span>
                <span className="sdg-card-count">{catalog ? `${linked.roles.length} roles · ${linked.skills.length} skills linked` : query.isError ? "Catalogue mappings unavailable" : "Catalogue mappings loading"}</span>
              </button>
              <a className="sdg-official-link" href={goalUrl(id)} target="_blank" rel="noreferrer noopener" data-testid={`link-sdg-official-${id}`}>Official UN goal <ExternalLink size={13} /></a>
              {active && <div className="sdg-detail" data-testid={`detail-sdg-${id}`}>
                {!catalog ? <div className="sdg-no-mapping" role="status">Catalogue mappings are not available yet. Retry to load role and skill connections.</div>
                  : linked.roles.length || linked.skills.length ? <>
                  <p className="sdg-detail-intro">Catalogue records connected to Goal {id}</p>
                  {linked.roles.map((role) => {
                    const note = role.sdgs?.find((item) => item.id === id);
                    return <div className="sdg-mapping" key={`role-${role.id}`}><BriefcaseBusiness size={16} /><div><strong>{role.name}</strong><p>{note?.reason || "Editorial rationale not supplied."}</p><Link href={`/roles?role=${encodeURIComponent(role.id)}`} data-testid={`link-sdg-role-${role.id}`}>View public role evidence <ArrowUpRight size={14} /></Link></div></div>;
                  })}
                  {linked.skills.map((row) => {
                    const note = row.sdgs.find((item) => item.id === id);
                    return <div className="sdg-mapping" key={`skill-${row.skill}`}><BookOpen size={16} /><div><strong>{row.skill}</strong><p>{note?.reason || "Editorial rationale not supplied."}</p><Link href={`/courses?skill=${encodeURIComponent(row.skill)}`} data-testid={`link-sdg-skill-${row.skill}`}>Search indexed courses for this skill <ArrowUpRight size={14} /></Link></div></div>;
                  })}
                </> : <div className="sdg-no-mapping" data-testid={`status-sdg-no-mapping-${id}`}><strong>No role or skill links are recorded for this goal.</strong><p>The public catalogue does not currently map a role or skill to this goal. No contribution or impact is inferred.</p></div>}
              </div>}
            </article>;
          })}
    </section>
    <p className="course-footnote">All 17 goals remain browseable, including goals without catalogue mappings. Goal titles and descriptions belong to the United Nations; catalogue links are editorial context only.</p>
  </main>;
}
