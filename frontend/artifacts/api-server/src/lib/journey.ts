import journeyConfig from "../../../../config/journey.json";
import workforceSnapshot from "../data/workforce-snapshot.json";

export interface SkillInput {
  name: string;
  level: number;
}

export interface ProfileInput {
  skills: SkillInput[];
  experience_years: number;
  interests: string[];
  hours_per_week?: number;
  current_role?: string;
  [key: string]: any;
}

const roleIdMap: Record<string, string> = {
  "software-developer": "Software Engineer / Developer",
  "data-engineer": "Data Engineer",
  "data-scientist": "Data Scientist",
  "ai-engineer": "Machine Learning / AI Engineer",
  "cloud-engineer": "Cloud Engineer",
};

const roleNameToId: Record<string, string> = {
  "Software Engineer / Developer": "software-developer",
  "Data Engineer": "data-engineer",
  "Data Scientist": "data-scientist",
  "Machine Learning / AI Engineer": "ai-engineer",
  "Cloud Engineer": "cloud-engineer",
};

// Aliases lookup
const aliases: Record<string, string> = {
  js: "javascript",
  "structured query language": "sql",
  py: "python",
  ml: "machine learning",
  ai: "artificial intelligence",
};

const goalTitles: Record<number, string> = {
  1: "No Poverty",
  2: "Zero Hunger",
  3: "Good Health and Well-being",
  4: "Quality Education",
  5: "Gender Equality",
  6: "Clean Water and Sanitation",
  7: "Affordable and Clean Energy",
  8: "Decent Work and Economic Growth",
  9: "Industry, Innovation and Infrastructure",
  10: "Reduced Inequalities",
  11: "Sustainable Cities and Communities",
  12: "Responsible Consumption and Production",
  13: "Climate Action",
  14: "Life Below Water",
  15: "Life on Land",
  16: "Peace, Justice and Strong Institutions",
  17: "Partnerships for the Goals",
};

export function buildSdgObj(id: number, reason?: string) {
  const title = goalTitles[id] || `Goal ${id}`;
  return {
    id,
    title,
    url: `https://sdgs.un.org/goals/goal${id}`,
    reason: reason || `Editorial connection to UN Sustainable Development Goal ${id}: ${title}`,
  };
}

export function normalizeInterest(raw: string): string {
  if (!raw || typeof raw !== "string") return "Working with data";
  const lower = raw.toLowerCase();
  if (lower.includes("product") || lower.includes("software")) return "Building products";
  if (lower.includes("data")) return "Working with data";
  if (lower.includes("ai") || lower.includes("artificial") || lower.includes("machine") || lower.includes("automation")) return "AI and automation";
  if (lower.includes("cloud") || lower.includes("infrastructure")) return "Cloud and infrastructure";
  if (lower.includes("people") || lower.includes("social")) return "People and social impact";
  if (lower.includes("sustain")) return "Sustainability";
  return raw;
}

export function canonicalSkillName(raw: string): string {
  const clean = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return aliases[clean] || clean;
}

export function validInterests(profile: any): boolean {
  if (!profile || typeof profile !== "object") return false;
  if (!Array.isArray(profile.skills)) return false;
  for (const s of profile.skills) {
    if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.name.trim()) return false;
  }
  if (!Array.isArray(profile.interests) || profile.interests.length === 0) return false;
  return true;
}

export function hasRole(roleId: string): boolean {
  return journeyConfig.roles.some((r) => r.id === roleId);
}

export function journeyCatalog() {
  const sdgs = Array.from({ length: 17 }, (_, i) => ({
    id: i + 1,
    name: `Goal ${i + 1}`,
    url: `https://sdgs.un.org/goals/goal${i + 1}`,
  }));

  const skillsSet = new Set<string>();
  const demands: Record<string, any> = workforceSnapshot.demands;
  for (const roleData of Object.values(demands)) {
    if (roleData?.skills) {
      for (const s of roleData.skills) {
        skillsSet.add(s.skill);
      }
    }
  }

  const rolesWithSdgs = journeyConfig.roles.map((r: any) => ({
    ...r,
    sdgs: (r.goals || [8, 9]).map((gid: number) => buildSdgObj(gid, `This role aligns with UN SDG ${gid}.`)),
  }));

  const skillSdgs = Object.entries(journeyConfig.skill_goals || {}).map(([skill, goals]) => ({
    skill,
    sdgs: (goals as number[]).map((gid: number) => buildSdgObj(gid, `${skill} capability links with UN SDG ${gid}.`)),
  }));

  return {
    sdgs,
    roles: rolesWithSdgs,
    skills: Array.from(skillsSet).sort(),
    skill_sdgs: skillSdgs,
    scenarios: journeyConfig.scenarios,
    interests: journeyConfig.interests,
    methodology: {
      aliases,
      note: "Match score is not a hiring probability; it reflects overlap with historical skill demand.",
    },
    privacy_note: "All personal profile details remain private in your browser. Calculations run on the backend without saving your data.",
  };
}

