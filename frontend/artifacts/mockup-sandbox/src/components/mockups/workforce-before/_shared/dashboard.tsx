import { useMemo, useState } from "react";
import { Link } from "./router";
import { useGetWorkforceOverview, useGetSkillDemand, getGetSkillDemandQueryKey } from "./api";
import { Download, Search, ArrowRight } from "lucide-react";
import { PageHeader, ErrorPanel, Warn } from "./shell";
import { RolePicker } from "./role-picker";
import { CourseList } from "./course-list";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fmtNum, fmtPct, fmtDate, downloadCsv } from "./format";

export default function Dashboard() {
  const ov = useGetWorkforceOverview();
  const [picked, setPicked] = useState("");
  const role = picked || ov.data?.roles[0]?.name || "";
  const demand = useGetSkillDemand({ role }, { query: { enabled: !!role, queryKey: getGetSkillDemandQueryKey({ role }) } });
  const [search, setSearch] = useState("");
  const [skill, setSkill] = useState("");

  const skills = useMemo(() => demand.data?.skills ?? [], [demand.data]);
  const filtered = skills.filter((s) => s.skill.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase()));
  const max = Math.max(...skills.map((s) => s.posting_share_percentage), 1);
  const activeSkill = skill && skills.some((s) => s.skill === skill) ? skill : "";

  if (ov.isError) return <ErrorPanel message="Snapshot overview could not be loaded." onRetry={() => ov.refetch()} />;

  return (
    <div>
      <PageHeader kicker="Skills intelligence" title="What Malaysian employers actually asked for.">
        Top skill mentions per role from historical, deduplicated job postings
        {ov.data && <> ({fmtDate(ov.data.coverage_start)} – {fmtDate(ov.data.coverage_end)})</>}. A fixed repository snapshot, not a live feed.
      </PageHeader>

      {ov.isLoading || !ov.data ? <Skeleton className="h-24 w-full" /> : (
        <section className="rise grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border bg-border mb-8">
          {[
            ["Deduplicated postings (all)", fmtNum(ov.data.total_postings), "every Malaysian posting kept, not only tech"],
            ["Target-role postings", fmtNum(ov.data.target_postings), `${ov.data.roles.length} roles analysed`],
            ["Observed months", fmtNum(ov.data.observed_months), "fixed window"],
            ["Catalog courses", fmtNum(ov.data.course_count), "historical records"],
          ].map(([l, v, sub]) => (
            <div key={l} className="bg-card p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{l}</p>
              <p className="font-serif text-2xl md:text-3xl mt-1" data-testid={`stat-${l}`}>{v}</p>
              <p className="text-[11px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </section>
      )}

      {ov.data && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-3">Choose a role</h2>
          <RolePicker roles={ov.data.roles} value={role} onChange={(r) => { setPicked(r); setSkill(""); setSearch(""); }} />
          <p className="mt-2 text-sm text-muted-foreground">{ov.data.roles.find((r) => r.name === role)?.description}</p>
        </section>
      )}

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
        <section className="rounded-2xl border bg-card p-5 md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-2xl">Share of postings mentioning each skill</h2>
              {demand.data && <p className="text-xs text-muted-foreground mt-1">Denominator: <span className="font-mono">{fmtNum(demand.data.denominator)}</span> {demand.data.role} postings · {demand.data.time_window}</p>}
            </div>
            {demand.data && (
              <button data-testid="button-export-csv" onClick={() => downloadCsv(`${demand.data!.role}-top-skills.csv`, [["rank", "skill", "category", "mention_count", "posting_share_percentage", "denominator"], ...demand.data!.skills.map((s) => [s.rank, s.skill, s.category, s.mention_count, s.posting_share_percentage, demand.data!.denominator])])}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-secondary transition active:scale-[.97]">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}
          </div>

          {demand.data?.warning_message && <div className="mt-4"><Warn>{demand.data.warning_message}</Warn></div>}

          <label className="relative mt-4 block">
            <span className="sr-only">Search within top skills</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter the top skills shown" data-testid="input-skill-search"
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </label>

          {demand.isLoading ? <div className="mt-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
            : demand.isError ? <div className="mt-4"><ErrorPanel message="Demand snapshot could not be loaded." onRetry={() => demand.refetch()} /></div>
            : (
              <ol className="mt-4 space-y-1" data-testid="list-demand">
                {filtered.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No top-ranked skill matches "{search}". Only the top skills in the snapshot are searchable.</li>}
                {filtered.map((s, i) => {
                  const on = s.skill === activeSkill;
                  return (
                    <li key={s.skill}>
                      <button onClick={() => setSkill(on ? "" : s.skill)} aria-pressed={on} data-testid={`button-skill-${s.rank}`}
                        className={cn("w-full text-left rounded-lg px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", on ? "bg-accent" : "hover:bg-secondary")}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span><span className="font-mono text-xs text-muted-foreground w-6 inline-block">{s.rank}</span><span className="font-medium">{s.skill}</span> <span className="text-xs text-muted-foreground">{s.category}</span></span>
                          <span className="font-mono text-xs" title={`${fmtNum(s.mention_count)} of ${fmtNum(demand.data!.denominator)} postings`}>{fmtPct(s.posting_share_percentage)}</span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="grow h-full rounded-full" style={{ width: `${(s.posting_share_percentage / max) * 100}%`, background: on ? "#AB6821" : "#3C7686", animationDelay: `${i * 40}ms` }} />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          {demand.data && <p className="mt-4 text-xs text-muted-foreground">Top {skills.length} skills only, as recorded in processing metadata. {demand.data.scope_note} Bars scaled to the top skill; labels show the true share.</p>}
          {ov.data && <p className="mt-2 text-xs text-muted-foreground">Trend: {ov.data.trend_status}. {ov.data.trend_reason}</p>}
        </section>

        <section className="rounded-2xl border bg-card p-5 md:p-6 lg:sticky lg:top-6">
          <h2 className="font-serif text-2xl">Skill to course</h2>
          {activeSkill ? (
            <>
              <p className="text-sm text-muted-foreground mb-4">Catalog records matching <span className="font-semibold text-foreground">{activeSkill}</span>.</p>
              <CourseList skill={activeSkill} limit={5} />
              <Link href={`/courses?skill=${encodeURIComponent(activeSkill)}`} data-testid="link-all-courses" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                All matching records <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <div className="mt-6 rounded-xl songket p-8 text-center">
              <p className="font-serif text-lg bg-card/90 inline-block px-3 py-1 rounded">Select a skill from the ranking</p>
              <p className="text-sm text-muted-foreground mt-2 bg-card/90 rounded px-2">Real course records with exact keyword or tag evidence will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
