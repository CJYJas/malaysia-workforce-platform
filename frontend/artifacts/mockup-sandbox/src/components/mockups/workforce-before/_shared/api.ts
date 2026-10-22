import snapshot from "./snapshot.json";

export type WorkforceRole = (typeof snapshot.overview.roles)[number];
const state = <T,>(data: T) => ({
  data, isLoading: false, isError: false, refetch: async () => ({ data }),
});
export function useGetWorkforceOverview() {
  return state(snapshot.overview);
}
export function getGetSkillDemandQueryKey(params: { role: string }) {
  return ["extracted-demand", params.role];
}
export function useGetSkillDemand(params: { role: string }, _options?: unknown) {
  const demands: Record<string, (typeof snapshot.demands)[keyof typeof snapshot.demands]> = snapshot.demands;
  return state(demands[params.role] ?? snapshot.demands["Software Engineer / Developer"]);
}
export function getGetSkillCoursesQueryKey(params: { skill: string }) {
  return ["extracted-courses", params.skill];
}
export function useGetSkillCourses(params: { skill: string }, _options?: unknown) {
  const courses: Record<string, (typeof snapshot.courses)[keyof typeof snapshot.courses]> = snapshot.courses;
  return state(courses[params.skill] ?? {
    skill: params.skill, total_matches: 0, courses: [],
    method: "Extracted repository records", disclaimer: "No indexed course records.",
  });
}
