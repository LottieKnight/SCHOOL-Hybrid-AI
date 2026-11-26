import { test } from "node:test";
import assert from "node:assert/strict";
import { loadCourseOutline } from "../src/curriculum";

test("course outline loads with phases", () => {
  const outline = loadCourseOutline();
  const phases = Object.keys(outline.phases);
  assert.ok(phases.length > 0);
});
