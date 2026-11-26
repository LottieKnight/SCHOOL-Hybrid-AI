import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { patchUserAppPreferences, readDailyQuizState, getUserAppPreferences } from "@/lib/server/userProfileState";
import { withPlannerDbClient } from "@/lib/server/plannerDb";
import { awardScholarCredits } from "@/lib/server/creditsAward";
import { captureLearningSession } from "@/lib/learning/capture";

type QuizSubmitBody = {
  quizId?: unknown;
  answers?: unknown;
  date?: unknown;
};

type AnswerInput = {
  questionId: string;
  answer: string;
};

type QuizSessionRow = {
  id: string;
  user_id: string;
  completed: boolean;
};

type QuestionRow = {
  id: string;
  question_text: string;
  answer: string;
  subject: string;
};

function isSchemaUnavailable(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "42P01" || code === "42703";
}

function normalizeAnswer(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parseAnswers(value: unknown): AnswerInput[] | null {
  if (Array.isArray(value)) {
    const parsed: AnswerInput[] = [];

    for (const item of value) {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const questionId = typeof record.questionId === "string" ? record.questionId.trim() : "";
      const answer = typeof record.answer === "string" ? record.answer : "";
      if (!questionId) return null;
      parsed.push({ questionId, answer });
    }

    return parsed;
  }

  if (value && typeof value === "object") {
    const parsed: AnswerInput[] = [];
    for (const [questionId, answer] of Object.entries(value as Record<string, unknown>)) {
      if (!questionId) return null;
      parsed.push({ questionId, answer: typeof answer === "string" ? answer : String(answer ?? "") });
    }
    return parsed.length > 0 ? parsed : null;
  }

  return null;
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, 10);
}

