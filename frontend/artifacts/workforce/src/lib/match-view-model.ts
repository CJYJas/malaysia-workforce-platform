export type EvidenceFilter = "all" | "recorded" | "limited" | "unavailable";
export type MatchSort = "score" | "skills" | "interests" | "postings";

export interface MatchResultsViewProps {
  [key: string]: any;
}

export function canonicalSkill(skill: string, aliases?: Record<string, string>): string {
  const clean = (skill || "").trim().replace(/\s+/g, " ").toLowerCase();
  if (aliases) {
    const aliasMatch = aliases[clean];
    if (aliasMatch) return aliasMatch.toLowerCase();
  }
  return clean;
}

export function recognisedAssessment(profile: any, catalog: any) {
  if (!profile || !profile.skills || !catalog) return [];
  const catalogAliases = catalog.methodology?.aliases || {};
  const catalogSkills = new Set<string>();

  if (Array.isArray(catalog.skills)) {
    for (const s of catalog.skills) {
      catalogSkills.add(canonicalSkill(s, catalogAliases));
    }
  }

  // Also include skills from catalog roles / demands
  if (catalog.roles) {
    for (const r of catalog.roles) {
      if (r.skills) {
        for (const s of r.skills) {
          catalogSkills.add(canonicalSkill(s, catalogAliases));
        }
      }
    }
  }

  const map = new Map<string, { name: string; level: number; supplied: string[] }>();

  for (const s of profile.skills) {
    if (!s || !s.name) continue;
    const canon = canonicalSkill(s.name, catalogAliases);
    if (!catalogSkills.has(canon)) continue;

    const existing = map.get(canon);
    if (!existing) {
      map.set(canon, {
        name: s.name.trim(),
        level: s.level,
        supplied: [s.name.trim()],
      });
    } else {
      if (!existing.supplied.includes(s.name.trim())) {
        existing.supplied.push(s.name.trim());
      }
      if (s.level > existing.level) {
        existing.level = s.level;
        existing.name = s.name.trim();
      }
    }
  }

  return Array.from(map.values());
}

export function roleEvidence(role: any): EvidenceFilter {
  if (!role || (role.postings === 0 && (!role.matched_skills?.length && !role.gaps?.length))) {
    return "unavailable";
  }
  if (role.postings === 0 || !role.gaps || role.gaps.length === 0) {
    return "unavailable";
  }
  if (role.sample_warning || (role.postings !== undefined && role.postings < 50)) {
    return "limited";
  }
  return "recorded";
}

export function visibleMatches(
  records: any[],
  sort: MatchSort = "score",
  evidence: EvidenceFilter = "all",
  query: string = "",
): any[] {
  let list = records.slice();

  // Filter by evidence
  if (evidence !== "all") {
    list = list.filter((r) => roleEvidence(r) === evidence);
  }

  // Filter by query
  const q = query.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (r) =>
        (r.name && r.name.toLowerCase().includes(q)) ||
        (r.id && r.id.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)),
    );
  }

  // Sort
  list.sort((a, b) => {
    const aEv = roleEvidence(a);
    const bEv = roleEvidence(b);
    if (aEv === "unavailable" && bEv !== "unavailable") return 1;
    if (bEv === "unavailable" && aEv !== "unavailable") return -1;

    if (sort === "skills") {
      const aDistinct = new Set((a.matched_skills || []).map((s: any) => typeof s === "string" ? s : s?.skill || "")).size;
      const bDistinct = new Set((b.matched_skills || []).map((s: any) => typeof s === "string" ? s : s?.skill || "")).size;
      if (bDistinct !== aDistinct) return bDistinct - aDistinct;
    } else if (sort === "interests") {
      const aInt = a.components?.interests ?? 0;
      const bInt = b.components?.interests ?? 0;
      if (bInt !== aInt) return bInt - aInt;
    } else if (sort === "postings") {
      const aPost = a.postings ?? 0;
      const bPost = b.postings ?? 0;
      if (bPost !== aPost) return bPost - aPost;
    }

    // Default or fallback: score descending
    const aScore = a.score ?? 0;
    const bScore = b.score ?? 0;
    if (bScore !== aScore) return bScore - aScore;

    return String(a.id || "").localeCompare(String(b.id || ""));
  });

  return list;
}

export function comparisonHref(left: string, right: string): string {
  const leftClean = encodeURIComponent(left.trim());
  if (!right || right.trim() === left.trim()) {
    return `/compare?left=${leftClean}`;
  }
  const rightClean = encodeURIComponent(right.trim());
  return `/compare?left=${leftClean}&right=${rightClean}`;
}

export function resolveComparisonRole(
  idOrName: string,
  roles: Array<{ id: string; name: string }>,
  allowedNames: string[],
): string | null {
  if (!idOrName || !roles || !allowedNames || allowedNames.length === 0) return null;
  const match = roles.find(
    (r) => r.id === idOrName || r.name.toLowerCase() === idOrName.toLowerCase(),
  );
  if (!match) return null;
  const isAllowed = allowedNames.some(
    (n) => n.toLowerCase() === match.name.toLowerCase(),
  );
  return isAllowed ? match.name : null;
}
