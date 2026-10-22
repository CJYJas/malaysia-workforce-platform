import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCourseIndex, courseFacets, filterCourseIndex } from "../artifacts/api-server/src/lib/course-catalog.ts";
const snapshot = JSON.parse(fs.readFileSync(new URL("../artifacts/api-server/src/data/workforce-snapshot.json", import.meta.url), "utf8"));
const index = buildCourseIndex(snapshot.courses);
test("index deduplicates actual source IDs instead of claiming the full source catalogue", () => {
  assert.equal(index.length, new Set(Object.values(snapshot.courses).flatMap(group => group.courses.map(course => course.id))).size);
  assert.equal(index.length, 205); assert.ok(index.length < snapshot.overview.course_count);
});
test("repeated records retain every actual retrieval skill without mutating the snapshot", () => {
  const before = JSON.stringify(snapshot);
  const fresh = buildCourseIndex(snapshot.courses);
  assert.equal(JSON.stringify(snapshot), before);
  for (const [skill, group] of Object.entries(snapshot.courses)) for (const course of group.courses) {
    const record = fresh.find(item => item.id === course.id);
    assert.ok(record.indexed_skills.includes(skill));
    assert.equal(record.title, course.title);
  }
});
test("title and actual skill search are case insensitive and blank-safe", () => {
  assert.ok(filterCourseIndex(index, { q: "  javascript " }).length > 0);
  assert.deepEqual(filterCourseIndex(index, { q: "JAVASCRIPT" }), filterCourseIndex(index, { q: "javascript" }));
  assert.equal(filterCourseIndex(index, { q: "   " }).length, index.length);
  assert.equal(filterCourseIndex(index, { q: "no such course 947529" }).length, 0);
});
test("facets contain recorded values only, with independent composition", () => {
  const facets = courseFacets(index);
  assert.ok(facets.providers.includes("IBM"));
  const results = filterCourseIndex(index, { provider: "ibm", level: "Beginner level", skill: "JavaScript" });
  assert.ok(results.length > 0);
  assert.ok(results.every(item => item.provider === "IBM" && item.level === "Beginner level"));
  assert.ok(facets.levels.every(level => index.some(item => item.level === level)));
});
test("filtering is immutable and raw metadata is preserved without invented fields", () => {
  const before = JSON.stringify(index);
  filterCourseIndex(index, { skill: "SQL", q: "data" });
  assert.equal(JSON.stringify(index), before);
  const first = index[0];
  const source = Object.values(snapshot.courses).flatMap(group => group.courses).find(item => item.id === first.id);
  assert.deepEqual(Object.fromEntries(Object.entries(first).filter(([key]) => key !== "indexed_skills")), source);
});
