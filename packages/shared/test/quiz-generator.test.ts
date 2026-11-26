import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { generateQuiz } from "../src/quiz-generator.js";

const PHOTO_TEXT =
  "Photosynthesis is the process by which plants produce food. " +
  "Plants absorb sunlight through chlorophyll in their leaves. " +
  "Carbon dioxide enters through tiny pores called stomata. " +
  "Water travels from the roots up through the stem. " +
  "Oxygen is released as a byproduct of photosynthesis.";

describe("generateQuiz - shape", () => {
  test("returns an object with a questions array", () => {
    const result = generateQuiz(PHOTO_TEXT, 5);
    assert.ok(Array.isArray(result.questions));
  });

  test("always produces at least 6 questions", () => {
    const result = generateQuiz(PHOTO_TEXT, 5);
    assert.ok(result.questions.length >= 6, `got ${result.questions.length}`);
  });

  test("every question has required fields", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    for (const q of questions) {
      assert.ok(typeof q.id === "string" && q.id.length > 0, "id missing");
      assert.ok(["mcq", "true_false", "short_answer"].includes(q.type), `bad type: ${q.type}`);
      assert.ok(typeof q.prompt === "string" && q.prompt.length > 0, "prompt missing");
      assert.ok(typeof q.answer === "string" && q.answer.length > 0, "answer missing");
      assert.ok(typeof q.explanation === "string" && q.explanation.length > 0, "explanation missing");
      assert.ok(["easy", "medium", "hard"].includes(q.difficulty), `bad difficulty: ${q.difficulty}`);
    }
  });

  test("all question IDs are unique", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    const ids = questions.map((q) => q.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });
});

describe("generateQuiz - MCQ questions", () => {
  test("MCQ questions have an options array with 2-5 items", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    const mcqs = questions.filter((q) => q.type === "mcq");
    assert.ok(mcqs.length >= 4, "expected at least 4 MCQ questions");
    for (const q of mcqs) {
      assert.ok(Array.isArray(q.options), "options should be an array");
      assert.ok(q.options!.length >= 2 && q.options!.length <= 5,
        `options count ${q.options!.length} out of range`);
    }
  });

  test("MCQ correct answer is one of the options", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    const mcqs = questions.filter((q) => q.type === "mcq");
    for (const q of mcqs) {
      assert.ok(q.options!.includes(q.answer), `answer "${q.answer}" not in options`);
    }
  });

  test("foundation-grade MCQ uses 'Fill in the missing word' prompt", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 1);
    const firstMcq = questions.find((q) => q.type === "mcq" && q.id.startsWith("mcq-"));
    assert.ok(firstMcq, "expected at least one mcq- question");
    assert.ok(
      firstMcq!.prompt.startsWith("Fill in the missing word"),
      `unexpected prompt: ${firstMcq!.prompt}`
    );
  });

  test("intermediate-grade MCQ uses 'Which word best completes' prompt", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    const firstMcq = questions.find((q) => q.type === "mcq" && q.id.startsWith("mcq-"));
    assert.ok(firstMcq!.prompt.startsWith("Which word best completes"),
      `unexpected prompt: ${firstMcq!.prompt}`);
  });

  test("senior-grade MCQ uses 'Select the term' prompt", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 10);
    const firstMcq = questions.find((q) => q.type === "mcq" && q.id.startsWith("mcq-"));
    assert.ok(firstMcq!.prompt.startsWith("Select the term"),
      `unexpected prompt: ${firstMcq!.prompt}`);
  });
});

describe("generateQuiz - short_answer questions", () => {
  test("produces 1 short_answer for grade 3 (foundation)", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 3);
    const sa = questions.filter((q) => q.type === "short_answer");
    assert.strictEqual(sa.length, 1);
  });

  test("produces 2 short_answers for grade 7 (senior)", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 7);
    const sa = questions.filter((q) => q.type === "short_answer");
    assert.strictEqual(sa.length, 2);
  });

  test("foundation short_answer prompt says 'Write one thing you learned'", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 2);
    const sa = questions.find((q) => q.type === "short_answer");
    assert.ok(sa!.prompt.startsWith("Write one thing you learned"),
      `unexpected: ${sa!.prompt}`);
  });

  test("senior short_answer prompt says 'Explain'", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 9);
    const sa = questions.find((q) => q.type === "short_answer");
    assert.ok(sa!.prompt.startsWith("Explain "),
      `unexpected: ${sa!.prompt}`);
  });
});

describe("generateQuiz - true_false question", () => {
  test("includes a true_false question when text has sentences", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    const tf = questions.filter((q) => q.type === "true_false");
    assert.strictEqual(tf.length, 1);
  });

  test("true_false answer is 'true'", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    const tf = questions.find((q) => q.type === "true_false");
    assert.strictEqual(tf!.answer, "true");
  });

  test("true_false has no options field", () => {
    const { questions } = generateQuiz(PHOTO_TEXT, 5);
    const tf = questions.find((q) => q.type === "true_false");
    assert.ok(!tf!.options || tf!.options.length === 0);
  });
});

describe("generateQuiz - fallback padding", () => {
  test("pads to at least 6 questions when text yields fewer", () => {
    // Single short sentence produces fewer natural questions than 6
    const { questions } = generateQuiz("Gravity pulls objects down.", 4);
    assert.ok(questions.length >= 6, `got ${questions.length}`);
  });

  test("fallback questions have type mcq", () => {
    const { questions } = generateQuiz("Gravity pulls objects down.", 4);
    const fallbacks = questions.filter((q) => q.id.startsWith("fallback-"));
    for (const q of fallbacks) {
      assert.strictEqual(q.type, "mcq");
    }
  });
});
