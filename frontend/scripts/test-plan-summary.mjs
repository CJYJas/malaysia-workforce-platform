import test from "node:test";
import assert from "node:assert/strict";
import { summarisePlan, parsePlanSummary, readSummaryProgress, summaryMatchesScope } from "../artifacts/workforce/src/lib/plan-summary-model.ts";

const plan = {
  plan_id: "actual-response-id", role: { id: "data-engineer" }, scenario: "balanced",
  total_hours: 48, weeks: 8,
  steps: [{ id: "python", skill: "Python", kind: "skill" }, { id: "sql", skill: "SQL", kind: "skill" }, { id: "project", skill: "", kind: "project" }],
};
test("summary copies identifiers and estimates from the actual plan response", () => {
  const summary = summarisePlan(plan, "core");
  assert.deepEqual(summary.stepIds, ["python", "sql", "project"]);
  assert.deepEqual(summary.skillSteps, [{ id: "python", skill: "Python" }, { id: "sql", skill: "SQL" }]);
  assert.equal(summary.totalHours, 48); assert.equal(summary.weeks, 8);
  assert.equal(summary.planId, plan.plan_id);
});
test("saved summary round trips without inventing plan completion", () => {
  const summary = summarisePlan(plan, "core");
  assert.deepEqual(parsePlanSummary(JSON.stringify(summary)), summary);
  assert.equal(parsePlanSummary(null), null);
});
test("only the same profile inputs, target role and scenario can display its summary", () => {
  const summary = summarisePlan(plan, "core");
  assert.equal(summaryMatchesScope(summary, "core", "data-engineer", "balanced"), true);
  assert.equal(summaryMatchesScope(summary, "changed", "data-engineer", "balanced"), false);
  assert.equal(summaryMatchesScope(summary, "core", "cloud-engineer", "balanced"), false);
  assert.equal(summaryMatchesScope(summary, "core", "data-engineer", "ai_acceleration"), false);
  assert.equal(summaryMatchesScope(summary, null, "data-engineer", "balanced"), false);
});
test("only true checkmarks belonging to actual plan steps count", () => {
  assert.deepEqual(readSummaryProgress(summarisePlan(plan, "core"), '{"python":true,"sql":false,"alien":true}'), { completed: 1, inProgress: 0, total: 3, nextSkill: "SQL" });
});
test("completed skill steps are not suggested again as a remaining course gap", () => {
  assert.deepEqual(readSummaryProgress(summarisePlan(plan, "core"), '{"python":true,"sql":true}'), { completed: 2, inProgress: 0, total: 3, nextSkill: null });
});
test("a newly generated plan starts with no completed learning steps", () => {
  assert.deepEqual(readSummaryProgress(summarisePlan(plan, "core"), null), { completed: 0, inProgress: 0, total: 3, nextSkill: "Python" });
});
test("corrupt summary metadata fails explicitly", () => {
  const summary = summarisePlan(plan, "core");
  for (const change of [{ version: 2 }, { fingerprint: "" }, { stepIds: ["duplicate", "duplicate"] }, { skillSteps: [{ id: "alien", skill: "Python" }] }, { generatedAt: "unknown" }]) {
    assert.throws(() => parsePlanSummary(JSON.stringify({ ...summary, ...change })));
  }
});
test("malformed progress is not silently rewritten or marked complete", () => {
  for (const raw of ['[]', 'null', '{"python":"yes"}', 'broken']) assert.throws(() => readSummaryProgress(summarisePlan(plan, "core"), raw));
});
