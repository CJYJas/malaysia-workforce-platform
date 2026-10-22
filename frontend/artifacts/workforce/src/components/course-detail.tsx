import { ExternalLink, FileText, Tag } from "lucide-react";
import { useGetCourseDetail } from "@workspace/api-client-react";
import type { CourseRecord } from "@/pages/courses";

type DetailRecord = CourseRecord & { description?: string | null; prerequisites?: string[] | null; price?: number | string | null };

export function CourseDetail({ courseId, contextSkill }: { courseId: string; contextSkill?: string }) {
  const query = useGetCourseDetail(courseId);
  const course = query.data as DetailRecord | undefined;
  if (query.isLoading) return <section className="course-detail-loading" role="status" aria-label="Loading course record"><div /><div /><div /><div /></section>;
  if (query.isError || !course) return <section className="course-error course-detail-error" role="alert" data-testid="state-course-detail-error">
    <strong>This course record is unavailable.</strong><p>The record may have been removed from the current index. No substitute record has been selected.</p>
    <button className="course-primary" onClick={() => void query.refetch()} data-testid="button-course-detail-retry">Retry</button>
  </section>;
  const indexedTags = course.indexed_skills || [];
  const catalogSkills = course.skills || [];
  const tags = Array.from(new Set([...catalogSkills, ...indexedTags]));
  const normalise = (value: string) => value.trim().toLocaleLowerCase();
  const contextMatched = !!contextSkill && tags.some((tag) => normalise(tag) === normalise(contextSkill));
  const matchSource = contextMatched && indexedTags.some((tag) => normalise(tag) === normalise(contextSkill))
    ? "indexed retrieval tag"
    : "course record skill tag";
  return <article className="course-detail" data-testid={`detail-course-${course.id}`}>
    <p className="course-eyebrow">Indexed course record · source #{course.source_record ?? "not recorded"}</p>
    <h1 data-testid="text-course-detail-title">{course.title}</h1>
    <p className="course-detail-provider">{course.provider || "Provider not recorded"} <span>·</span> {course.level || "Level not recorded"}</p>
    <div className="course-detail-stats">
      <div><span>Recorded duration</span><strong>{course.duration_hours != null ? `${course.duration_hours} hours` : "Not recorded"}</strong></div>
      <div><span>Historical rating</span><strong>{course.rating != null ? course.rating : "Not recorded"}</strong></div>
      {course.url ? <a href={course.url} target="_blank" rel="noreferrer noopener" data-testid="link-course-provider"><span>Provider record</span><strong>Open original page <ExternalLink size={15} /></strong></a> : <div><span>Provider URL</span><strong>Not recorded</strong></div>}
    </div>
    {course.match_reason && <section className="course-detail-section"><h2><FileText size={17} /> Index match note</h2><p>{course.match_reason}</p></section>}
    {contextSkill && <section className={`course-relevance ${contextMatched ? "is-recorded" : "is-unverified"}`} data-testid="text-course-skill-context">
      <strong>{contextMatched ? `Recorded connection to “${contextSkill}”` : `No recorded match for “${contextSkill}”`}</strong>
      <p>{contextMatched
        ? `This connection comes from a ${matchSource} on this catalogue record. It does not verify course coverage depth or completion; assess the course content and your own skill gap independently.`
        : "This course record does not list that skill in its recorded tags, so there is no verified catalogue match for this selected skill. It may still be relevant; assess its content yourself. Completion is not verified."}</p>
    </section>}
    <section className="course-detail-section"><h2><Tag size={17} /> Indexed skills</h2>
      {tags.length ? <div className="course-tags course-detail-tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : <p>Skill tags are not recorded for this course.</p>}
    </section>
    <section className="course-missing"><h2>Fields not supplied</h2><p>Description, prerequisites, price and course availability are not recorded in this index.</p></section>
    <p className="course-detail-source">Source record: {course.source_record ?? "not recorded"}. Catalog details are not an endorsement, personal assessment or guarantee of course quality or outcome.</p>
  </article>;
}
