export type JourneyProfile = any;
export type LearningPathway = any;
export type RoleMatch = any;
export type SignalReport = any;
export type DemandSkill = any;
export type WorkforceRole = any;
export type OutlookSignal = any;
export type JourneyCatalog = any;
export type JourneyScenario = any;
export type SdgLink = any;

export const useGetJourneyCatalog: any = () => ({ data: undefined, isLoading: false });
export const useGetJourneySignals: any = () => ({ data: undefined, isLoading: false, refetch: async () => {} });
export const useGetSkillCourses: any = () => ({ data: undefined, isLoading: false });
export const useGetSkillDemand: any = () => ({ data: undefined, isLoading: false });
export const useGetWorkforceOverview: any = () => ({ data: undefined, isLoading: false });
export const useGetCourseCatalog: any = () => ({ data: undefined, isLoading: false });
export const useGetCourseDetail: any = () => ({ data: undefined, isLoading: false });
export const useMatchJourney: any = () => ({ mutateAsync: async () => ({}), mutate: () => {}, isPending: false });
export const useCreateJourneyPathway: any = () => ({ mutateAsync: async () => ({}), mutate: () => {}, isPending: false });

export const getGetCourseCatalogQueryKey = (...args: any[]) => ["course-catalog", ...args];
export const getGetSkillDemandQueryKey = (...args: any[]) => ["skill-demand", ...args];
export const getGetSkillCoursesQueryKey = (...args: any[]) => ["skill-courses", ...args];
export const getGetJourneySignalsQueryKey = (...args: any[]) => ["journey-signals", ...args];
export const getGetJourneyCatalogQueryKey = (...args: any[]) => ["journey-catalog", ...args];
export const getJourneySignals: any = async () => ({});
