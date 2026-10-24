import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";

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

// ============================================================================
// PYTHON BACKEND TYPES
// ============================================================================

export interface PyHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp_utc: string;
  data_loaded: boolean;
  total_postings: number | null;
  target_roles_postings: number | null;
  retriever_active: string;
  embeddings_loaded: boolean;
  llm_enabled: boolean;
  llm_reachable: boolean | null;
  device: string;
  platform: string;
}

export interface PyRoleSummary {
  role: string;
  description: string;
  evidence_status: string;
  posting_count: number;
  sample_size_warning: boolean;
  priority_tier: number;
}

export interface PyRolesResponse {
  total_roles: number;
  roles: PyRoleSummary[];
}

export interface PyResumeUploadResponse {
  status: string;
  filename: string;
  page_count: number;
  text_length: number;
  extracted_skills: string[];
  skill_evidence: Record<string, string>;
  skill_count: number;
  experience_years: number;
  detected_education: string | null;
  warning?: string | null;
}

export interface PyProfileParseResponse {
  status: string;
  skills?: string[];
  extracted_skills?: string[];
  skill_evidence?: Record<string, string | string[]>;
  skill_count?: number;
  experience_years?: number | null;
  education?: string | null;
  detected_education?: string | null;
  method: string;
  fallback_reason?: string | null;
  warning?: string | null;
  latency_ms?: number;
  privacy_note?: string;
}

export interface PyRankedRoleMatch {
  rank: number;
  role: string;
  match_score: number;
  coverage_score: number;
  similarity_score: number;
  matched_skills: string[];
  matched_skills_count: number;
  core_gaps: string[];
  core_gaps_count: number;
  recommended_gaps: string[];
  recommended_gaps_count: number;
  evidence_sample_size: number;
  sample_size_warning: boolean;
  warning_message: string | null;
  top_demanded_skills: Array<{ skill: string; share: number }>;
}

export interface PyRolesMatchResponse {
  status: string;
  candidate_profile: {
    skills: string[];
    experience_years: number;
    skill_count: number;
    resume_filename?: string;
    page_count?: number;
    skill_evidence?: Record<string, string>;
    detected_education?: string | null;
  };
  disclaimer: string;
  total_roles_evaluated: number;
  ranked_matches: PyRankedRoleMatch[];
  insufficient_evidence_roles: Array<{ role: string; posting_count: number; reason: string }>;
  method: string;
  narration?: string | null;
  narration_method?: string | null;
  narration_fallback_reason?: string | null;
}

export interface PySkillsGapResponse {
  status: string;
  target_role: string;
  evidence_sample_size: number;
  sample_size_warning: boolean;
  warning_message: string | null;
  candidate_skills: string[];
  matched_skills: string[];
  matched_skills_count: number;
  core_gaps: string[];
  core_gaps_count: number;
  recommended_gaps: string[];
  recommended_gaps_count: number;
  optional_gaps: string[];
  optional_gaps_count: number;
  total_gaps_count: number;
  coverage_percentage: number;
  method: string;
  filename?: string;
  page_count?: number;
  skill_evidence?: Record<string, string>;
}

export interface PyRoadmapCourse {
  course_id: string;
  title: string;
  url: string;
  target_skills: string[];
  level: string;
  duration_weeks: number;
  organization: string;
}

export interface PyRoadmapResponse {
  status: string;
  target_role: string;
  evidence_sample_size: number;
  total_gaps_identified: number;
  ordered_pathway: PyRoadmapCourse[];
  unresolved_skill_gaps: string[];
  pathway_ordering_label: string;
  ordering_disclaimer: string;
  sdg_alignments: Array<{
    sdg_id: number;
    sdg_name: string;
    description: string;
    source: string;
  }>;
  sdg_disclaimer: string;
  method: string;
  narration?: string | null;
  narration_method?: string | null;
  narration_fallback_reason?: string | null;
}

// ============================================================================
// LIVE RUNPOD BACKEND CONFIGURATION & RESOLVER
// ============================================================================

export const RUNPOD_BACKEND_URL = "https://xvu8eu1rakfbfc-8000.proxy.runpod.net";

export function getBackendBaseUrl(): string {
  if (typeof import.meta !== "undefined" && (import.meta as any).env) {
    const env = (import.meta as any).env;
    if (env.VITE_API_URL) return String(env.VITE_API_URL).replace(/\/+$/, "");
    if (env.VITE_BACKEND_API_URL) return String(env.VITE_BACKEND_API_URL).replace(/\/+$/, "");
    if (env.BACKEND_API_URL) return String(env.BACKEND_API_URL).replace(/\/+$/, "");
  }
  return RUNPOD_BACKEND_URL;
}

