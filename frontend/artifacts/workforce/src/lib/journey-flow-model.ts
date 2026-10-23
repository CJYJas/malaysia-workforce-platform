export interface FlowRecord {
  version: 1;
  fingerprint: string;
  radarReviewed: boolean;
  match: { scenario: string; roleId: string } | null;
  pathway: { scenario: string; roleId: string } | null;
}

export function flowFingerprint(profile: any): string {
  if (!profile) return "";
  const skills = Array.isArray(profile.skills)
    ? profile.skills
        .map((s: any) => ({
          name: (s?.name || "").trim().toLowerCase(),
          level: s?.level ?? 1,
        }))
        .filter((s: any) => s.name)
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
        .map((s: any) => `${s.name}:${s.level}`)
        .join(",")
    : "";

  const interests = Array.isArray(profile.interests)
    ? profile.interests
        .map((i: any) => (i || "").trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join(",")
    : "";

  const exp = profile.experience_years ?? 0;
  const hours = profile.hours_per_week ?? 6;

  return `fp|s:${skills}|i:${interests}|e:${exp}|h:${hours}`;
}

export function reviewFlowRadar(record: FlowRecord | null, key: string): FlowRecord {
  if (!key) throw new Error("A valid fingerprint key is required.");
  if (record && record.fingerprint === key && record.radarReviewed) {
    return record;
  }
  return {
    version: 1,
    fingerprint: key,
    radarReviewed: true,
    match: null,
    pathway: null,
  };
}

export function chooseFlowRole(
  record: FlowRecord | null,
  key: string,
  scenario: string,
  roleId: string,
): FlowRecord {
  if (!record || !record.radarReviewed || record.fingerprint !== key) {
    throw new Error("Choosing a role requires a reviewed radar matching the current profile.");
  }
  if (record.match?.scenario === scenario && record.match?.roleId === roleId) {
    return record;
  }
  return {
    ...record,
    match: { scenario, roleId },
    pathway: null,
  };
}

export function finishFlowPathway(
  record: FlowRecord | null,
  key: string,
  scenario: string,
  roleId: string,
): FlowRecord | null {
  if (!record) return null;
  if (!record.match || record.match.scenario !== scenario || record.match.roleId !== roleId || record.fingerprint !== key) {
    return record;
  }
  if (record.pathway?.scenario === scenario && record.pathway?.roleId === roleId) {
    return record;
  }
  return {
    ...record,
    pathway: { scenario, roleId },
  };
}

export function flowCompletion(
  profile: any,
  scenario: string,
  roleId: string,
  record: FlowRecord | null,
): [boolean, boolean, boolean, boolean] {
  const step1 = !!profile && Array.isArray(profile.skills);
  if (!step1) return [false, false, false, false];

  const fp = flowFingerprint(profile);
  const step2 = step1 && !!record && record.fingerprint === fp && record.radarReviewed === true;
  const step3 = step2 && !!record.match && record.match.scenario === scenario && record.match.roleId === roleId && !!roleId;
  const step4 = step3 && !!record.pathway && record.pathway.scenario === scenario && record.pathway.roleId === roleId;

  return [step1, step2, step3, step4];
}

export function firstIncompleteStep(steps: [boolean, boolean, boolean, boolean] | boolean[]): number {
  for (let i = 0; i < steps.length; i++) {
    if (!steps[i]) return i + 1;
  }
  return steps.length;
}

export function canEnterStep(steps: [boolean, boolean, boolean, boolean] | boolean[], step: number): boolean {
  if (step < 1 || step > steps.length) return false;
  if (step === 1) return true;
  return !!steps[step - 2];
}

export function readFlowRecord(raw: string | null): FlowRecord | null {
  if (raw === null || raw === undefined) return null;
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Malformed flow record JSON.");
  }
  if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
    throw new Error("Invalid flow record version.");
  }
  if (!parsed.fingerprint || typeof parsed.radarReviewed !== "boolean") {
    throw new Error("Incomplete flow record.");
  }
  if (!parsed.radarReviewed && (parsed.match || parsed.pathway)) {
    throw new Error("Cannot have matches or pathways without radarReviewed.");
  }
  if (parsed.pathway && (!parsed.match || parsed.pathway.roleId !== parsed.match.roleId || parsed.pathway.scenario !== parsed.match.scenario)) {
    throw new Error("Pathway cannot exist without matching role decision.");
  }

  return parsed as FlowRecord;
}
