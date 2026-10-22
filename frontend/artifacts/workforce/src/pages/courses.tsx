import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft, ArrowRight, BookOpen, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useGetCourseCatalog } from "@workspace/api-client-react";
import { PageHeader } from "@/components/shell";
import { CourseDetail } from "@/components/course-detail";
import "../courses.css";

type CatalogResponse = {
  items: CourseRecord[]; total: number; indexed_total: number; source_total: number;
  page: number; page_size: number; skills: string[]; providers: string[]; levels: string[]; scope_note: string;
};
export type CourseRecord = {
  id: string | number; title: string; provider?: string | null; url?: string | null;
  level?: string | null; rating?: number | null; duration_hours?: number | null;
  skills: string[]; indexed_skills: string[]; match_reason?: string | null; source_record?: number | string | null;
};

function makeUrl(params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  Object.entries(patch).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
  const query = next.toString();
  return `/courses${query ? `?${query}` : ""}`;
}

export default function Courses() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const q = params.get("q") || "";
  const skill = params.get("skill") || "";
  const provider = params.get("provider") || "";
  const level = params.get("level") || "";
  const page = Math.max(1, Number(params.get("page") || "1") || 1);
  const courseId = params.get("course") || "";
  const fromPathway = params.get("from") === "pathway";
  const [draft, setDraft] = useState(q);
  useEffect(() => setDraft(q), [q]);

  const catalogQuery = useGetCourseCatalog({
    ...(q ? { q } : {}), ...(skill ? { skill } : {}), ...(provider ? { provider } : {}),
    ...(level ? { level } : {}), page, page_size: 20,
  });
  const data = catalogQuery.data as CatalogResponse | undefined;
  const update = (patch: Record<string, string | null>, resetPage = true) => {
    navigate(makeUrl(params, { ...patch, ...(resetPage ? { page: null } : {}) }));
  };
  const clearAll = () => {
    setDraft("");
    navigate(params.get("from") === "pathway" ? "/courses?from=pathway" : "/courses");
  };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / Math.max(data.page_size, 1))) : 1;

  if (courseId) {
    return <main className="course-page course-shell">
      <div className="course-toplinks">
        {fromPathway && <Link href="/pathway" className="course-back" data-testid="link-course-back-pathway"><ArrowLeft size={16} /> Back to pathway</Link>}
        <Link href={makeUrl(params, { course: null })} className="course-back" data-testid="link-course-back-catalogue"><ArrowLeft size={16} /> Back to catalogue</Link>
      </div>
      <CourseDetail courseId={courseId} contextSkill={skill} />
    </main>;
  }

  return <main className="course-page course-shell">
    <PageHeader kicker="Learning index · public catalogue" title="Find a course by what it teaches.">
      Search course titles and indexed skill evidence. This is a bounded index—not the full source catalogue, a recommendation, or a measure of job demand.
    </PageHeader>
    <section className="course-scope" aria-label="Catalogue scope" data-testid="text-course-scope">
      <span className="course-scope-mark"><BookOpen size={19} /></span>
      <div><strong>{data ? `${data.indexed_total.toLocaleString()} indexed records` : "Catalogue scope"}</strong>
        <p>{data?.scope_note || "Index and source-catalogue counts are supplied by the public catalogue response."}</p>
      </div>
      <span className="course-scope-count">{data ? `${data.source_total.toLocaleString()} source records` : "Counts load with results"}</span>
    </section>

    <form className="course-search" onSubmit={(event) => { event.preventDefault(); update({ q: draft.trim() || null }); }}>
      <label className="course-searchbox"><Search size={19} /><span className="sr-only">Search course title or skill</span>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search titles or skills…" data-testid="input-course-search" />
      </label>
      <button type="submit" className="course-primary" data-testid="button-course-search">Search courses</button>
    </form>

    <div className="course-filters">
      <label><span>Indexed skill</span><select value={skill} onChange={(e) => update({ skill: e.target.value || null })} data-testid="select-course-skill">
        <option value="">All indexed skills</option>{(data?.skills || []).map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
      <label><span>Provider</span><select value={provider} onChange={(e) => update({ provider: e.target.value || null })} data-testid="select-course-provider">
        <option value="">All providers</option>{(data?.providers || []).map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
      <label><span>Level</span><select value={level} onChange={(e) => update({ level: e.target.value || null })} data-testid="select-course-level">
        <option value="">All levels</option>{(data?.levels || []).map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
      {(q || skill || provider || level) && <button className="course-clear" type="button" onClick={clearAll} data-testid="button-course-clear"><X size={15} /> Clear filters</button>}
    </div>

    {catalogQuery.isLoading ? <div className="course-loading" role="status" aria-label="Loading course records">{[1, 2, 3].map((i) => <div className="course-skeleton" key={i} />)}</div>
      : catalogQuery.isError || !data ? <section className="course-error" role="alert" data-testid="state-course-error"><strong>Course index couldn’t be loaded.</strong><p>Try the request again. If a filter is no longer available, clear it and choose from the current catalogue options.</p><div className="course-error-actions"><button type="button" className="course-primary" onClick={() => void catalogQuery.refetch()} data-testid="button-course-retry">Retry</button><button type="button" className="course-secondary" onClick={clearAll} data-testid="button-course-reset-error">Clear search and filters</button></div></section>
      : data.items.length === 0 ? <section className="course-empty" data-testid="state-course-empty">
        <span className="course-empty-icon"><Search size={21} /></span><h2>{q || skill || provider || level ? "No records match these filters." : "No records are indexed right now."}</h2>
        <p>{q || skill || provider || level ? "Try a broader title or skill phrase, or remove one of the filters. No similar courses are invented or suggested." : "The index returned no records for this request. This does not describe the full source catalogue."}</p>
        {(q || skill || provider || level) && <button className="course-secondary" onClick={clearAll} data-testid="button-course-empty-clear">Reset filters</button>}
      </section>
      : <>
        <div className="course-results-head"><p data-testid="text-course-results-count"><strong>{data.total.toLocaleString()}</strong> matching indexed records</p><span>Page {data.page} of {totalPages} · 20 per page</span></div>
        <ul className="course-results" data-testid="list-course-results">
          {data.items.map((course) => <li key={course.id} className="course-result" data-testid={`card-course-${course.id}`}>
            <div className="course-result-no">{String(course.source_record ?? "—").padStart(2, "0")}</div>
            <div className="course-result-body">
              <h2><Link href={makeUrl(params, { course: String(course.id), from: fromPathway ? "pathway" : null })} data-testid={`link-course-detail-${course.id}`}>{course.title}</Link></h2>
              <p className="course-result-provider">{course.provider || "Provider not recorded"}<span> · </span>{course.level || "Level not recorded"}</p>
              {(course.indexed_skills?.length || course.skills?.length) ? <div className="course-tags">{(course.indexed_skills?.length ? course.indexed_skills : course.skills || []).slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div> : <p className="course-result-reason">Skill metadata not recorded.</p>}
              <p className="course-result-reason">{course.match_reason || "Match explanation not recorded."}</p>
            </div>
            <div className="course-result-meta">
              {course.duration_hours != null && <span>{course.duration_hours} h listed</span>}
              {course.rating != null && <span>Rating {course.rating} · historical</span>}
              <Link href={makeUrl(params, { course: String(course.id), from: fromPathway ? "pathway" : null })} className="course-view-link" data-testid={`button-course-view-${course.id}`}>View record <ArrowRight size={15} /></Link>
            </div>
          </li>)}
        </ul>
        <nav className="course-pagination" aria-label="Course result pages">
          <button disabled={page <= 1} onClick={() => update({ page: String(page - 1) }, false)} data-testid="button-course-previous"><ChevronLeft size={17} /> Previous</button>
          <span>Page <strong>{data.page}</strong> / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) }, false)} data-testid="button-course-next">Next <ChevronRight size={17} /></button>
        </nav>
      </>}
    <p className="course-footnote">Record fields are shown only when supplied. Ratings and durations are historical metadata; availability, current price, suitability and outcomes are not established by this index.</p>
  </main>;
}
