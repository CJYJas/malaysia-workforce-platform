import test from "node:test";
import assert from "node:assert/strict";
import { readLearningProgress, readSummaryProgress } from "../artifacts/workforce/src/lib/plan-summary-model.ts";
const steps = [{ id: "sql" }, { id: "python" }, { id: "project" }];
const summary = { stepIds: steps.map(s => s.id), skillSteps: [{ id: "sql", skill: "SQL" }, { id: "python", skill: "Python" }] };

test("legacy booleans retain completed/unchecked meaning on the same IDs", () => {
  assert.deepEqual(readLearningProgress('{"sql":true,"python":false}', steps), { sql: "completed", python: "not_started" });
});
test("all three statuses survive a storage roundtrip without changing other steps", () => {
  const prior = readLearningProgress('{"sql":true,"python":false}', steps);
  const updated = { ...prior, python: "in_progress", project: "not_started" };
  assert.deepEqual(readLearningProgress(JSON.stringify(updated), steps), updated);
  assert.equal(updated.sql, "completed");
});
test("in progress is distinct from completed in Overview and next-skill selection", () => {
  assert.deepEqual(readSummaryProgress(summary, '{"sql":true,"python":"in_progress","project":"not_started"}'), {
    completed: 1, inProgress: 1, total: 3, nextSkill: "Python",
  });
});
test("completed statuses and legacy booleans mix without double counting", () => {
  const result = readSummaryProgress(summary, '{"sql":"completed","python":true,"project":"in_progress"}');
  assert.equal(result.completed, 2); assert.equal(result.inProgress, 1); assert.equal(result.nextSkill, null);
});
test("unrecognised plan steps do not leak progress into another plan", () => {
  assert.deepEqual(readLearningProgress('{"sql":true,"other-plan":"completed"}', steps), { sql: "completed" });
});
test("empty progress starts honestly, corruption is not treated as completion", () => {
  assert.deepEqual(readLearningProgress(null, steps), {});
  for (const raw of ['[]', 'null', '{"sql":1}', '{"sql":"done"}', '{broken', '{"sql":null}']) assert.throws(() => readLearningProgress(raw, steps));
});
