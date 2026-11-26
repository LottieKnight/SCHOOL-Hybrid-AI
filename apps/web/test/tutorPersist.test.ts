import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

vi.mock("server-only", () => ({}));

const REPO_DB = path.join(__dirname, "..", "prisma", "past-papers.db");
const TMP_DB = path.join(tmpdir(), `tutor-persist-${process.pid}.db`);
copyFileSync(REPO_DB, TMP_DB);
process.env.PAST_PAPERS_DATABASE_URL = TMP_DB;

import { buildWeightedSitting, recordMarkedAnswer, recordPaperPlan } from "../lib/tutor/persist";

const truth = new DatabaseSync(TMP_DB, { readOnly: false });

beforeAll(() => {
  truth.exec("PRAGMA foreign_keys = ON");
});

afterAll(() => {
  truth.close();
  rmSync(TMP_DB, { force: true });
});

describe("tutor persistence on past-paper models", () => {
  it("saves a mark as an attempt, an answer and a revision note", async () => {
    const saved = await recordMarkedAnswer({
      userId: "learner-test",
      subject: "Mathematics",
      grade: 11,
      questionLabel: "Find the gradient between (0, 1) and (2, 7).",
      maxMarks: 4,
      answerText: "Gradient = 3",
      score: 3,
      outOf: 4,
      feedback: "The rise over run is right. State the units of the axes next time.",
      missedSteps: ["name the axes"],
      topic: "Gradients",
    });
    const attempt = truth.prepare("SELECT status, pastPaperId, totalScore FROM PastPaperAttempt WHERE id = ?").get(saved.attemptId) as {
      status: string;
      pastPaperId: string;
      totalScore: number;
    };
    const answer = truth.prepare("SELECT answerText, autoScore, questionId FROM PastPaperAnswer WHERE attemptId = ?").get(saved.attemptId) as {
      answerText: string;
      autoScore: number;
      questionId: string;
    };
    const note = truth.prepare("SELECT sourceType, sourceId, artifactType, evidenceJson FROM RevisionArtifact WHERE id = ?").get(saved.artifactId) as {
      sourceType: string;
      sourceId: string;
      artifactType: string;
      evidenceJson: string;
    };
    expect(attempt.status).toBe("marked");
    expect(attempt.pastPaperId).toBe(saved.paperId);
    expect(attempt.totalScore).toBe(3);
    expect(answer.questionId).toBe(saved.questionId);
    expect(answer.autoScore).toBe(3);
    expect(answer.answerText).toContain("Gradient");
    expect(note.artifactType).toBe("error_revision");
    expect(note.sourceType).toBe("past_paper_question");
    expect(note.sourceId).toBe(saved.questionId);
    expect(note.evidenceJson).toContain("followUp");
  });

  it("saves a paper plan against the paper, attempt and answer rows", async () => {
    const saved = await recordPaperPlan({
      userId: "learner-test",
      subject: "Physical Sciences",
      grade: 12,
      plan: {
        subject: "Physical Sciences",
        topics: [
          { name: "Newton's laws", marks: 12, priority: "high" },
          { name: "Electric circuits", marks: 8, priority: "medium" },
        ],
        plan: [
          { day: 1, focus: "Newton's laws", tasks: ["Draw two free-body diagrams."] },
          { day: 2, focus: "Timed practice", tasks: ["Write a 30-minute mixed paper."] },
        ],
      },
    });
    const attempt = truth.prepare("SELECT status, analyticsJson FROM PastPaperAttempt WHERE id = ?").get(saved.attemptId) as {
      status: string;
      analyticsJson: string;
    };
    const answers = truth.prepare("SELECT COUNT(*) AS n FROM PastPaperAnswer WHERE attemptId = ?").get(saved.attemptId) as { n: number };
    expect(attempt.status).toBe("planned");
    expect(attempt.analyticsJson).toContain("Newton");
    expect(answers.n).toBe(2);
    const paper = truth.prepare("SELECT id FROM PastPaper WHERE id = ?").get(saved.paperId);
    expect(paper).toBeTruthy();
  });

  it("does not put a learner's own prompt into another learner's sitting", async () => {
    const catalog = truth.prepare(
      "SELECT subject, grade FROM PastPaper WHERE grade IN (10, 11, 12) AND subject != '' LIMIT 1",
    ).get() as { subject: string; grade: number };
    const privateMark = await recordMarkedAnswer({
      userId: "learner-private",
      subject: catalog.subject,
      grade: catalog.grade,
      questionLabel: "My private working that must not be shared",
      maxMarks: 3,
      answerText: "private",
      score: 1,
      outOf: 3,
      feedback: "keep this private",
      missedSteps: [],
      topic: "Private",
    });
    const sitting = await buildWeightedSitting({
      userId: "other-learner",
      minutes: 10,
      limit: 3,
      subject: catalog.subject,
      grade: catalog.grade,
      random: () => 0,
    });
    expect(sitting.questions.map((question) => question.id)).not.toContain(privateMark.questionId);
    expect(sitting.questions.every((question) => question.subject === catalog.subject && question.grade === catalog.grade)).toBe(true);

    await recordMarkedAnswer({
      userId: "learner-private",
      subject: "Learner private prompt",
      grade: 11,
      questionLabel: "Only this learner typed this",
      maxMarks: 2,
      answerText: "private",
      score: 0,
      outOf: 2,
      feedback: "private",
      missedSteps: [],
    });
    await expect(buildWeightedSitting({
      userId: "other-learner",
      minutes: 10,
      limit: 2,
      subject: "Learner private prompt",
      grade: 11,
    })).rejects.toThrow(/No Grade 10-12 questions/);
  });
});
