export const PROFILE_STORAGE_KEY = "my-next-chapter.profile.v1";

export const PROFILE_STATUSES = [
  "Student",
  "Job seeker",
  "Employed (exploring transition)",
  "Employed (upskilling in role)",
  "Other",
] as const;

export const EDUCATION_LEVELS = [
  "Secondary school",
  "Diploma",
  "Bachelor's degree",
  "Master's degree",
  "Doctorate",
  "Self-taught / Boot camp",
  "Other",
] as const;

export const ADDITIONAL_INTERESTS = [
  "Cybersecurity",
  "Mobile app development",
  "DevOps & SRE",
  "Game development",
  "IoT & Embedded Systems",
  "Blockchain & Web3",
  "UI/UX & Product Design",
  "Cloud Architecture",
] as const;

export interface ProfileDetails {
  display_name: string;
  current_status: string;
  education_level: string;
  field_of_study: string;
  experience_summary: string;
  additional_interests: string[];
  desired_skills: string[];
  unsure_skills: string[];
}

export function emptyProfileDetails(): ProfileDetails {
  return {
    display_name: "",
    current_status: "",
    education_level: "",
    field_of_study: "",
    experience_summary: "",
    additional_interests: [],
    desired_skills: [],
    unsure_skills: [],
  };
}

export function parseProfileDetails(raw: any): ProfileDetails {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid profile details structure.");
  }

  const def = emptyProfileDetails();
  const display_name = typeof raw.display_name === "string" ? raw.display_name.trim() : (raw.display_name === undefined ? "" : (() => { throw new Error("Invalid display name"); })());
  if (display_name.length > 80) throw new Error("Display name must be 80 characters or fewer.");

  const current_status = typeof raw.current_status === "string" ? raw.current_status.trim() : (raw.current_status === undefined ? "" : (() => { throw new Error("Invalid status"); })());
  if (current_status && !PROFILE_STATUSES.includes(current_status as any)) {
    throw new Error("Invalid current status.");
  }

  let education_level = typeof raw.education_level === "string" ? raw.education_level.trim() : (raw.education_level === undefined ? "" : (() => { throw new Error("Invalid education level"); })());
  if (education_level) {
    const match = EDUCATION_LEVELS.find(l => l.toLowerCase() === education_level.toLowerCase());
    if (match) {
      education_level = match;
    } else {
      throw new Error(`Invalid education level: ${education_level}`);
    }
  }

  const field_of_study = typeof raw.field_of_study === "string" ? raw.field_of_study.trim() : (raw.field_of_study === undefined ? "" : (() => { throw new Error("Invalid field of study"); })());
  if (field_of_study.length > 120) throw new Error("Field of study must be 120 characters or fewer.");

  const experience_summary = typeof raw.experience_summary === "string" ? raw.experience_summary.trim() : (raw.experience_summary === undefined ? "" : (() => { throw new Error("Invalid summary"); })());
  if (experience_summary.length > 2000) throw new Error("Experience summary must be 2000 characters or fewer.");

  // Additional interests
  const additional_interests_raw = Array.isArray(raw.additional_interests) ? raw.additional_interests : [];
  const interestSet = new Set<string>();
  const additional_interests: string[] = [];
  for (const i of additional_interests_raw) {
    if (typeof i !== "string" || !ADDITIONAL_INTERESTS.includes(i as any)) {
      throw new Error(`Unsupported additional interest: ${i}`);
    }
    const clean = i.trim();
    if (clean && !interestSet.has(clean)) {
      interestSet.add(clean);
      additional_interests.push(clean);
    }
  }

  // Desired skills
  const desired_skills_raw = Array.isArray(raw.desired_skills) ? raw.desired_skills : [];
  if (desired_skills_raw.length > 20) throw new Error("Desired skills cannot exceed 20.");
  const desiredSet = new Set<string>();
  const desired_skills: string[] = [];
  for (const item of desired_skills_raw) {
    if (typeof item !== "string") throw new Error("Desired skill must be a string.");
    const clean = item.trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!desiredSet.has(lower)) {
      desiredSet.add(lower);
      desired_skills.push(clean);
    }
  }

  // Unsure skills
  const unsure_skills_raw = Array.isArray(raw.unsure_skills) ? raw.unsure_skills : [];
  if (unsure_skills_raw.length > 20) throw new Error("Unsure skills cannot exceed 20.");
  const unsureSet = new Set<string>();
  const unsure_skills: string[] = [];
  for (const item of unsure_skills_raw) {
    if (typeof item !== "string") throw new Error("Unsure skill must be a string.");
    const clean = item.trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!unsureSet.has(lower)) {
      unsureSet.add(lower);
      unsure_skills.push(clean);
    }
  }

  return {
    display_name,
    current_status,
    education_level,
    field_of_study,
    experience_summary,
    additional_interests,
    desired_skills,
    unsure_skills,
  };
}

