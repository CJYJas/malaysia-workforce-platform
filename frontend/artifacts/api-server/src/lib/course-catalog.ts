export const COURSE_INDEX_SCOPE = "Indexed from Malaysian tech workforce courses snapshot";

export interface CourseItem {
  id: string;
  title: string;
  url?: string;
  provider?: string;
  level?: string;
  rating?: number;
  duration?: string;
  indexed_skills: string[];
  [key: string]: any;
}

export function buildCourseIndex(courses: Record<string, { courses: any[] }>): CourseItem[] {
  const map = new Map<string, CourseItem>();

  for (const [skill, group] of Object.entries(courses)) {
    if (!group?.courses) continue;
    for (const course of group.courses) {
      if (!course || !course.id) continue;
      const existing = map.get(course.id);
      if (existing) {
        if (!existing.indexed_skills.includes(skill)) {
          existing.indexed_skills.push(skill);
        }
      } else {
        map.set(course.id, {
          ...course,
          indexed_skills: [skill],
        });
      }
    }
  }

  return Array.from(map.values());
}

export function courseFacets(index: CourseItem[]) {
  const providersSet = new Set<string>();
  const levelsSet = new Set<string>();
  const skillsSet = new Set<string>();

  for (const item of index) {
    if (item.provider) providersSet.add(item.provider);
    if (item.level) levelsSet.add(item.level);
    for (const s of item.indexed_skills) {
      skillsSet.add(s);
    }
  }

  return {
    providers: Array.from(providersSet).sort(),
    levels: Array.from(levelsSet).sort(),
    skills: Array.from(skillsSet).sort(),
  };
}

export interface CourseFilterParams {
  q?: string;
  provider?: string;
  level?: string;
  skill?: string;
  page?: number;
  page_size?: number;
}

export function filterCourseIndex(index: CourseItem[], params: CourseFilterParams): CourseItem[] {
  const q = params.q?.trim().toLowerCase();
  const provider = params.provider?.trim().toLowerCase();
  const level = params.level?.trim().toLowerCase();
  const skill = params.skill?.trim().toLowerCase();

  return index.filter((item) => {
    if (q) {
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchSkill = item.indexed_skills.some((s) => s.toLowerCase().includes(q));
      if (!matchTitle && !matchSkill) return false;
    }
    if (provider && item.provider?.toLowerCase() !== provider) {
      return false;
    }
    if (level && item.level?.toLowerCase() !== level) {
      return false;
    }
    if (skill && !item.indexed_skills.some((s) => s.toLowerCase() === skill)) {
      return false;
    }
    return true;
  });
}