export function matchProfile(profile: ProfileInput, scenarioId: string = "balanced") {
  const scenario = journeyConfig.scenarios.find((s) => s.id === scenarioId) || journeyConfig.scenarios[0];
  const boosts: Record<string, number> = (scenario as any).boosts || {};

  // Normalize user skills: group by canonical lower-case name, keep max level
  const userSkillLevels = new Map<string, { originalName: string; level: number }>();
  for (const s of profile.skills) {
    const canon = canonicalSkillName(s.name);
    const existing = userSkillLevels.get(canon);
    if (!existing || s.level > existing.level) {
      userSkillLevels.set(canon, { originalName: s.name.trim(), level: s.level });
    }
  }

  // All known skills across all roles
  const demands: Record<string, any> = workforceSnapshot.demands;
  const allKnownSkills = new Set<string>();
  for (const d of Object.values(demands)) {
    if (d?.skills) {
      for (const s of d.skills) {
        allKnownSkills.add(canonicalSkillName(s.skill));
      }
    }
  }

  // Track unrecognised skills
  const unrecognised: string[] = [];
  for (const [canon, info] of userSkillLevels.entries()) {
    if (!allKnownSkills.has(canon)) {
      unrecognised.push(info.originalName);
    }
  }

  const roleMatches = journeyConfig.roles.map((roleConfig) => {
    const roleName = roleIdMap[roleConfig.id] || roleConfig.name;
    const roleDemand = demands[roleName];
    const demandSkills: Array<{ skill: string; posting_count: number; posting_share_percentage: number }> = roleDemand?.skills || [];
    const rolePostings = workforceSnapshot.overview.roles.find((r) => r.name === roleName)?.postings || 0;

    let skillPointsTotal = 0;
    let maxSkillPoints = 0;
    const gaps: Array<{
      skill: string;
      current_level: number;
      target_level: number;
      importance?: string;
      sdgs: Array<ReturnType<typeof buildSdgObj>>;
    }> = [];
    const matchedSkills: string[] = [];

    const targetLevel = journeyConfig.scoring.target_level || 2;

    for (const d of demandSkills) {
      const canon = canonicalSkillName(d.skill);
      const user = userSkillLevels.get(canon);
      const userLvl = user?.level ?? 0;
      const boost = boosts[d.skill] ?? 1;
      const weight = (d.posting_share_percentage || 1) * boost;
      maxSkillPoints += weight;

      if (userLvl >= targetLevel) {
        skillPointsTotal += weight;
        matchedSkills.push(d.skill);
      } else {
        if (userLvl > 0) {
          skillPointsTotal += weight * (userLvl / targetLevel);
        }
        const rawGoals: number[] = (journeyConfig.skill_goals as any)[d.skill] || [8, 9];
        gaps.push({
          skill: d.skill,
          current_level: userLvl,
          target_level: targetLevel,
          importance: weight >= 20 ? "High" : "Standard",
          sdgs: rawGoals.map((gid) => buildSdgObj(gid, `Advancing ${d.skill} capability connects directly to UN SDG ${gid}.`)),
        });
      }
    }

    const maxSkillComponent = journeyConfig.scoring.skills; // 75
    const skillScore = maxSkillPoints > 0 ? (skillPointsTotal / maxSkillPoints) * maxSkillComponent : 0;

    // Interests
    const roleInterests = new Set(roleConfig.interests || []);
    const userInterests = (profile.interests || []).map(normalizeInterest);
    const matchingInterests = userInterests.filter((i) => roleInterests.has(i));
    const interestScore = roleInterests.size > 0 ? (matchingInterests.length / roleInterests.size) * journeyConfig.scoring.interests : 0;

    // Experience
    const refYears = roleConfig.reference_years || 2;
    const expScore = Math.min(journeyConfig.scoring.experience, (profile.experience_years / refYears) * journeyConfig.scoring.experience);

    const rawTotal = Math.round(skillScore + interestScore + expScore);
    const score = Math.max(0, Math.min(100, rawTotal));

    // Ensure components add up exactly to score
    const cSkills = Math.round(skillScore);
    const cInterests = Math.round(interestScore);
    const cExp = score - (cSkills + cInterests);

    return {
      id: roleConfig.id,
      name: roleConfig.name,
      description: (workforceSnapshot.overview.roles.find((r) => r.name === roleName) as any)?.description || roleConfig.name,
      score,
      components: {
        skills: cSkills,
        interests: cInterests,
        experience: cExp,
      },
      matched_skills: matchedSkills,
      gaps,
      postings: rolePostings,
      sample_warning: rolePostings < 50,
      sdgs: (roleConfig.goals || [8, 9]).map((gid: number) => buildSdgObj(gid, `This role's responsibilities align with UN SDG ${gid}.`)),
    };
  });

  // Sort descending by score
  roleMatches.sort((a, b) => b.score - a.score);

  return {
    roles: roleMatches,
    scenario: scenarioId,
    unrecognised_skills: unrecognised,
    methodology: "Match score is not a hiring probability; it reflects overlap with historical skill demand.",
  };
}