/**
 * Resolves a Python backend endpoint path.
 * Directs API calls to the live RunPod deployment (https://xvu8eu1rakfbfc-8000.proxy.runpod.net).
 * Strips duplicate /api/py prefix when appending to base URL.
 */
export function resolvePyUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getBackendBaseUrl();
  if (baseUrl) {
    const endpoint = cleanPath.startsWith("/api/py") ? cleanPath.replace(/^\/api\/py/, "") : cleanPath;
    return `${baseUrl}${endpoint}`;
  }
  return cleanPath.startsWith("/api/py") ? cleanPath : `/api/py${cleanPath}`;
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const targetUrl = url.startsWith("/api/py") ? resolvePyUrl(url) : url;
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type") && init?.method && init.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(targetUrl, { ...init, headers });
  if (!res.ok) {
    let msg = `Request failed: ${res.status} ${res.statusText}`;
    try {
      const err = await res.json();
      if (err?.detail) msg = typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail);
      else if (err?.error) msg = typeof err.error === "string" ? err.error : JSON.stringify(err.error);
      else if (err?.message) msg = typeof err.message === "string" ? err.message : JSON.stringify(err.message);
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

// ============================================================================
// WORKFORCE & JOURNEY CLIENT HOOKS (SNAPSHOT ADAPTER)
// ============================================================================

export function getGetCourseCatalogQueryKey(params?: Record<string, any>) {
  return ["/api/workforce/course-catalog", params];
}

export function getGetSkillDemandQueryKey(params?: { role: string }) {
  return ["/api/workforce/demand", params];
}

export function getGetSkillCoursesQueryKey(params?: { skill: string }) {
  return ["/api/workforce/courses", params];
}

export function getGetJourneySignalsQueryKey(params?: { refresh?: string | boolean }) {
  return ["/api/journey/signals", params];
}

export function getGetJourneyCatalogQueryKey() {
  return ["/api/journey/catalog"];
}

export async function getJourneySignals(params?: { refresh?: string | boolean }): Promise<SignalReport> {
  const refresh = params?.refresh ? String(params.refresh) : undefined;
  const url = `/api/journey/signals${refresh ? `?refresh=${encodeURIComponent(refresh)}` : ""}`;
  return fetchJson<SignalReport>(url);
}

export function useGetWorkforceOverview(options?: { query?: Partial<UseQueryOptions<any, Error>> }) {
  return useQuery({
    queryKey: ["/api/workforce/overview"],
    queryFn: () => fetchJson("/api/workforce/overview"),
    ...options?.query,
  });
}

export function useGetSkillDemand(
  params: { role: string },
  options?: { query?: Partial<UseQueryOptions<any, Error>> }
) {
  const queryKey = options?.query?.queryKey || getGetSkillDemandQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: () => {
      const q = new URLSearchParams({ role: params.role }).toString();
      return fetchJson(`/api/workforce/demand?${q}`);
    },
    enabled: !!params?.role,
    ...options?.query,
  });
}

export function useGetSkillCourses(
  params: { skill: string },
  options?: { query?: Partial<UseQueryOptions<any, Error>> }
) {
  const queryKey = options?.query?.queryKey || getGetSkillCoursesQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: () => {
      const q = new URLSearchParams({ skill: params.skill }).toString();
      return fetchJson(`/api/workforce/courses?${q}`);
    },
    enabled: !!params?.skill,
    ...options?.query,
  });
}

export function useGetCourseCatalog(
  params?: Record<string, any>,
  options?: { query?: Partial<UseQueryOptions<any, Error>> }
) {
  const queryKey = options?.query?.queryKey || getGetCourseCatalogQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") {
            sp.set(k, String(v));
          }
        });
      }
      const q = sp.toString();
      return fetchJson(`/api/workforce/course-catalog${q ? `?${q}` : ""}`);
    },
    ...options?.query,
  });
}

export function useGetCourseDetail(
  courseId: string | number,
  options?: { query?: Partial<UseQueryOptions<any, Error>> }
) {
  return useQuery({
    queryKey: ["/api/workforce/course-catalog", String(courseId)],
    queryFn: () => fetchJson(`/api/workforce/course-catalog/${encodeURIComponent(String(courseId))}`),
    enabled: !!courseId,
    ...options?.query,
  });
}

