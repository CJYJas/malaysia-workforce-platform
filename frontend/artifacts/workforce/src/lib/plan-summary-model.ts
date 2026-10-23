export const PLAN_SUMMARY_KEY = "my-next-chapter.plan-summary.v1";

export interface SkillStepSummary {
  id: string;
  skill: string;
}

export interface PlanSummary {
  version: 1;
  fingerprint: string;
  planId: string;
  roleId: string;
  scenario: string;
  totalHours: number;
  weeks: number;
  stepIds: string[];
  skillSteps: SkillStepSummary[];
  generatedAt: string;
}

export interface LearningProgress {
  completed: number;
  inProgress: number;
  total: number;
  nextSkill: string | null;
}

export type LearningStatus = "not_started" | "in_progress" | "completed";

export function summarisePlan(plan: any, fingerprint: string): PlanSummary {
  if (!plan) throw new Error("A plan response is required to summarize.");
  const stepIds: string[] = [];
  const skillSteps: SkillStepSummary[] = [];

  for (const s of plan.steps || []) {
    stepIds.push(s.id);
    if (s.kind === "skill") {
      skillSteps.push({ id: s.id, skill: s.skill });
    }
  }

  return {
    version: 1,
    fingerprint,
    planId: plan.plan_id,
    roleId: plan.role?.id || "",
    scenario: plan.scenario || "balanced",
    totalHours: plan.total_hours || 0,
    weeks: plan.weeks || 0,
    stepIds,
    skillSteps,
    generatedAt: new Date().toISOString(),
  };
}

export function parsePlanSummary(raw: string | null): PlanSummary | null {
  if (raw === null || raw === undefined) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed plan summary JSON.");
  }
  if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
    throw new Error("Invalid plan summary version.");
  }
  if (!parsed.fingerprint) {
    throw new Error("Missing fingerprint in plan summary.");
  }
  if (!Array.isArray(parsed.stepIds) || new Set(parsed.stepIds).size !== parsed.stepIds.length) {
    throw new Error("Duplicate or invalid stepIds in plan summary.");
  }
  if (!Array.isArray(parsed.skillSteps)) {
    throw new Error("skillSteps must be an array.");
  }
  for (const ss of parsed.skillSteps) {
    if (!parsed.stepIds.includes(ss.id)) {
      throw new Error(`skillStep ID "${ss.id}" not found in stepIds.`);
    }
  }
  if (typeof parsed.generatedAt !== "string" || Number.isNaN(Date.parse(parsed.generatedAt))) {
    throw new Error("Invalid generatedAt date.");
  }

  return parsed as PlanSummary;
}

export function summaryMatchesScope(
  summary: PlanSummary | null,
  fingerprint: string | null,
  roleId: string,
  scenario: string,
): boolean {
  if (!summary || !fingerprint) return false;
  return (
    summary.fingerprint === fingerprint &&
    summary.roleId === roleId &&
    summary.scenario === scenario
  );
}

export function readSummaryProgress(summary: PlanSummary, progressRaw: string | null): LearningProgress {
  if (progressRaw === null || progressRaw === undefined) {
    const nextSkill = summary.skillSteps[0]?.skill || null;
    return {
      completed: 0,
      inProgress: 0,
      total: summary.stepIds.length,
      nextSkill,
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(progressRaw);
  } catch {
    throw new Error("Malformed progress JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Progress must be an object.");
  }

  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v !== "boolean") {
      throw new Error(`Progress value for ${k} must be boolean.`);
    }
  }

  const completedStepIds = new Set<string>();
  for (const id of summary.stepIds) {
    if (parsed[id] === true) {
      completedStepIds.add(id);
    }
  }

  let nextSkill: string | null = null;
  for (const ss of summary.skillSteps) {
    if (!completedStepIds.has(ss.id)) {
      nextSkill = ss.skill;
      break;
    }
  }

  return {
    completed: completedStepIds.size,
    inProgress: 0,
    total: summary.stepIds.length,
    nextSkill,
  };
}

export const readLearningProgress = readSummaryProgress;
