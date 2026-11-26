import { NextRequest, NextResponse } from "next/server";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";
import { withPlannerDbClient } from "@/lib/server/plannerDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type QuestionRow = {
  id: string;
  question_text: string;
  answer: string;
  subject: string;
  difficulty: number;
};

type ExamDashQuestion = {
  id: string;
  question: string;
  subject: string;
  difficulty: number;
  options: string[];
  correctIndex: number;
};

const FALLBACK_QUESTIONS: ExamDashQuestion[] = [
  {
    id: "f1", question: "What is the powerhouse of the cell?", subject: "Life Sciences",
    difficulty: 2, options: ["Nucleus", "Mitochondria", "Ribosome", "Golgi Body"], correctIndex: 1,
  },
  {
    id: "f2", question: "What is Newton's Second Law of Motion?", subject: "Physical Sciences",
    difficulty: 3, options: ["F = ma", "E = mc²", "v = u + at", "p = mv"], correctIndex: 0,
  },
  {
    id: "f3", question: "What is the chemical formula for water?", subject: "Physical Sciences",
    difficulty: 1, options: ["CO₂", "NaCl", "H₂O", "O₂"], correctIndex: 2,
  },
  {
    id: "f4", question: "What type of bond forms between two non-metal atoms?", subject: "Physical Sciences",
    difficulty: 3, options: ["Ionic bond", "Metallic bond", "Covalent bond", "Hydrogen bond"], correctIndex: 2,
  },
  {
    id: "f5", question: "Which organ produces insulin?", subject: "Life Sciences",
    difficulty: 2, options: ["Liver", "Pancreas", "Kidney", "Spleen"], correctIndex: 1,
  },
  {
    id: "f6", question: "In mathematics, what does 'perpendicular' mean?", subject: "Mathematics",
    difficulty: 2, options: ["Parallel lines", "Lines at 90°", "Lines at 45°", "Equal length lines"], correctIndex: 1,
  },
  {
    id: "f7", question: "What is the derivative of x²?", subject: "Mathematics",
    difficulty: 3, options: ["x", "2x", "x²", "2"], correctIndex: 1,
  },
  {
    id: "f8", question: "What year did World War II end?", subject: "History",
    difficulty: 2, options: ["1943", "1944", "1945", "1946"], correctIndex: 2,
  },
  {
    id: "f9", question: "What is GDP an abbreviation for?", subject: "Economics",
    difficulty: 2,
    options: ["Gross Domestic Product", "General Data Protocol", "Global Distribution Plan", "Gross Development Pay"],
    correctIndex: 0,
  },
  {
    id: "f10", question: "Which planet is closest to the Sun?", subject: "Physical Sciences",
    difficulty: 1, options: ["Venus", "Earth", "Mars", "Mercury"], correctIndex: 3,
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMcq(question: QuestionRow, allAnswers: string[]): ExamDashQuestion {
  const correct = question.answer.trim();
  const pool = allAnswers.filter((a) => a.trim() !== correct);
  const distractors = shuffle(pool).slice(0, 3);

  while (distractors.length < 3) {
    distractors.push(`Option ${distractors.length + 2}`);
  }

  const options = shuffle([correct, ...distractors]);
  const correctIndex = options.indexOf(correct);

  return {
    id: question.id,
    question: question.question_text,
    subject: question.subject,
    difficulty: question.difficulty,
    options,
    correctIndex,
  };
}

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : null;

  const url = new URL(request.url);
  const subject = url.searchParams.get("subject")?.trim() || null;
  const count = Math.min(parseInt(url.searchParams.get("count") ?? "10", 10), 20);

  try {
    let subjectFilter = subject;
    let targetDifficulty: number | null = null;

    if (userId) {
      const prefs = await getUserAppPreferences(userId).catch(() => ({}));
      const state = readAcademicState(prefs);
      if (!subjectFilter && state.selectedSubjects.length > 0) {
        subjectFilter = state.selectedSubjects[Math.floor(Math.random() * state.selectedSubjects.length)];
      }

      // Dynamic Difficulty: Check recent performance
      const performance = await queryPlannerDb<{ avg_score: string }>(
        `SELECT AVG(score_percent)::text as avg_score FROM quiz_attempts_v2 WHERE learner_id = $1`,
        [userId]
      );
      const avg = parseFloat(performance.rows[0]?.avg_score ?? "0");
      if (avg >= 85) targetDifficulty = 4;
      else if (avg >= 70) targetDifficulty = 3;
      else if (avg >= 50) targetDifficulty = 2;
      else targetDifficulty = 1;
    }

    const subjectClause = subjectFilter ? `AND subject = $2` : "";
    const difficultyClause = targetDifficulty ? `AND (difficulty BETWEEN $3 AND $4)` : "";
    
    const params: unknown[] = [count * 3];
    if (subjectFilter) params.push(subjectFilter);
    if (targetDifficulty) {
      params.push(Math.max(1, targetDifficulty - 1));
      params.push(Math.min(5, targetDifficulty + 1));
    }

    const poolResult = await queryPlannerDb<QuestionRow>(
      `SELECT id::text AS id, question_text, answer, subject, difficulty
       FROM questions
       WHERE is_active = TRUE ${subjectClause} ${difficultyClause}
       ORDER BY RANDOM()
       LIMIT $1`,
      params
    );

    if (poolResult.rows.length < 4) {
      return NextResponse.json({ questions: shuffle(FALLBACK_QUESTIONS).slice(0, count) });
    }

    const allAnswers = poolResult.rows.map((r) => r.answer.trim());
    const selected = poolResult.rows.slice(0, count);
    const questions = selected.map((q) => buildMcq(q, allAnswers));

    return NextResponse.json({ questions });
  } catch {
    return NextResponse.json({ questions: shuffle(FALLBACK_QUESTIONS).slice(0, count) });
  }
}

type ScoreBody = {
  score?: unknown;
  total?: unknown;
  subject?: unknown;
};

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as ScoreBody;
  const score = typeof body.score === "number" ? body.score : 0;
  const total = typeof body.total === "number" ? body.total : 10;

  if (score <= 0) {
    return NextResponse.json({ creditsEarned: 0 });
  }

  const pct = score / total;
  // 5 credits minimum for finishing, bonus up to 20 for a perfect score
  const creditsEarned = pct >= 1 ? 20 : pct >= 0.8 ? 15 : pct >= 0.6 ? 10 : pct >= 0.4 ? 5 : 2;

  const key = `exam_dash_${userId}_${new Date().toISOString().slice(0, 10)}`;

  try {
    await withPlannerDbClient(async (client) => {
      const dup = await client.query(`SELECT id FROM wallet_ledger_entries WHERE idempotency_key = $1 LIMIT 1`, [key]);
      if (dup.rows[0]) return;
      await client.query(`INSERT INTO wallet_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
      await client.query(`UPDATE wallet_accounts SET balance_credits = balance_credits + $2 WHERE user_id = $1`, [userId, creditsEarned]);
      await client.query(
        `INSERT INTO wallet_ledger_entries (user_id, type, amount_credits, reason, ref_type, ref_id, idempotency_key)
         VALUES ($1, 'CREDIT', $2, $3, 'exam_dash', $4, $5)`,
        [userId, creditsEarned, `Exam Dash: ${score}/${total} correct`, userId, key]
      );
      // Award XP: 10 XP per correct answer
      await client.query(
        `INSERT INTO user_xp_ledger (user_id, amount, action_type, metadata) VALUES ($1, $2, $3, $4)`,
        [userId, score * 10, 'GAME_COMPLETE', JSON.stringify({ gameType: 'quiz_rush', score, total })]
      );
    });
  } catch {
    // non-critical
  }

  return NextResponse.json({ creditsEarned });
}
