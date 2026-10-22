import { useGetSkillCourses, getGetSkillCoursesQueryKey } from "./api";
import { ExternalLink, SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorPanel } from "./shell";
import { CoverArt } from "./art";
import { fmtNum } from "./format";

export function CourseList({ skill, limit }: { skill: string; limit?: number }) {
  const q = useGetSkillCourses({ skill }, { query: { enabled: !!skill, queryKey: getGetSkillCoursesQueryKey({ skill }) } });
  if (!skill) return null;
  if (q.isLoading) return <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (q.isError || !q.data) return <ErrorPanel message="Course records could not be loaded." onRetry={() => q.refetch()} />;
  const d = q.data;
  const list = limit ? d.courses.slice(0, limit) : d.courses;
  return (
    <div className="space-y-4" data-testid="list-courses">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm"><span className="tabular-nums font-semibold" data-testid="text-course-total">{fmtNum(d.total_matches)}</span> catalog records matched <span className="font-semibold">{d.skill}</span>
          {d.courses.length < d.total_matches && <span className="text-muted-foreground"> · {fmtNum(list.length)} shown</span>}</p>
        <p className="text-xs text-muted-foreground">Method: {d.method}</p>
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center" data-testid="state-no-courses">
          <SearchX className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 font-semibold tracking-tight text-lg">No catalog record names this skill</p>
          <p className="text-sm text-muted-foreground mt-1">The course catalog has no exact keyword or skill-tag match. This says nothing about how useful the skill is.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {list.map((c, i) => (
            <li key={c.id} className="rise group rounded-2xl bg-card soft-shadow p-3 transition hover:-translate-y-0.5" style={{ animationDelay: `${i * 30}ms` }} data-testid={`card-course-${c.id}`}>
              <CoverArt seed={c.id + c.title} className="h-16 w-full rounded-xl mb-3" />
              <div className="flex items-start justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">{c.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.provider ?? "Provider not recorded"}{c.level ? ` · ${c.level}` : ""}</p>
                </div>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" data-testid={`link-course-${c.id}`}
                    className="shrink-0 inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Open <ExternalLink className="h-3 w-3" />
                  </a>
                ) : <span className="text-xs text-muted-foreground shrink-0">No URL recorded</span>}
              </div>
              <div className="mt-3 px-1 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
                <span>rating {c.rating ?? "n/a"} (historical)</span>
                <span>{c.duration_hours != null ? `${c.duration_hours} h listed` : "duration n/a"}</span>
                <span>record #{c.source_record}</span>
              </div>
              <p className="mt-2 px-1 text-xs text-[#B4501F]">{c.match_reason}</p>
              {c.skills.length > 0 && (
                <div className="mt-2 px-1 flex flex-wrap gap-1">
                  {c.skills.slice(0, 8).map((s) => <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">{s}</span>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground border-l-2 border-accent-foreground/30 pl-3">{d.disclaimer} Ratings and hours are historical catalog records; no availability or current price is implied. Course counts are not a measure of job demand.</p>
    </div>
  );
}
