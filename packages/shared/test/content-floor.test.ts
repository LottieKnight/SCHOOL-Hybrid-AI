import assert from "node:assert/strict";
import test from "node:test";
import { evaluateContentFloor, type ContentIndex } from "../src/content-index.js";

function indexWithWeeks(weeks: Array<{ json: boolean; resources: number }>): ContentIndex {
  return {
    generated_at: "2026-11-02T00:00:00.000Z",
    stats: {
      total_week_folders: weeks.length,
      weeks_with_json: weeks.filter((week) => week.json).length,
      weeks_with_resources_only: weeks.filter((week) => !week.json && week.resources > 0).length,
      phases: 1,
      grades: 1,
      subjects: 1,
    },
    phases: {
      senior: {
        grades: {
          "09": {
            subjects: {
              mathematics: {
                terms: {
                  "1": {
                    weeks: Object.fromEntries(
                      weeks.map((week, index) => [String(index + 1).padStart(2, "0"), {
                        hasLessonJson: week.json,
                        resourcesCount: week.resources,
                        resourceTypes: week.resources ? ["worksheet"] : [],
                      }]),
                    ),
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

test("content floor marks complete coverage green", () => {
  const report = evaluateContentFloor(indexWithWeeks([
    { json: true, resources: 1 },
    { json: true, resources: 1 },
    { json: true, resources: 1 },
    { json: true, resources: 1 },
  ]));
  assert.equal(report.overall.status, "green");
  assert.equal(report.overall.lessonCoveragePercent, 100);
});

test("content floor marks partial but usable coverage amber", () => {
  const report = evaluateContentFloor(indexWithWeeks([
    { json: true, resources: 1 },
    { json: true, resources: 1 },
    { json: false, resources: 1 },
    { json: false, resources: 1 },
  ]));
  assert.equal(report.overall.status, "amber");
  assert.equal(report.overall.lessonCoveragePercent, 50);
});

test("content floor marks empty coverage red", () => {
  const report = evaluateContentFloor(indexWithWeeks([
    { json: false, resources: 0 },
  ]));
  assert.equal(report.overall.status, "red");
});
