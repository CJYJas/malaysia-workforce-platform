import { z } from "zod";

export const HealthCheckResponse = z.object({
  status: z.string(),
});

export const GetWorkforceOverviewResponse = z.any();
export const GetSkillDemandQueryParams = z.any();
export const GetSkillDemandResponse = z.any();
export const GetSkillCoursesQueryParams = z.any();
export const GetSkillCoursesResponse = z.any();
export const GetCourseCatalogQueryParams = z.any();
export const GetCourseCatalogResponse = z.any();
export const GetCourseDetailResponse = z.any();

export const MatchJourneyBody = z.any();
export const MatchJourneyResponse = z.any();
export const CreateJourneyPathwayBody = z.any();
export const CreateJourneyPathwayResponse = z.any();
export const GetJourneyCatalogResponse = z.any();
export const GetJourneySignalsResponse = z.any();
