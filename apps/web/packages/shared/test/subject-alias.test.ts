import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSubjectKey } from "../src/subject-alias";

const baseKeys = [
  "mathematics",
  "natural-sciences",
  "social-sciences",
  "technology",
  "life-skills",
  "english-home-language",
  "english-first-additional-language",
  "afrikaans-home-language",
  "afrikaans-first-additional-language",
];

test("resolves mathematics aliases", () => {
  const result = resolveSubjectKey({
    phase: "intermediate",
    grade: 5,
    filename: "Maths Term 1.pdf",
    outlineKeys: baseKeys,
  });
  assert.equal(result.subjectKey, "mathematics");
  assert.equal(result.confidence, "high");
});

test("resolves natural sciences via NS token", () => {
  const result = resolveSubjectKey({
    phase: "senior",
    grade: 8,
    filename: "NS Week 2",
    outlineKeys: baseKeys,
  });
  assert.equal(result.subjectKey, "natural-sciences");
});

test("resolves social sciences via words", () => {
  const result = resolveSubjectKey({
    phase: "senior",
    grade: 7,
    filename: "Social Sciences Term 2",
    outlineKeys: baseKeys,
  });
  assert.equal(result.subjectKey, "social-sciences");
});

test("resolves technology via tech token", () => {
  const result = resolveSubjectKey({
    phase: "intermediate",
    grade: 6,
    filename: "Tech Week 1",
    outlineKeys: baseKeys,
  });
  assert.equal(result.subjectKey, "technology");
});

test("resolves english home language", () => {
  const result = resolveSubjectKey({
    phase: "intermediate",
    grade: 4,
    filename: "English HL Term 3",
    outlineKeys: baseKeys,
  });
  assert.equal(result.subjectKey, "english-home-language");
});

test("resolves english first additional language", () => {
  const result = resolveSubjectKey({
    phase: "intermediate",
    grade: 4,
    filename: "English FAL Term 1",
    outlineKeys: baseKeys,
  });
  assert.equal(result.subjectKey, "english-first-additional-language");
});

test("afrikaans AFAL requires language token", () => {
  const valid = resolveSubjectKey({
    phase: "foundation",
    grade: 3,
    filename: "Afrikaans AFAL Term 2",
    outlineKeys: baseKeys,
  });
  assert.equal(valid.subjectKey, "afrikaans-first-additional-language");

  const invalid = resolveSubjectKey({
    phase: "foundation",
    grade: 3,
    filename: "AFAL Term 2",
    outlineKeys: baseKeys,
  });
  assert.equal(invalid.subjectKey, null);
});

test("life skills only resolves in foundation phase", () => {
  const foundation = resolveSubjectKey({
    phase: "foundation",
    grade: 2,
    filename: "Life Skills Week 4",
    outlineKeys: baseKeys,
  });
  assert.equal(foundation.subjectKey, "life-skills");

  const intermediate = resolveSubjectKey({
    phase: "intermediate",
    grade: 4,
    filename: "Life Skills Week 4",
    outlineKeys: baseKeys,
  });
  assert.equal(intermediate.subjectKey, null);
});

test("returns null on multiple candidates", () => {
  const result = resolveSubjectKey({
    phase: "senior",
    grade: 8,
    filename: "Maths and Natural Science",
    outlineKeys: baseKeys,
  });
  assert.equal(result.subjectKey, null);
});
