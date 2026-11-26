import { test } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { retrieveChunks } from "../src/rag/retrieval";

test("retrieves chunks by topic and filters", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rag-test-"));
  const indexPath = path.join(tmpDir, "chunks.jsonl");

  const chunks = [
    {
      file_path: "content/pdf/foundation/grade-04/mathematics/term-01/week-02/lesson.pdf",
      page_start: 1,
      page_end: 2,
      detected_grade: 4,
      detected_term: 1,
      detected_subject_key: "mathematics",
      language_tokens: ["english"],
      phase: "foundation",
      doc_type: "lesson_plan",
      text: "Fractions are parts of a whole. This lesson introduces halves and quarters.",
    },
    {
      file_path: "content/pdf/foundation/grade-04/life-skills/term-01/week-02/lesson.pdf",
      page_start: 1,
      page_end: 2,
      detected_grade: 4,
      detected_term: 1,
      detected_subject_key: "life-skills",
      language_tokens: ["english"],
      phase: "foundation",
      doc_type: "lesson_plan",
      text: "Health and safety routines for the classroom.",
    },
  ];

  await fs.writeFile(indexPath, chunks.map((chunk) => JSON.stringify(chunk)).join("\n"));

  const results = await retrieveChunks({
    phase: "foundation",
    grade: 4,
    subjectKey: "mathematics",
    term: 1,
    week: 2,
    topic: "fractions",
    k: 2,
    indexPath,
  });

  assert.equal(results.length > 0, true);
  assert.equal(results[0].detected_subject_key, "mathematics");
});
