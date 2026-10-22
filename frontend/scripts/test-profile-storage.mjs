import assert from "node:assert/strict";
import { test } from "node:test";
import {
  PROFILE_STORAGE_KEY, decodeSavedProfile, emptyProfileDetails,
  parseProfileDetails, readSavedProfile, writeSavedProfile,
} from "../artifacts/workforce/src/lib/profile-storage.ts";

const core = () => ({
  skills: [{ name: "SQL", level: 2 }], experience_years: 2,
  interests: ["Working with data"], hours_per_week: 6, current_role: "",
});
function memoryStorage(entries = []) {
  const values = new Map(entries);
  return {
    values, writes: 0,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { this.writes++; values.set(key, value); },
  };
}

test("legacy v1 profile loads unchanged, with defaults and no automatic write", () => {
  const raw = JSON.stringify({ version: 1, profile: core() });
  const storage = memoryStorage([[PROFILE_STORAGE_KEY, raw]]);
  const restored = readSavedProfile(storage);
  assert.deepEqual(restored.value, core());
  assert.deepEqual(restored.details, emptyProfileDetails());
  assert.equal(restored.error, null);
  assert.equal(storage.writes, 0);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), raw);
});

test("optional context round-trips alongside—not inside—the API profile", () => {
  const storage = memoryStorage();
  const details = {
    ...emptyProfileDetails(), display_name: "Test learner", current_status: "Student",
    education_level: "Diploma", field_of_study: "Computing",
    experience_summary: "Synthetic private context",
    additional_interests: ["Cybersecurity"], desired_skills: ["Python"], unsure_skills: ["Rust"],
  };
  writeSavedProfile(storage, core(), details);
  const envelope = JSON.parse(storage.getItem(PROFILE_STORAGE_KEY));
  assert.equal(envelope.version, 1);
  assert.deepEqual(envelope.profile, core());
  assert.deepEqual(envelope.details, details);
  assert.deepEqual(readSavedProfile(storage).details, details);
  const request = JSON.stringify({ profile: readSavedProfile(storage).value, scenario: "balanced" });
  for (const field of Object.keys(details)) assert.ok(!request.includes(`"${field}"`));
  assert.ok(!request.includes("Synthetic private context"));
});

test("metadata-only edits leave matching input and all preference/progress entries intact", () => {
  const progressKey = "my-next-chapter.progress.example";
  const storage = memoryStorage([
    [progressKey, JSON.stringify({ step1: true })],
    ["my-next-chapter.role.v1", "data-engineer"],
    ["my-next-chapter.scenario.v1", "balanced"],
  ]);
  writeSavedProfile(storage, core(), emptyProfileDetails());
  const before = JSON.stringify(readSavedProfile(storage).value);
  writeSavedProfile(storage, core(), { ...emptyProfileDetails(), display_name: "Updated context" });
  assert.equal(JSON.stringify(readSavedProfile(storage).value), before);
  assert.equal(storage.getItem(progressKey), '{"step1":true}');
  assert.equal(storage.getItem("my-next-chapter.role.v1"), "data-engineer");
  assert.equal(storage.getItem("my-next-chapter.scenario.v1"), "balanced");
});

test("unassessed skills remain separate; level zero is not an API proficiency", () => {
  const storage = memoryStorage();
  writeSavedProfile(storage, core(), { ...emptyProfileDetails(), unsure_skills: ["Rust"] });
  assert.deepEqual(readSavedProfile(storage).value.skills, [{ name: "SQL", level: 2 }]);
  assert.deepEqual(readSavedProfile(storage).details.unsure_skills, ["Rust"]);
  assert.throws(() => writeSavedProfile(storage, {
    ...core(), skills: [{ name: "Rust", level: 0 }],
  }, emptyProfileDetails()));
});

test("assessed and unsure copies of the same skill are rejected without overwriting", () => {
  const storage = memoryStorage();
  writeSavedProfile(storage, core(), emptyProfileDetails());
  const before = storage.getItem(PROFILE_STORAGE_KEY);
  assert.throws(() => writeSavedProfile(storage, core(), {
    ...emptyProfileDetails(), unsure_skills: [" sql "],
  }), /both/);
  assert.equal(storage.getItem(PROFILE_STORAGE_KEY), before);
});

test("combined skill limit includes unsure skills", () => {
  const storage = memoryStorage();
  const full = { ...core(), skills: Array.from({ length: 60 }, (_, i) => ({ name: `Skill ${i}`, level: 1 })) };
  assert.throws(() => writeSavedProfile(storage, full, {
    ...emptyProfileDetails(), unsure_skills: ["Extra skill"],
  }), /60/);
  assert.equal(storage.writes, 0);
});

test("bad optional details cannot discard a valid legacy core profile", () => {
  for (const details of [null, [], { display_name: 4 }, { education_level: "invented" }]) {
    const restored = decodeSavedProfile(JSON.stringify({ version: 1, profile: core(), details }));
    assert.deepEqual(restored.value, core());
    assert.deepEqual(restored.details, emptyProfileDetails());
    assert.match(restored.error, /original skills profile is intact/);
  }
});

test("malformed core/envelopes are handled without throwing or overwriting", () => {
  for (const raw of ["{", "null", "[]", '{"version":2}', JSON.stringify({
    version: 1, profile: { ...core(), skills: [null] },
  })]) {
    const storage = memoryStorage([[PROFILE_STORAGE_KEY, raw]]);
    assert.equal(readSavedProfile(storage).value, null);
    assert.ok(readSavedProfile(storage).error);
    assert.equal(storage.writes, 0);
  }
});

test("context bounds and enums are validated before storage", () => {
  for (const bad of [
    { display_name: "x".repeat(81) }, { field_of_study: "x".repeat(121) },
    { experience_summary: "x".repeat(2001) }, { current_status: "unsupported" },
    { additional_interests: ["invented"] }, { desired_skills: Array(21).fill("Python") },
  ]) {
    const storage = memoryStorage();
    assert.throws(() => writeSavedProfile(storage, core(), { ...emptyProfileDetails(), ...bad }));
    assert.equal(storage.writes, 0);
  }
});

test("denied reads and failed writes do not silently claim persistence", () => {
  const restored = readSavedProfile({ getItem() { throw new Error("denied"); } });
  assert.equal(restored.value, null);
  assert.match(restored.error, /unavailable/);
  assert.throws(() => writeSavedProfile({
    setItem() { throw new Error("quota exceeded"); },
  }, core(), emptyProfileDetails()), /quota/);
});

test("no saved profile yields independent empty detail arrays", () => {
  const first = decodeSavedProfile(null);
  first.details.desired_skills.push("Python");
  assert.deepEqual(decodeSavedProfile(null).details.desired_skills, []);
  assert.equal(decodeSavedProfile(null).error, null);
});

test("skill context trims and deduplicates without changing proficiency or aliases", () => {
  const details = parseProfileDetails({
    desired_skills: [" Python ", "python"], unsure_skills: ["Rust", "rust"],
  });
  assert.equal(details.desired_skills.length, 1);
  assert.equal(details.unsure_skills.length, 1);
  const storage = memoryStorage();
  writeSavedProfile(storage, core(), details);
  assert.deepEqual(readSavedProfile(storage).value, core());
});
