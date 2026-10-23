import test from "node:test";
import assert from "node:assert/strict";
import {
  canEnterStep, chooseFlowRole, finishFlowPathway, firstIncompleteStep, flowCompletion,
  flowFingerprint, readFlowRecord, reviewFlowRadar,
} from "../artifacts/workforce/src/lib/journey-flow-model.ts";

const profile = {
  skills: [{ name: "SQL", level: 2 }, { name: "Python", level: 1 }],
  experience_years: 2, interests: ["Working with data"], hours_per_week: 6, current_role: "",
};
const key = flowFingerprint(profile);
const reviewed = () => reviewFlowRadar(null, key);
const chosen = () => chooseFlowRole(reviewed(), key, "balanced", "data-engineer");

test("a new learner starts at stage one and cannot jump ahead", () => {
  const steps = flowCompletion(null, "balanced", "", null);
  assert.deepEqual(steps, [false, false, false, false]);
  assert.equal(firstIncompleteStep(steps), 1);
  assert.equal(canEnterStep(steps, 1), true);
  assert.equal(canEnterStep(steps, 2), false);
  assert.equal(canEnterStep(steps, 4), false);
});
test("a legacy saved profile unlocks only the radar, not invented past completion", () => {
  const steps = flowCompletion(profile, "balanced", "data-engineer", null);
  assert.deepEqual(steps, [true, false, false, false]);
  assert.equal(firstIncompleteStep(steps), 2);
  assert.equal(canEnterStep(steps, 3), false);
});
test("viewing a source is not completion until the learner explicitly continues", () => {
  assert.throws(() => reviewFlowRadar(null, ""));
  assert.deepEqual(flowCompletion(profile, "balanced", "", reviewed()), [true, true, false, false]);
});
test("choosing a role requires a reviewed radar", () => {
  assert.throws(() => chooseFlowRole(null, key, "balanced", "data-engineer"));
  assert.throws(() => chooseFlowRole(reviewed(), "different-inputs", "balanced", "data-engineer"));
  assert.deepEqual(flowCompletion(profile, "balanced", "data-engineer", chosen()), [true, true, true, false]);
});
test("only the actual selected role and scenario can complete the pathway", () => {
  const record = chosen();
  assert.equal(finishFlowPathway(record, key, "balanced", "cloud-engineer"), record);
  assert.equal(finishFlowPathway(record, key, "ai_acceleration", "data-engineer"), record);
  const completed = finishFlowPathway(record, key, "balanced", "data-engineer");
  assert.deepEqual(flowCompletion(profile, "balanced", "data-engineer", completed), [true, true, true, true]);
  assert.equal(finishFlowPathway(completed, key, "balanced", "data-engineer"), completed);
});
test("reloading restores progress without involving course completion keys", () => {
  const saved = finishFlowPathway(chosen(), key, "balanced", "data-engineer");
  const restored = readFlowRecord(JSON.stringify(saved));
  assert.deepEqual(flowCompletion(profile, "balanced", "data-engineer", restored), [true, true, true, true]);
  assert.equal(firstIncompleteStep([true, true, true, true]), 4);
});
test("biography and descriptive current-role edits do not reset the guide", () => {
  assert.equal(flowFingerprint({ ...profile, current_role: "A different descriptive title" }), key);
  assert.equal(flowFingerprint({ ...profile, display_name: "Synthetic context", desired_skills: ["Rust"] }), key);
});
test("normalised ordering and casing do not invent a changed profile", () => {
  assert.equal(flowFingerprint({ ...profile, skills: [{ name: " python ", level: 1 }, { name: "sql", level: 2 }], interests: [" working WITH data "] }), key);
});
test("real input changes require reviewing the guidance again, without mutating the old record", () => {
  const completed = finishFlowPathway(chosen(), key, "balanced", "data-engineer");
  assert.deepEqual(flowCompletion({ ...profile, hours_per_week: 10 }, "balanced", "data-engineer", completed), [true, false, false, false]);
  assert.deepEqual(flowCompletion(profile, "balanced", "data-engineer", completed), [true, true, true, true]);
  const next = reviewFlowRadar(completed, flowFingerprint({ ...profile, experience_years: 3 }));
  assert.equal(next.match, null);
  assert.equal(next.pathway, null);
});
test("scenario or chosen-role changes require a new role decision but not repeating the radar", () => {
  const completed = finishFlowPathway(chosen(), key, "balanced", "data-engineer");
  assert.deepEqual(flowCompletion(profile, "ai_acceleration", "data-engineer", completed), [true, true, false, false]);
  assert.deepEqual(flowCompletion(profile, "balanced", "cloud-engineer", completed), [true, true, false, false]);
  const changed = chooseFlowRole(completed, key, "ai_acceleration", "data-engineer");
  assert.equal(changed.pathway, null);
  assert.equal(changed.radarReviewed, true);
});
test("revisiting already completed stages preserves downstream completion", () => {
  const completed = finishFlowPathway(chosen(), key, "balanced", "data-engineer");
  assert.deepEqual(reviewFlowRadar(completed, key), completed);
  assert.deepEqual(chooseFlowRole(completed, key, "balanced", "data-engineer"), completed);
});
test("malformed or out-of-order stored flags cannot unlock later steps", () => {
  assert.equal(readFlowRecord(null), null);
  for (const raw of ["{", "null", "[]", '{"version":2}', JSON.stringify({ ...chosen(), radarReviewed: false }),
    JSON.stringify({ ...chosen(), pathway: { scenario: "balanced", roleId: "cloud-engineer" } })]) {
    assert.throws(() => readFlowRecord(raw));
  }
  assert.equal(canEnterStep([true, true, true, true], 0), false);
  assert.equal(canEnterStep([true, true, true, true], 5), false);
});
