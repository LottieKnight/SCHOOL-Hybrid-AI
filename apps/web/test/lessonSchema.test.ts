import { describe, expect, it } from "vitest";
import { buildLessonId, buildPracticeLinks, normalizeLesson, quickCheckFeedback } from "../lib/lessons/schema";

const context = {
  phase: "foundation",
  grade: 1,
  subject: "English Home Language",
  subjectKey: "english-home-language",
  term: 1,
  week: 1,
  topic: "Listening and speaking (T1 W1)",
  summary: "This week builds core skills for the term.\n\n- Focus on listening and speaking through short texts and discussions.",
  curriculum: "CAPS" as const,
};

describe("normalizeLesson", () => {
  it("builds a teachable frame from outline context when no lesson file exists", () => {
    const result = normalizeLesson(null, context);
    expect(result.source).toBe("scaffold");
    expect(result.lesson.schemaVersion).toBe(2);
    expect(result.lesson.id).toBe(buildLessonId(context));
    expect(result.lesson.learningObjectives.length).toBeGreaterThan(0);
    expect(result.lesson.sections.some((section) => section.kind === "worked_example")).toBe(true);
    expect(result.lesson.sections.some((section) => section.kind === "exam_tip")).toBe(true);
    expect(result.lesson.quickChecks.length).toBeGreaterThan(0);
    expect(result.lesson.teacherGuide.pacing.length).toBeGreaterThan(0);
    expect(result.lesson.teacherGuide.misconceptions.length).toBeGreaterThan(0);
    expect(result.lesson.practice.pastPapersHref).toContain("/past-papers?");
    expect(result.lesson.practice.tutorHref).toContain("/tutor?");
    expect(result.lesson.outlineBacked).toBe(true);
  });

  it("upgrades a generated v1 lesson without dropping quiz or teacher notes", () => {
    const result = normalizeLesson(
      {
        title: "Listening and speaking",
        summary: "Learners practise short oral turns.",
        objectives: ["Take a short speaking turn."],
        sections: {
          explanation: [{ heading: "Turns", content: "A speaker takes a turn, then listens." }],
          worked_examples: [{ heading: "Board example", content: "Step 1: Greet.\nStep 2: Ask one question." }],
          guided_practice: [{ heading: "Pairs", content: "Practise a greeting in pairs." }],
          independent_practice: [{ heading: "Solo", content: "Record one sentence." }],
        },
        quiz: {
          questions: [
            {
              id: "q1",
              type: "mcq",
              prompt: "What comes after a speaking turn?",
              options: ["Listening", "Leaving", "Shouting"],
              answer: "Listening",
              explanation: "A turn includes listening to the reply.",
            },
          ],
        },
        teacher_notes: ["Common error: learners talk over each other."],
        citations: [{ source_path: "caps/efal.pdf", page_start: 4, page_end: 5, snippet_hash: "abc" }],
      },
      context
    );

    expect(result.source).toBe("generated-v1");
    expect(result.lesson.title).toBe("Listening and speaking");
    expect(result.lesson.quickChecks[0]?.answer).toBe("Listening");
    expect(result.lesson.quickChecks[0]?.kind).toBe("mcq");
    expect(result.lesson.teacherGuide.misconceptions[0]).toMatch(/Common error/);
    expect(result.lesson.sections.find((section) => section.kind === "worked_example")?.steps?.length).toBe(2);
    expect(result.lesson.citations[0]).toContain("caps/efal.pdf");
    expect(result.lesson.outlineBacked).toBe(false);
  });

  it("upgrades the legacy lesson JSON shape, including a true/false question", () => {
    const result = normalizeLesson(
      {
        version: 1,
        grade: 4,
        phase: "intermediate",
        term: 2,
        week: 3,
        subject: "Mathematics",
        topic: "Fractions of a whole",
        summary: "Learners name fractions of a shape.",
        outcomes: ["Identify a unit fraction."],
        explanation: "A fraction names equal parts of a whole.",
        workedExamples: ["Shade 1 of 4 equal parts."],
        practice: { easy: ["Shade one half."], medium: [], hard: [] },
        lessonOutline: ["Equal parts", "Numerator"],
        activities: ["Fold a paper into quarters."],
        assessment: ["Exam tip: write the denominator as the number of equal parts."],
        resources: [{ title: "CAPS maths", sourcePdfPath: "caps/maths.pdf" }],
        extractedText: "One quarter means one of four equal parts.",
        quiz: {
          questions: [
            {
              id: "tf1",
              type: "true_false",
              prompt: "Four equal parts make quarters.",
              answer: "True",
              explanation: "Quarters are four equal parts.",
              difficulty: "easy",
              tags: ["fractions"],
            },
          ],
        },
        teacherNotes: ["Ask learners which picture shows one quarter."],
      },
      { curriculum: "CAPS" }
    );

    expect(result.source).toBe("legacy-json");
    expect(result.lesson.curriculum.grade).toBe(4);
    expect(result.lesson.curriculum.phase).toBe("intermediate");
    expect(result.lesson.learningObjectives).toContain("Identify a unit fraction.");
    expect(result.lesson.quickChecks[0]?.options).toEqual(["True", "False"]);
    expect(result.lesson.practice.pastPapersHref).toContain("subject=Mathematics");
    expect(result.lesson.practice.pastPapersHref).toContain("grade=4");
    expect(result.warnings).toEqual([]);
  });

  it("upgrades shared lesson v2 content and generator payloads", () => {
    const v2 = normalizeLesson(
      {
        id: "lesson-v2-1",
        phase: "senior",
        grade: 8,
        subjectKey: "natural-sciences",
        term: 1,
        week: 2,
        title: "Photosynthesis",
        topic: "Photosynthesis",
        summary: "Plants make food using light.",
        outcomes: ["Describe the inputs of photosynthesis."],
        sections: [{ heading: "Inputs", content: "Plants use light, water, and carbon dioxide." }],
        workedExamples: ["Name the gas plants take in."],
        practice: { easy: ["List two inputs."], medium: [], hard: [] },
        quiz: {
          questions: [
            {
              prompt: "Which gas is a product?",
              type: "short_answer",
              answer: "Oxygen",
              explanation: "Oxygen is released.",
            },
          ],
        },
        resources: [{ label: "NS CAPS", href: "caps/ns.pdf" }],
        version: 2,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-02",
        language: "en",
      },
      { subject: "Natural Sciences", curriculum: "CAPS" }
    );
    expect(v2.source).toBe("lesson-v2");
    expect(v2.lesson.id).toBe("lesson-v2-1");
    expect(v2.lesson.quickChecks[0]?.kind).toBe("reveal");
    expect(v2.lesson.curriculum.subject).toBe("Natural Sciences");

    const generated = normalizeLesson(
      {
        title: "Trade",
        topic: "Specialisation",
        summary: "Countries trade what they produce well.",
        learningOutcomes: ["Explain specialisation."],
        lessonNotes: [{ heading: "Specialisation", content: "A country focuses on what it produces at a lower cost." }],
        workedExamples: ["Compare two producers."],
        practice: { easy: [], medium: ["Give one local example."], hard: [] },
        quiz: { questions: [] },
        teacherNotes: ["Misconception: trade only helps the richer country."],
      },
      { phase: "fet", grade: 11, subject: "Economics", subjectKey: "economics", term: 2, week: 4, curriculum: "IEB" }
    );
    expect(generated.source).toBe("generator-content");
    expect(generated.lesson.curriculum.curriculum).toBe("IEB");
    expect(generated.lesson.teacherGuide.misconceptions[0]).toMatch(/Misconception/);
    expect(generated.lesson.quickChecks.length).toBeGreaterThan(0);
  });

  it("keeps an already structured lesson and fills institutional metadata from context", () => {
    const result = normalizeLesson(
      {
        schemaVersion: 2,
        id: "custom-1",
        title: "Already structured",
        summary: "Ready for class.",
        learningObjectives: ["State the rule."],
        curriculum: {
          curriculum: "IEB",
          phase: "fet",
          grade: 12,
          subject: "Accounting",
          subjectKey: "accounting",
          term: 3,
          topic: "Cash budgets",
          outcomes: ["Prepare a cash budget."],
          estimatedMinutes: 55,
          difficulty: "extension",
          prerequisites: ["Income statements"],
          capsTopicCode: "IEB-ACC-12-T3",
        },
        keyConcepts: [{ term: "Receipt", definition: "Money expected in." }],
        sections: [{ id: "e1", kind: "explanation", heading: "Receipts", body: "List money coming in." }],
        quickChecks: [
          {
            id: "c1",
            kind: "mcq",
            prompt: "A receipt is money...",
            options: ["coming in", "going out"],
            answer: "coming in",
            explanation: "Receipts increase cash.",
          },
        ],
        teacherGuide: { notes: ["Use a three-column board layout."] },
      },
      { institutionId: "school-12", classId: "12A", cohortId: "2026", curriculumStandard: "IEB", termWeighting: 1.5 }
    );

    expect(result.source).toBe("structured-v2");
    expect(result.lesson.id).toBe("custom-1");
    expect(result.lesson.curriculum.capsTopicCode).toBe("IEB-ACC-12-T3");
    expect(result.lesson.curriculum.institutionId).toBe("school-12");
    expect(result.lesson.curriculum.classId).toBe("12A");
    expect(result.lesson.curriculum.termWeighting).toBe(1.5);
    expect(result.lesson.curriculum.estimatedMinutes).toBe(55);
    expect(result.lesson.quickChecks).toHaveLength(1);
  });

  it("does not throw on a broken payload", () => {
    expect(() => normalizeLesson("nope", context)).not.toThrow();
    expect(() => normalizeLesson({ topic: 12, quiz: { questions: [{ prompt: "" }] } }, {})).not.toThrow();
    const broken = normalizeLesson({ lessonOutline: [""], extractedText: "   " }, { phase: "fet", grade: 10, subject: "History", subjectKey: "history", term: 1, week: 9 });
    expect(broken.lesson.schemaVersion).toBe(2);
    expect(broken.lesson.sections.length).toBeGreaterThan(0);
  });
});