export function decodeSavedProfile(raw: string | null): { value: any; details: ProfileDetails; error: string | null } {
  if (raw === null || raw === undefined) {
    return { value: null, details: emptyProfileDetails(), error: null };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { value: null, details: emptyProfileDetails(), error: "Malformed profile JSON." };
  }

  if (!parsed || typeof parsed !== "object" || parsed.version !== 1 || !parsed.profile || typeof parsed.profile !== "object") {
    return { value: null, details: emptyProfileDetails(), error: "Invalid profile version or structure." };
  }

  // Validate and sanitize core skills
  if (!Array.isArray(parsed.profile.skills)) {
    return { value: null, details: emptyProfileDetails(), error: "Profile skills must be an array." };
  }
  const cleanSkills: Array<{ name: string; level: number }> = [];
  for (const s of parsed.profile.skills) {
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      return { value: null, details: emptyProfileDetails(), error: "Malformed skill in profile." };
    }
    const rawName = typeof s.name === "string"
      ? s.name.trim()
      : (typeof s.name?.skill === "string"
          ? s.name.skill.trim()
          : (typeof s.skill === "string" ? s.skill.trim() : String(s.name || "")));
    const cleanName = rawName.trim();
    if (!cleanName) {
      return { value: null, details: emptyProfileDetails(), error: "Skill name cannot be empty." };
    }
    const cleanLevel = typeof s.level === "number" && s.level > 0 ? s.level : 2;
    cleanSkills.push({ name: cleanName, level: cleanLevel });
  }
  parsed.profile.skills = cleanSkills;

  let details = emptyProfileDetails();
  let detailsError: string | null = null;
  if (parsed.details !== undefined) {
    try {
      details = parseProfileDetails(parsed.details);
    } catch {
      detailsError = "Warning: Some optional profile context could not be loaded, but your original skills profile is intact.";
    }
  }

  return {
    value: parsed.profile,
    details,
    error: detailsError,
  };
}

export function readSavedProfile(storage: { getItem(key: string): string | null }): { value: any; details: ProfileDetails; error: string | null } {
  try {
    const raw = storage.getItem(PROFILE_STORAGE_KEY);
    return decodeSavedProfile(raw);
  } catch (err: any) {
    return { value: null, details: emptyProfileDetails(), error: `Storage is unavailable: ${err?.message || err}` };
  }
}

export function writeSavedProfile(
  storage: { setItem(key: string, value: string): void },
  profile: any,
  details: ProfileDetails,
) {
  if (!profile || typeof profile !== "object") {
    throw new Error("Invalid core profile.");
  }
  if (!Array.isArray(profile.skills)) {
    throw new Error("Skills must be an array.");
  }
  for (const s of profile.skills) {
    if (!s || typeof s !== "object" || typeof s.name !== "string" || !s.name.trim()) {
      throw new Error("Skill name required.");
    }
    if (typeof s.level !== "number" || s.level <= 0) {
      throw new Error("Proficiency level must be at least 1.");
    }
  }

  const parsedDetails = parseProfileDetails(details);

  // Validate no skill in both assessed profile and unsure
  const assessedNames = new Set(profile.skills.map((s: any) => s.name.trim().toLowerCase()));
  for (const unsure of parsedDetails.unsure_skills) {
    if (assessedNames.has(unsure.toLowerCase())) {
      throw new Error(`Skill "${unsure}" cannot be in both assessed skills and unsure skills.`);
    }
  }

  if (profile.skills.length + parsedDetails.unsure_skills.length > 60) {
    throw new Error("Combined skill count cannot exceed 60.");
  }

  const envelope = {
    version: 1,
    profile,
    details: parsedDetails,
  };

  storage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(envelope));
}
