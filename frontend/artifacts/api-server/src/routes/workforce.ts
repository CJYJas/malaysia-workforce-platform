import { Router, type IRouter } from "express";
import {
  GetWorkforceOverviewResponse,
  GetSkillDemandQueryParams,
  GetSkillDemandResponse,
  GetSkillCoursesQueryParams,
  GetSkillCoursesResponse,
  GetCourseCatalogQueryParams, GetCourseCatalogResponse, GetCourseDetailResponse,
} from "@workspace/api-zod";
import snapshot from "../data/workforce-snapshot.json";
import { buildCourseIndex, courseFacets, filterCourseIndex, COURSE_INDEX_SCOPE } from "../lib/course-catalog";

const router: IRouter = Router();
const courseIndex = buildCourseIndex(snapshot.courses);
const facets = courseFacets(courseIndex);

router.get("/workforce/course-catalog", (req, res) => {
  const parsed = GetCourseCatalogQueryParams.safeParse(req.query);
  if (Object.values(req.query).some(value => typeof value !== "string") || !parsed.success) {
    res.status(400).json({ error: "Use text filters, page >= 1 and page_size between 1 and 50." }); return;
  }
  const input = parsed.data;
  for (const [key, values] of [["provider", facets.providers], ["level", facets.levels]] as const) {
    const value = input[key]?.trim();
    if (value && !values.some(item => item.toLowerCase() === value.toLowerCase())) {
      res.status(400).json({ error: `Unsupported ${key} filter. Choose a recorded facet.` }); return;
    }
  }
  const filtered = filterCourseIndex(courseIndex, input);
  const page = input.page ?? 1; const pageSize = input.page_size ?? 20;
  res.json(GetCourseCatalogResponse.parse({
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length, indexed_total: courseIndex.length, source_total: snapshot.overview.course_count,
    page, page_size: pageSize, ...facets, scope_note: COURSE_INDEX_SCOPE,
  }));
});
router.get("/workforce/course-catalog/:courseId", (req, res) => {
  const course = courseIndex.find(item => item.id === req.params.courseId);
  if (!course) { res.status(404).json({ error: "No course with this ID is present in the retained index." }); return; }
  res.json(GetCourseDetailResponse.parse(course));
});

router.get("/workforce/overview", (_req, res) => {
  res.json(GetWorkforceOverviewResponse.parse(snapshot.overview));
});

router.get("/workforce/demand", (req, res) => {
  if (typeof req.query.role !== "string" || !req.query.role.trim()) {
    res.status(400).json({ error: "A non-empty role query parameter is required." });
    return;
  }
  const parsed = GetSkillDemandQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "A role query parameter is required." });
    return;
  }
  const demands: Record<string, unknown> = snapshot.demands;
  const role = parsed.data.role.trim();
  if (!Object.hasOwn(demands, role)) {
    res.status(400).json({ error: "Unknown role. Select a supported role from the overview." });
    return;
  }
  res.json(GetSkillDemandResponse.parse(demands[role]));
});

router.get("/workforce/courses", (req, res) => {
  if (typeof req.query.skill !== "string" || !req.query.skill.trim()) {
    res.status(400).json({ error: "A non-empty skill query parameter is required." });
    return;
  }
  const parsed = GetSkillCoursesQueryParams.safeParse(req.query);
  if (!parsed.success || !parsed.data.skill.trim()) {
    res.status(400).json({ error: "A non-empty skill query parameter is required." });
    return;
  }
  const skill = parsed.data.skill.trim();
  const courses: Record<string, unknown> = snapshot.courses;
  const name = Object.keys(courses).find((key) => key.toLowerCase() === skill.toLowerCase());
  res.json(GetSkillCoursesResponse.parse(name ? courses[name] : {
    skill,
    courses: [],
    total_matches: 0,
    method: "Only skills present in the role snapshot have indexed course matches.",
    disclaimer: "No indexed course records for this skill. This does not establish catalog-wide absence.",
  }));
});

export default router;
