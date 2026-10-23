import test from "node:test";
import assert from "node:assert/strict";
import { canonicalSkill, recognisedAssessment, visibleMatches, roleEvidence, comparisonHref, resolveComparisonRole } from "../artifacts/workforce/src/lib/match-view-model.ts";

const catalog = { skills: ["JavaScript", "SQL"], methodology: { aliases: { js: "javascript", "structured query language": "sql" } } };
const role = (id, score, skills, interests, postings = 100, warning = false) => ({
  id, name: id, description: `${id} development`, score, matched_skills: skills,
  gaps: [{ skill: "Other skill" }], components: { skills: score - interests, interests, experience: 0 },
  postings, sample_warning: warning,
});
const records = [role("B", 40, ["SQL", "JavaScript"], 0), role("A", 70, ["SQL"], 15), role("C", 40, ["SQL", "SQL"], 10, 32, true)];

test("canonical matching uses documented aliases and collapsed whitespace", () => {
  assert.equal(canonicalSkill("  JS ", catalog.methodology.aliases), "javascript");
  assert.equal(canonicalSkill("Structured    Query Language", catalog.methodology.aliases), "sql");
});
test("recognised skills deduplicate aliases at maximum assessed level, preserving supplied names", () => {
  const profile = { skills: [{ name: "js", level: 1 }, { name: "JavaScript", level: 3 }, { name: "Rust", level: 2 }], unassessed_skills: ["SQL"] };
  assert.deepEqual(recognisedAssessment(profile, catalog), [{ name: "JavaScript", level: 3, supplied: ["js", "JavaScript"] }]);
});
test("score sorting is deterministic and never mutates the server result", () => {
  assert.deepEqual(visibleMatches(records, "score", "all").map(r => r.id), ["A", "B", "C"]);
  assert.deepEqual(records.map(r => r.id), ["B", "A", "C"]);
});
test("skills sorting counts distinct fully matched skills; interest sorting uses actual component points", () => {
  assert.deepEqual(visibleMatches(records, "skills", "all").map(r => r.id), ["B", "A", "C"]);
  assert.deepEqual(visibleMatches(records, "interests", "all").map(r => r.id), ["A", "C", "B"]);
});
test("limited samples remain exploratory, not automatically excluded or called certain", () => {
  assert.equal(roleEvidence(records[0]), "recorded");
  assert.equal(roleEvidence(records[2]), "limited");
  assert.deepEqual(visibleMatches(records, "score", "limited").map(r => r.id), ["C"]);
  assert.equal(visibleMatches(records, "score", "all").length, 3);
});
test("roles without posting or modelled-skill evidence are unassessed and sort last", () => {
  const absent = role("Absent", 100, [], 0, 0);
  assert.equal(roleEvidence(absent), "unavailable");
  assert.equal(roleEvidence({ ...absent, postings: 50, gaps: [] }), "unavailable");
  assert.equal(visibleMatches([...records, absent], "score", "all").at(-1).id, "Absent");
});
test("name and coverage filters compose; no matching rows remain a real empty array", () => {
  assert.deepEqual(visibleMatches(records, "score", "recorded", " A ").map(r => r.id), ["A"]);
  assert.deepEqual(visibleMatches(records, "score", "limited", "A"), []);
});
test("comparison URLs retain exact identifiers and do not duplicate the same selected role", () => {
  const params = new URL(comparisonHref("Software Engineer / Developer", "data-engineer"), "https://example.com").searchParams;
  assert.equal(params.get("left"), "Software Engineer / Developer");
  assert.equal(params.get("right"), "data-engineer");
  assert.equal(new URL(comparisonHref("same", "same"), "https://example.com").searchParams.has("right"), false);
});
test("public comparison resolves real IDs/legacy names, never arbitrary unsupported API scope", () => {
  const roles = [{ id: "data-engineer", name: "Data Engineer" }], names = ["Data Engineer"];
  assert.equal(resolveComparisonRole("data-engineer", roles, names), "Data Engineer");
  assert.equal(resolveComparisonRole("Data Engineer", roles, names), "Data Engineer");
  assert.equal(resolveComparisonRole("unknown", roles, names), null);
  assert.equal(resolveComparisonRole("data-engineer", roles, []), null);
});
