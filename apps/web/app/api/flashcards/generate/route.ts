import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { readGeneratedLesson } from "@saedu/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await request.json();
  const { lessonKey, phase, grade, subjectKey, term, week } = body;

  if (!lessonKey) {
    return NextResponse.json({ error: "Missing lessonKey" }, { status: 400 });
  }

  try {
    // 1. Read lesson content
    const lesson = readGeneratedLesson({
      phase,
      grade: Number(grade),
      subjectKey,
      term: Number(term),
      week: Number(week),
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // 2. Extract flashcards from quiz questions
    const cards = lesson.quiz.questions.map((q) => ({
      question: q.prompt,
      answer: q.answer,
      explanation: q.explanation,
    }));

    // 3. Save to DB
    await queryPlannerDb(
      `
        INSERT INTO user_flashcard_decks (user_id, lesson_key, cards)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, lesson_key) DO UPDATE SET
          cards = EXCLUDED.cards,
          updated_at = NOW()
      `,
      [userId, lessonKey, JSON.stringify(cards)]
    );

    return NextResponse.json({ success: true, count: cards.length });
  } catch (error) {
    console.error("Failed to generate flashcards:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
