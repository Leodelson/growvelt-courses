import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

// These authenticated RPCs currently treat an active/completed enrollment as
// sufficient access. A company reversal marks a paid seat's source, but does
// not cancel that shared enrollment. Keep this inventory complete until one
// reviewed source-aware policy is applied consistently to every surface.
const learnerSurfaces = new Set([
  "complete_own_enrolled_lesson",
  "get_own_enrolled_learning_course_by_slug",
  "get_own_enrolled_learning_course_experience_by_slug",
  "get_own_enrolled_learning_course_progress_by_slug",
  "get_own_enrolled_lesson_snapshot",
  "get_own_enrolled_quiz_snapshot",
  "get_own_learning_certificate_state",
  "get_own_learning_enrollment_state",
  "issue_own_learning_certificate",
  "list_own_learning_course_experience",
  "list_own_learning_course_progress",
  "list_own_learning_enrollments",
  "submit_own_quiz_attempt",
]);
const folder = new URL("../supabase/schemas/public/functions/", import.meta.url);
const discovered = new Set();
for (const filename of await readdir(folder)) {
  if (!filename.endsWith(".sql")) continue;
  const sql = await readFile(new URL(filename, folder), "utf8");
  const name = filename.slice(0, -4);
  // Aggregate instructor analytics reads enrollment counts but never grants
  // the instructor access to a learner's course content or progress writes.
  if (name === "get_own_instructor_learning_analytics") continue;
  if (!/\b(?:from|join)\s+public\.enrollments\b/i.test(sql)
      || !/\bgrant execute\b[\s\S]*\bto\s+"?authenticated"?/i.test(sql)
      || !/^(?:get_own_|list_own_|complete_own_|submit_own_|issue_own_)/.test(name)) continue;
  discovered.add(name);
  assert.match(sql, /auth\.uid\(\)/, `${name} must scope the learner identity`);
  assert.match(sql, /enrollment_row\.status|enrollment\.status/, `${name} must inspect the enrollment state`);
}
assert.deepEqual([...discovered].sort(), [...learnerSurfaces].sort(),
  "Authenticated learner access surfaces changed: review source-aware reversal coverage before live company checkout");
console.log(`PASS ${discovered.size} learner access RPCs inventoried for Phase 3C source-aware authorization`);