function getDateStrings() {
  const today = new Date();
  const todayString = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  return {
    todayString,
    yesterdayString: yesterday.toISOString().slice(0, 10),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: QuizSubmitBody;
  try {
    body = (await request.json()) as QuizSubmitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const quizId = typeof body.quizId === "string" ? body.quizId.trim() : "";
  const quizDate = parseDate(body.date) ?? new Date().toISOString().slice(0, 10);
  const answers = parseAnswers(body.answers);

  if (!answers) {
    return NextResponse.json({ error: "quizId or date, and answers are required." }, { status: 400 });
  }

  try {
    const gradedAnswers = await withPlannerDbClient(async (client) => {
      await client.query("BEGIN");

      const quizSessionResult = quizId
        ? await client.query<QuizSessionRow>(
            `
              SELECT id::text AS id, user_id::text AS user_id, completed
              FROM quiz_sessions
              WHERE id = $1
              LIMIT 1
            `,
            [quizId]
          )
        : await client.query<QuizSessionRow>(
            `
              SELECT id::text AS id, user_id::text AS user_id, completed
              FROM quiz_sessions
              WHERE user_id = $1
                AND quiz_date = $2::date
              LIMIT 1
            `,
            [userId, quizDate]
          );

      let quizSession = quizSessionResult.rows[0];

      if (!quizSession && !quizId) {
        const created = await client.query<QuizSessionRow>(
          `
            INSERT INTO quiz_sessions (user_id, quiz_date)
            VALUES ($1, $2::date)
            ON CONFLICT (user_id, quiz_date)
            DO UPDATE SET quiz_date = EXCLUDED.quiz_date
            RETURNING id::text AS id, user_id::text AS user_id, completed
          `,
          [userId, quizDate]
        );
        quizSession = created.rows[0];
      }

      if (!quizSession || quizSession.user_id !== userId) {
        await client.query("ROLLBACK");
        return { type: "not_found" as const };
      }

      if (quizSession.completed) {
        await client.query("ROLLBACK");
        return { type: "already_completed" as const };
      }

      const uniqueQuestionIds = Array.from(new Set(answers.map((item) => item.questionId)));
      const questionResult = await client.query<QuestionRow>(
        `
          SELECT id::text AS id, question_text, answer, subject
          FROM questions
          WHERE id = ANY($1::uuid[])
        `,
        [uniqueQuestionIds]
      );

      const questionsById = new Map(questionResult.rows.map((row) => [row.id, row]));
      const graded = answers.flatMap((item) => {
        const question = questionsById.get(item.questionId);
        if (!question) return [];
        const correct = normalizeAnswer(item.answer) === normalizeAnswer(question.answer);
        return [
          {
            questionId: item.questionId,
            answer: item.answer,
            correct,
            correctAnswer: question.answer,
            questionText: question.question_text,
            subject: question.subject,
          },
        ];
      });

      const resolvedQuizId = quizSession.id;
      await client.query("DELETE FROM quiz_answers WHERE quiz_session_id = $1", [resolvedQuizId]);

      for (const item of graded) {
        await client.query(
          `
            INSERT INTO quiz_answers (
              quiz_session_id,
              question_id,
              question_text,
              correct_answer,
              student_answer,
              is_correct
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [resolvedQuizId, item.questionId, item.questionText, item.correctAnswer, item.answer, item.correct]
        );

        if (!item.correct) {
          await client.query(
            `
              INSERT INTO weakness_signals (
                user_id,
                subject,
                topic_text,
                signal_type,
                score
              )
              VALUES ($1, $2, $3, 'wrong_answer', 0.3)
            `,
            [userId, item.subject, item.questionText]
          );
        }
      }

      const questionsCorrect = graded.filter((item) => item.correct).length;
      const scorePercent = graded.length > 0 ? (questionsCorrect / graded.length) * 100 : 0;

      await client.query(
        `
          UPDATE quiz_sessions
          SET completed = TRUE,
              questions_total = $2,
              questions_correct = $3,
              score_percent = $4,
              completed_at = NOW()
          WHERE id = $1
        `,
        [quizId, graded.length, questionsCorrect, scorePercent]
      );

      // Award XP: 100 XP for completion + 20 XP per correct answer
      const xpAmount = 100 + questionsCorrect * 20;
      await client.query(
        `INSERT INTO user_xp_ledger (user_id, amount, action_type, metadata) VALUES ($1, $2, $3, $4)`,
        [
          userId,
          xpAmount,
          "QUIZ_COMPLETE",
          JSON.stringify({ quizId: resolvedQuizId, questionsCorrect, questionsTotal: graded.length }),
        ]
      );

      await client.query("COMMIT");
      return {
        type: "graded" as const,
        quizId: resolvedQuizId,
        graded,
        questionsCorrect,
        scorePercent,
      };
    });

    if (gradedAnswers.type === "not_found") {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }

    if (gradedAnswers.type === "already_completed") {
      return NextResponse.json({ error: "Quiz already submitted." }, { status: 409 });
    }

    const preferences = await getUserAppPreferences(userId);
    const streakState = readDailyQuizState(preferences);
    const { todayString, yesterdayString } = getDateStrings();

    let newStreak = 1;
    let streakBroken = false;

    if (streakState.lastActiveDate === todayString) {
      newStreak = Math.max(1, streakState.currentStreak);
    } else if (streakState.lastActiveDate === yesterdayString) {
      newStreak = Math.max(1, streakState.currentStreak + 1);
    } else {
      newStreak = 1;
      streakBroken = Boolean(streakState.lastActiveDate && streakState.currentStreak > 0);
    }

    const longestStreak = Math.max(streakState.longestStreak, newStreak);

    await patchUserAppPreferences(userId, {
      dailyQuiz: {
        currentStreak: newStreak,
        longestStreak,
        lastActiveDate: todayString,
      },
    });

    // Scholar Credits (best-effort, non-blocking): the daily quiz is already
    // idempotent per (user, quiz_date), so these keys can never double-earn.
    await awardScholarCredits(request, {
      source: "DAILY_QUIZ_COMPLETE",
      venture: "SCHOOL",
      description: "Daily quiz completed",
      idempotencyKey: `daily-quiz:${userId}:${quizDate}`,
      referenceId: gradedAnswers.quizId,
      referenceType: "quiz_session",
      metadata: { score: gradedAnswers.scorePercent, correct: gradedAnswers.questionsCorrect },
    });
    if (newStreak >= 2) {
      await awardScholarCredits(request, {
        source: "DAILY_QUIZ_STREAK",
        venture: "SCHOOL",
        description: "Daily quiz streak",
        idempotencyKey: `daily-quiz-streak:${userId}:${quizDate}`,
        referenceId: gradedAnswers.quizId,
        referenceType: "quiz_session",
        metadata: { streak: newStreak },
      });
    }

    let learningCapture: { sessionId: string; artifactId: string } | null = null;
    try {
      learningCapture = await captureLearningSession({
        userId,
        kind: "daily_quiz",
        title: `Daily Quiz · ${quizDate}`,
        sourceType: "quiz_session",
        sourceId: gradedAnswers.quizId,
        takeaways: [
          `Scored ${Math.round(gradedAnswers.scorePercent)}% (${gradedAnswers.questionsCorrect}/${gradedAnswers.graded.length} correct).`,
          gradedAnswers.graded.filter((item) => !item.correct).length > 0
            ? `${gradedAnswers.graded.filter((item) => !item.correct).length} question${gradedAnswers.graded.filter((item) => !item.correct).length === 1 ? "" : "s"} created a recovery signal.`
            : "Every submitted answer was correct in this session.",
        ],
        nextAction: gradedAnswers.graded.some((item) => !item.correct) ? "Review the missed concepts before tomorrow's quiz." : "Keep the streak alive with tomorrow's quiz.",
        evidence: [{ type: "daily_quiz", label: `${Math.round(gradedAnswers.scorePercent)}% daily quiz result` }],
      });
    } catch {
      // Learning capture is best-effort; the completed quiz must still return.
    }

    return NextResponse.json({
      quizId: gradedAnswers.quizId,
      score: gradedAnswers.questionsCorrect,
      scorePercent: gradedAnswers.scorePercent,
      answers: gradedAnswers.graded.map((item) => ({
        questionId: item.questionId,
        correct: item.correct,
        correctAnswer: item.correctAnswer,
      })),
      newStreak,
      streakBroken,
      learningCapture,
    });
  } catch (error) {
    if (isSchemaUnavailable(error)) {
      return NextResponse.json(
        { error: "Daily quiz is unavailable until the new quiz tables are migrated." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to submit the quiz." }, { status: 500 });
  }
}
