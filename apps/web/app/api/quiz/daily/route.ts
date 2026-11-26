import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { getUserAppPreferences, readAcademicState, readDailyQuizState } from "@/lib/server/userProfileState";

type QuizSessionRow = {
  id: string;
  score_percent: number | null;
};

type QuestionRow = {
  id: string;
  question_text: string;
  difficulty: number;
  subject: string;
};

function isSchemaUnavailable(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "42P01" || code === "42703";
}

function normalizeQuestionRows(rows: QuestionRow[]) {
  return rows.map((row) => ({
    id: row.id,
    question_text: row.question_text,
    difficulty: Number(row.difficulty ?? 3),
    subject: row.subject,
  }));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const preferences = await getUserAppPreferences(userId);
    const academicState = readAcademicState(preferences);
    const streakState = readDailyQuizState(preferences);
    const userGrade = academicState.grade;

    const completedResult = await queryPlannerDb<QuizSessionRow>(
      `
        SELECT id::text AS id, score_percent
        FROM quiz_sessions
        WHERE user_id = $1
          AND quiz_date = CURRENT_DATE
          AND completed = TRUE
        LIMIT 1
      `,
      [userId]
    );

    if ((completedResult.rowCount ?? 0) > 0) {
      const row = completedResult.rows[0];
      return NextResponse.json({
        completed: true,
        date: todayString(),
        score: Number(row.score_percent ?? 0),
        streak: streakState.currentStreak,
        quizId: row.id,
      });
    }

    const openSessionResult = await queryPlannerDb<QuizSessionRow>(
      `
        SELECT id::text AS id, score_percent
        FROM quiz_sessions
        WHERE user_id = $1
          AND quiz_date = CURRENT_DATE
        LIMIT 1
      `,
      [userId]
    );

    let quizId = openSessionResult.rows[0]?.id ?? "";
    if (!quizId) {
      const created = await queryPlannerDb<QuizSessionRow>(
        `
          INSERT INTO quiz_sessions (user_id, quiz_date)
          VALUES ($1, CURRENT_DATE)
          ON CONFLICT (user_id, quiz_date)
          DO UPDATE SET quiz_date = EXCLUDED.quiz_date
          RETURNING id::text AS id, score_percent
        `,
        [userId]
      );
      quizId = created.rows[0]?.id ?? "";
    }

    const weaknessSubjectsResult = await queryPlannerDb<{ subject: string; signal_count: string }>(
      `
        SELECT subject, COUNT(*)::text AS signal_count
        FROM weakness_signals
        WHERE user_id = $1
          AND recorded_at > NOW() - INTERVAL '30 days'
        GROUP BY subject
        ORDER BY COUNT(*) DESC, subject ASC
        LIMIT 3
      `,
      [userId]
    );

    const weaknessSubjects = weaknessSubjectsResult.rows.map((row) => row.subject);

    let questions: QuestionRow[] = [];
    const usedIds = new Set<string>();

    if (weaknessSubjects.length > 0) {
      const weaknessQuestions = await queryPlannerDb<QuestionRow>(
        `
          SELECT id::text AS id, question_text, difficulty, subject
          FROM questions
          WHERE subject = ANY($1::text[])
            AND is_active = TRUE
            AND difficulty BETWEEN 2 AND 4
            AND ($2::int IS NULL OR grade = $2)
          ORDER BY RANDOM()
          LIMIT 5
        `,
        [weaknessSubjects, userGrade]
      );

      questions = weaknessQuestions.rows;
      for (const row of questions) {
        usedIds.add(row.id);
      }
    }

    if (questions.length < 5) {
      const remaining = 5 - questions.length;
      const filler = await queryPlannerDb<QuestionRow>(
        `
          SELECT id::text AS id, question_text, difficulty, subject
          FROM questions
          WHERE is_active = TRUE
            AND difficulty BETWEEN 2 AND 4
            AND ($1::int IS NULL OR grade = $1)
            AND (cardinality($2::uuid[]) = 0 OR NOT (id = ANY($2::uuid[])))
          ORDER BY RANDOM()
          LIMIT $3
        `,
        [userGrade, Array.from(usedIds), remaining]
      );
      questions = [...questions, ...filler.rows];
    }

    await queryPlannerDb(
      `
        UPDATE quiz_sessions
        SET questions_total = $2
        WHERE id = $1
      `,
      [quizId, questions.length]
    );

    return NextResponse.json({
      completed: false,
      date: todayString(),
      quizId,
      questions: normalizeQuestionRows(questions),
      weaknessSubjects,
      streak: streakState.currentStreak,
    });
  } catch (error) {
    if (isSchemaUnavailable(error)) {
      return NextResponse.json(
        { error: "Daily quiz is unavailable until the new quiz tables are migrated." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Unable to load the daily quiz." }, { status: 500 });
  }
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}