export function learningPathway(profile: ProfileInput, scenarioId: string, roleId: string) {
  const matches = matchProfile(profile, scenarioId);
  const targetRole = matches.roles.find((r) => r.id === roleId);
  const roleConfig = journeyConfig.roles.find((r) => r.id === roleId) || journeyConfig.roles[0];
  const hoursPerWeek = profile.hours_per_week || 6;

  const steps: any[] = [];
  let elapsedHours = 0;

  if (targetRole) {
    for (const gap of targetRole.gaps) {
      const isNew = gap.current_level === 0;
      const hours = isNew ? journeyConfig.planning.new_skill_hours : journeyConfig.planning.improve_skill_hours;
      const startWeek = Math.floor(elapsedHours / hoursPerWeek) + 1;
      elapsedHours += hours;
      const endWeek = Math.ceil(elapsedHours / hoursPerWeek);

      // Find courses from snapshot
      const group = (workforceSnapshot.courses as any)[gap.skill];
      const catalogCourses = (group?.courses || []).slice(0, 3).map((c: any) => ({
        id: c.id,
        title: c.title,
        provider: c.provider,
        url: c.url && c.url.startsWith("http") ? c.url : `https://www.coursera.org/learn/${c.id || "course"}`,
        level: c.level,
        source_record: true,
      }));

      steps.push({
        id: `step-${gap.skill.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: `Learn ${gap.skill}`,
        summary: `Develop working knowledge of ${gap.skill} required for ${targetRole?.name || "your target role"}.`,
        skill: gap.skill,
        kind: "skill",
        hours,
        start_week: startWeek,
        end_week: endWeek,
        current_level: gap.current_level,
        target_level: gap.target_level,
        sdgs: gap.sdgs,
        catalog_courses: catalogCourses,
        resources: [
          {
            title: `${gap.skill} Fundamentals & Documentation`,
            url: "https://developer.mozilla.org",
            cost: "Free",
          },
        ],
      });
    }
  }

  // Always append the final project step
  const projectHours = journeyConfig.planning.project_hours || 12;
  const projStartWeek = Math.floor(elapsedHours / hoursPerWeek) + 1;
  elapsedHours += projectHours;
  const projEndWeek = Math.ceil(elapsedHours / hoursPerWeek);

  steps.push({
    id: `project-${roleId}`,
    title: `Practical Project: ${roleConfig.name}`,
    summary: roleConfig.project || "Build a capstone project to demonstrate your skills.",
    skill: targetRole?.matched_skills?.[0] || "Capstone",
    kind: "project",
    hours: projectHours,
    start_week: projStartWeek,
    end_week: projEndWeek,
    description: roleConfig.project,
    sdgs: (roleConfig.goals || [8, 9]).map((gid: number) => buildSdgObj(gid, `Capstone project contributes to UN SDG ${gid}.`)),
    resources: [
      {
        title: "Project Guidance & Standards",
        url: "https://developer.mozilla.org",
        cost: "Free",
      },
    ],
    catalog_courses: [],
  });

  const totalHours = steps.reduce((sum, s) => sum + s.hours, 0);
  const weeks = Math.ceil(totalHours / hoursPerWeek);

  // Deterministic plan_id
  const skillsHash = profile.skills.map((s) => `${s.name.toLowerCase()}:${s.level}`).sort().join("|");
  const planId = `plan-${roleId}-${scenarioId}-${hoursPerWeek}-${skillsHash}`;

  return {
    plan_id: planId,
    role: targetRole || { id: roleId, name: roleConfig.name, score: 0, sdgs: [] },
    scenario: scenarioId,
    hours_per_week: hoursPerWeek,
    total_hours: totalHours,
    weeks,
    steps,
    notes: [
      "Learning hours and weeks are editorial planning estimates — not course-provider duration, a guaranteed completion date or a job outcome.",
      "Checklist progress is stored locally in your browser and does not change your readiness score."
    ],
  };
}
