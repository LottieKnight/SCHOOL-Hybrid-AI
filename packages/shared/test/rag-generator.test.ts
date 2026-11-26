import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeToPhase, extractJson, hasLongOverlap, buildResources } from "../src/rag/generator.js";
import type { RagChunkScore } from "../src/rag/retrieval.js";

// gradeToPhase

test("gradeToPhase maps grades 0-3 to foundation", () => {
  assert.equal(gradeToPhase(0), "foundation");
  assert.equal(gradeToPhase(1), "foundation");
  assert.equal(gradeToPhase(3), "foundation");
});

test("gradeToPhase maps grades 4-6 to intermediate", () => {
  assert.equal(gradeToPhase(4), "intermediate");
  assert.equal(gradeToPhase(6), "intermediate");
});

test("gradeToPhase maps grades 7-9 to senior", () => {
  assert.equal(gradeToPhase(7), "senior");
  assert.equal(gradeToPhase(9), "senior");
});

test("gradeToPhase maps grades 10-12 to fet", () => {
  assert.equal(gradeToPhase(10), "fet");
  assert.equal(gradeToPhase(12), "fet");
});

// extractJson

test("extractJson parses a clean JSON string", () => {
  const result = extractJson('{"title": "Algebra", "grade": 9}');
  assert.deepEqual(result, { title: "Algebra", grade: 9 });
});

test("extractJson extracts JSON embedded in surrounding prose", () => {
  const payload = 'Here is the lesson:\n{"title": "Fractions", "grade": 5}\nEnd of response.';
  const result = extractJson(payload);
  assert.deepEqual(result, { title: "Fractions", grade: 5 });
});

test("extractJson throws when no valid JSON is present", () => {
  assert.throws(() => extractJson("This is plain text with no JSON."), /failed to parse/i);
});

test("extractJson handles nested JSON objects", () => {
  const result = extractJson('{"quiz": {"questions": [{"id": 1, "prompt": "What is 2+2?"}]}}');
  assert.equal((result as { quiz: { questions: { id: number }[] } }).quiz.questions[0].id, 1);
});

// hasLongOverlap

test("hasLongOverlap returns false for short output below word threshold", () => {
  const source = ["The cat sat on the mat in the house with the red door open wide today."];
  const output = "The cat sat";
  assert.equal(hasLongOverlap(output, source, 20), false);
});

test("hasLongOverlap returns false when output is original (no overlap)", () => {
  const source = ["The quick brown fox jumps over the lazy dog and the sun is shining bright on a cloudless day"];
  const output = "An entirely different sentence about mathematics and scientific concepts in South Africa";
  assert.equal(hasLongOverlap(output, source, 5), false);
});

test("hasLongOverlap returns true when output contains a long copied sequence from source", () => {
  const repeatedPhrase = "the learner will understand algebraic expressions including variables constants and coefficients";
  const sourceDoc = `Introduction: ${repeatedPhrase} as defined by the CAPS curriculum for grade nine mathematics.`;
  const output = `Lesson notes: ${repeatedPhrase} according to the teacher guide.`;
  assert.equal(hasLongOverlap(output, [sourceDoc], 8), true);
});

test("hasLongOverlap is case-insensitive", () => {
  const source = ["south african curriculum assessment policy statement requires learners"];
  const output = "South African Curriculum Assessment Policy Statement Requires Learners to demonstrate";
  assert.equal(hasLongOverlap(output, [source[0]], 7), true);
});

// buildResources

function makeChunk(filePath: string, pageStart: number, pageEnd: number, docType = ""): RagChunkScore {
  return {
    file_path: filePath,
    page_start: pageStart,
    page_end: pageEnd,
    detected_grade: null,
    detected_term: null,
    detected_subject_key: null,
    language_tokens: [],
    phase: null,
    doc_type: docType,
    text: "sample text",
    score: 0.9,
  };
}

test("buildResources groups chunks from the same file", () => {
  const chunks = [
    makeChunk("content/pdf/maths/grade9.pdf", 10, 12),
    makeChunk("content/pdf/maths/grade9.pdf", 15, 17),
  ];
  const resources = buildResources(chunks);
  assert.equal(resources.length, 1);
  assert.ok(resources[0].pageRefs?.includes("10-12"));
  assert.ok(resources[0].pageRefs?.includes("15-17"));
});

test("buildResources creates separate entries for different files", () => {
  const chunks = [
    makeChunk("content/pdf/maths/grade9.pdf", 1, 3),
    makeChunk("content/pdf/english/grade9.pdf", 5, 7),
  ];
  const resources = buildResources(chunks);
  assert.equal(resources.length, 2);
});

test("buildResources strips the content/pdf/ prefix from sourcePdfPath", () => {
  const chunks = [makeChunk("content/pdf/mathematics/caps-grade10.pdf", 1, 5)];
  const resources = buildResources(chunks);
  assert.equal(resources[0].sourcePdfPath, "mathematics/caps-grade10.pdf");
});

test("buildResources includes doc_type in note when present", () => {
  const chunks = [makeChunk("content/pdf/science/textbook.pdf", 1, 3, "textbook")];
  const resources = buildResources(chunks);
  assert.ok(resources[0].note?.includes("textbook"));
});

test("buildResources formats single-page ranges without a dash", () => {
  const chunks = [makeChunk("content/pdf/history/notes.pdf", 7, 7)];
  const resources = buildResources(chunks);
  assert.ok(resources[0].pageRefs?.includes("p. 7"));
  assert.ok(!resources[0].pageRefs?.includes("pp."));
});

test("buildResources sorts page ranges numerically", () => {
  const chunks = [
    makeChunk("content/pdf/maths/grade8.pdf", 20, 22),
    makeChunk("content/pdf/maths/grade8.pdf", 5, 7),
    makeChunk("content/pdf/maths/grade8.pdf", 12, 14),
  ];
  const resources = buildResources(chunks);
  const pageRefs = resources[0].pageRefs ?? "";
  const firstPageRef = pageRefs.split(",")[0].trim();
  assert.ok(firstPageRef.includes("5"), `Expected first page ref to include "5", got: ${firstPageRef}`);
});
