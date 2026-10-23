import { Link } from "wouter";
import { ArrowRight, ExternalLink, SearchX } from "lucide-react";
import { useGetCourseCatalog } from "@workspace/api-client-react";
import { ErrorPanel } from "@/components/shell";
import type { CourseRecord } from "@/pages/courses";

type CourseResponse = { items: CourseRecord[]; total: number; indexed_total: number; source_total: number; scope_note: string };

export function CourseList({ skill, limit }: { skill: string; limit?: number }) {
  const query = useGetCourseCatalog({ skill, page: 1, page_size: limit || 20 });
  if (!skill) return null;
  if (query.isLoading) return <div className="course-loading" role="status" aria-label="Loading skill-matched course records"><div className="course-skeleton" /><div className="course-skeleton" /></div>;
  if (query.isError || !query.data) return <ErrorPanel message="Course records could not be loaded." onRetry={() => void query.refetch()} />;
  const data = query.data as CourseResponse;
  const list = limit ? data.items.slice(0, limit) : data.items;
  return <div className="course-list-shared" data-testid="list-courses">
    <div className="course-results-head"><p><strong data-testid="text-course-total">{data.total.toLocaleString()}</strong> indexed records matched <b>{skill}</b></p><span>{data.indexed_total.toLocaleString()} indexed · {data.source_total.toLocaleString()} source</span></div>
    {!list.length ? <div className="course-empty" data-testid="state-no-courses"><SearchX size={22} /><h2>No indexed course record names this skill</h2><p>This is a bounded catalogue match, not a measure of the skill’s value or demand.</p></div>
      : <ul className="course-results">{list.map((course) => <li className="course-result" key={course.id} data-testid={`card-course-${course.id}`}>
        <div className="course-result-body"><h2><Link href={`/courses?skill=${encodeURIComponent(skill)}&course=${encodeURIComponent(String(course.id))}`}>{course.title}</Link></h2>
          <p className="course-result-provider">{course.provider || "Provider not recorded"} · {course.level || "Level not recorded"}</p>
          <div className="course-tags">{(course.indexed_skills?.length ? course.indexed_skills : course.skills || []).slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>
        <div className="course-result-meta"><Link className="course-view-link" href={`/courses?skill=${encodeURIComponent(skill)}&course=${encodeURIComponent(String(course.id))}`}>View record <ArrowRight size={15} /></Link>
          {course.url && <a className="course-view-link" href={course.url} target="_blank" rel="noreferrer noopener">Original page <ExternalLink size={14} /></a>}</div>
      </li>)}</ul>}
    <p className="course-footnote">{data.scope_note} Only supplied metadata is displayed; course counts do not indicate labour-market demand.</p>
  </div>;
}