describe("authored lesson extras", () => {
  it("keeps a generated lesson video and shows a short-answer model answer", () => {
    const result = normalizeLesson(
      {
        title: "Listening and speaking",
        summary: "Learners practise short oral turns.",
        objectives: ["Take a short speaking turn."],
        sections: {
          explanation: [{ heading: "Turns", content: "A speaker takes a turn, then listens." }],
          worked_examples: [{ heading: "Board example", content: "Greet, then ask one question." }],
          guided_practice: [{ heading: "Pairs", content: "Practise a greeting in pairs." }],
          independent_practice: [{ heading: "Solo", content: "Record one sentence." }],
        },
        quiz: {
          questions: [
            {
              id: "short-1",
              type: "short_answer",
              prompt: "What do you do after you speak?",
              answer: "Listen",
              explanation: "The next move is to listen.",
            },
          ],
        },
        teacher_notes: ["Keep turns short."],
        citations: [{ source_path: "caps/efal.pdf", page_start: 4, page_end: 5, snippet_hash: "abc" }],
        video: {
          videoUrl: "https://videos.example/listening.mp4",
          provider: "other",
          thumbnailUrl: "https://videos.example/listening.jpg",
        },
      },
      context
    );

    expect(result.lesson.video).toEqual({
      videoUrl: "https://videos.example/listening.mp4",
      provider: "other",
      thumbnailUrl: "https://videos.example/listening.jpg",
    });
    const check = result.lesson.quickChecks[0]!;
    expect(check.kind).toBe("reveal");
    expect(quickCheckFeedback(check, false)).toBe("Model answer: Listen. The next move is to listen.");
  });
});

describe("practice links", () => {
  it("points at the same subject and topic", () => {
    const links = buildPracticeLinks({ subject: "Life Sciences", grade: 11, topic: "Genetics" });
    expect(links.pastPapersHref).toContain("subject=Life+Sciences");
    expect(links.pastPapersHref).toContain("grade=11");
    expect(links.pastPapersHref).toContain("q=Genetics");
    expect(links.tutorHref).toContain("subject=Life+Sciences");
    expect(decodeURIComponent(links.tutorHref)).toContain("Genetics");
  });
});