export function useGetJourneyCatalog(options?: { query?: Partial<UseQueryOptions<JourneyCatalog, Error>> }) {
  return useQuery({
    queryKey: getGetJourneyCatalogQueryKey(),
    queryFn: () => fetchJson<JourneyCatalog>("/api/journey/catalog"),
    ...options?.query,
  });
}

export function useGetJourneySignals(
  params?: { refresh?: string | boolean },
  options?: { query?: Partial<UseQueryOptions<SignalReport, Error>> }
) {
  const queryKey = options?.query?.queryKey || getGetJourneySignalsQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: () => getJourneySignals(params),
    ...options?.query,
  });
}

export function useMatchJourney(options?: {
  mutation?: Partial<UseMutationOptions<any, Error, { data: { profile: any; scenario: any } }>>;
}) {
  return useMutation({
    mutationFn: async ({ data }: { data: { profile: any; scenario: any } }) => {
      return fetchJson("/api/journey/matches", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    ...options?.mutation,
  });
}

export function useCreateJourneyPathway(options?: {
  mutation?: Partial<UseMutationOptions<any, Error, { data: { profile: any; scenario: any; role_id: any } }>>;
}) {
  return useMutation({
    mutationFn: async ({ data }: { data: { profile: any; scenario: any; role_id: any } }) => {
      return fetchJson("/api/journey/pathway", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    ...options?.mutation,
  });
}

// ============================================================================
// PYTHON FASTAPI BACKEND CLIENT HOOKS (/api/py/*)
// ============================================================================

/**
 * Service Health & Status check from Python Backend
 */
export function usePyHealth(options?: { query?: Partial<UseQueryOptions<PyHealthResponse, Error>> }) {
  return useQuery({
    queryKey: ["/api/py/health"],
    queryFn: () => fetchJson<PyHealthResponse>("/api/py/health"),
    ...options?.query,
  });
}

/**
 * Platform Processing Metadata & Governance
 */
export function usePyMetadata(options?: { query?: Partial<UseQueryOptions<any, Error>> }) {
  return useQuery({
    queryKey: ["/api/py/metadata"],
    queryFn: () => fetchJson("/api/py/metadata"),
    ...options?.query,
  });
}

/**
 * List all supported Malaysian Tech Roles from Python Backend
 */
export function usePyRoles(options?: { query?: Partial<UseQueryOptions<PyRolesResponse, Error>> }) {
  return useQuery({
    queryKey: ["/api/py/roles"],
    queryFn: () => fetchJson<PyRolesResponse>("/api/py/roles"),
    ...options?.query,
  });
}

/**
 * Get Skill Demand for a target role from Python Backend
 */
export function usePySkillDemand(
  params: { role: string; top_n?: number; window?: string; compare_with?: string },
  options?: { query?: Partial<UseQueryOptions<any, Error>> }
) {
  return useQuery({
    queryKey: ["/api/py/skills/demand", params],
    queryFn: () => {
      const sp = new URLSearchParams({ role: params.role });
      if (params.top_n) sp.set("top_n", String(params.top_n));
      if (params.window) sp.set("window", params.window);
      if (params.compare_with) sp.set("compare_with", params.compare_with);
      return fetchJson(`/api/py/skills/demand?${sp.toString()}`);
    },
    enabled: !!params?.role,
    ...options?.query,
  });
}

/**
 * Get Monthly Historical Skill Trends from Python Backend
 */
export function usePySkillTrends(
  params: { role: string; skill?: string; window?: string },
  options?: { query?: Partial<UseQueryOptions<any, Error>> }
) {
  return useQuery({
    queryKey: ["/api/py/skills/trends", params],
    queryFn: () => {
      const sp = new URLSearchParams({ role: params.role });
      if (params.skill) sp.set("skill", params.skill);
      if (params.window) sp.set("window", params.window);
      return fetchJson(`/api/py/skills/trends?${sp.toString()}`);
    },
    enabled: !!params?.role,
    ...options?.query,
  });
}

/**
 * Compare two roles side-by-side from Python Backend
 */
export function usePyRoleCompare(
  params: { role1: string; role2: string; top_n?: number },
  options?: { query?: Partial<UseQueryOptions<any, Error>> }
) {
  return useQuery({
    queryKey: ["/api/py/skills/compare", params],
    queryFn: () => {
      const sp = new URLSearchParams({ role1: params.role1, role2: params.role2 });
      if (params.top_n) sp.set("top_n", String(params.top_n));
      return fetchJson(`/api/py/skills/compare?${sp.toString()}`);
    },
    enabled: !!params?.role1 && !!params?.role2,
    ...options?.query,
  });
}

/**
 * Parse & Extract Skills from Uploaded PDF Resume
 */
export function useUploadResumePdf(options?: {
  mutation?: Partial<UseMutationOptions<PyResumeUploadResponse, Error, File>>;
}) {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return fetchJson<PyResumeUploadResponse>("/api/py/profile/upload-resume", {
        method: "POST",
        body: formData,
      });
    },
    ...options?.mutation,
  });
}

/**
 * Parse Candidate Profile / Bio / LinkedIn / Resume text with LLM and Verification Gate
 */
export function useParseResumeText(options?: {
  mutation?: Partial<UseMutationOptions<PyProfileParseResponse, Error, { raw_text: string }>>;
}) {
  return useMutation({
    mutationFn: async ({ raw_text }: { raw_text: string }) => {
      return fetchJson<PyProfileParseResponse>("/api/py/profile/parse", {
        method: "POST",
        body: JSON.stringify({ raw_text }),
      });
    },
    ...options?.mutation,
  });
}

/**
 * Direct PDF Resume Role Matching
 */
export function useMatchResumePdf(options?: {
  mutation?: Partial<UseMutationOptions<PyRolesMatchResponse, Error, { file: File; top_k?: number; experience_years_override?: number }>>;
}) {
  return useMutation({
    mutationFn: async ({ file, top_k = 5, experience_years_override }: { file: File; top_k?: number; experience_years_override?: number }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("top_k", String(top_k));
      if (experience_years_override !== undefined && experience_years_override !== null) {
        formData.append("experience_years_override", String(experience_years_override));
      }
      return fetchJson<PyRolesMatchResponse>("/api/py/roles/match-resume", {
        method: "POST",
        body: formData,
      });
    },
    ...options?.mutation,
  });
}

/**
 * Direct PDF Resume Skill Gap Analysis
 */
export function useSkillGapResumePdf(options?: {
  mutation?: Partial<UseMutationOptions<PySkillsGapResponse, Error, { file: File; target_role: string }>>;
}) {
  return useMutation({
    mutationFn: async ({ file, target_role }: { file: File; target_role: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target_role", target_role);
      return fetchJson<PySkillsGapResponse>("/api/py/skills/gap-resume", {
        method: "POST",
        body: formData,
      });
    },
    ...options?.mutation,
  });
}

/**
 * Direct PDF Resume Roadmap Generation
 */
export function useGenerateRoadmapResumePdf(options?: {
  mutation?: Partial<UseMutationOptions<PyRoadmapResponse, Error, { file: File; target_role: string; max_courses?: number }>>;
}) {
  return useMutation({
    mutationFn: async ({ file, target_role, max_courses = 8 }: { file: File; target_role: string; max_courses?: number }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("target_role", target_role);
      formData.append("max_courses", String(max_courses));
      return fetchJson<PyRoadmapResponse>("/api/py/roadmap/generate-from-resume", {
        method: "POST",
        body: formData,
      });
    },
    ...options?.mutation,
  });
}

/**
 * Deterministic Role Matching with Candidate Profile Skills
 */
export function usePyMatchRoles(options?: {
  mutation?: Partial<UseMutationOptions<PyRolesMatchResponse, Error, { skills: string[]; experience_years?: number; top_k?: number; explain?: string }>>;
}) {
  return useMutation({
    mutationFn: async (data: { skills: string[]; experience_years?: number; top_k?: number; explain?: string }) => {
      return fetchJson<PyRolesMatchResponse>("/api/py/roles/match", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    ...options?.mutation,
  });
}

/**
 * Deterministic Skill Gap Analysis for Target Role
 */
export function usePySkillGap(options?: {
  mutation?: Partial<UseMutationOptions<PySkillsGapResponse, Error, { target_role: string; current_skills: string[] }>>;
}) {
  return useMutation({
    mutationFn: async (data: { target_role: string; current_skills: string[] }) => {
      return fetchJson<PySkillsGapResponse>("/api/py/skills/gap", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    ...options?.mutation,
  });
}

/**
 * Generate Learning Roadmap with Verified Coursera Courses and SDG Alignments
 */
export function usePyGenerateRoadmap(options?: {
  mutation?: Partial<UseMutationOptions<PyRoadmapResponse, Error, { target_role: string; current_skills: string[]; max_courses?: number; explain?: string }>>;
}) {
  return useMutation({
    mutationFn: async (data: { target_role: string; current_skills: string[]; max_courses?: number; explain?: string }) => {
      return fetchJson<PyRoadmapResponse>("/api/py/roadmap/generate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    ...options?.mutation,
  });
}
