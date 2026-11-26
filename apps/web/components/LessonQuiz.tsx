"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LessonContent } from "@saedu/shared";
import { API_BASE } from "@/lib/apiBase";
import { useSession } from "@/components/SessionProvider";

type QuizQuestion = LessonContent["quiz"]["questions"][number];
type Difficulty = "easy" | "medium" | "hard";

type LessonQuizMeta = {
  subject: string;
  grade: number;
  topicTag?: string;
  lessonKey: string;
};

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function keywordOverlap(answer: string, expected: string) {
  const answerTokens = new Set(normalize(answer).split(/\s+/).filter((token) => token.length > 3));
  const expectedTokens = normalize(expected).split(/\s+/).filter((token) => token.length > 3);
  return expectedTokens.some((token) => answerTokens.has(token));
}

function isCorrect(question: QuizQuestion, value: string) {
  if (question.type === "short_answer") {
    if (!value.trim()) return false;
    return keywordOverlap(value, question.answer);
  }
  return normalize(value) === normalize(question.answer);
}

type Bias = -1 | 0 | 1;

const biasDistribution: Record<Bias, Record<Difficulty, number>> = {
  0: { easy: 0.5, medium: 0.35, hard: 0.15 },
  1: { easy: 0.3, medium: 0.45, hard: 0.25 },
  "-1": { easy: 0.7, medium: 0.25, hard: 0.05 },
};

const difficultyLabel: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

function computeCounts(total: number, ratios: Record<Difficulty, number>) {
  const base = {
    easy: Math.floor(total * ratios.easy),
    medium: Math.floor(total * ratios.medium),
    hard: Math.floor(total * ratios.hard),
  };
  let remainder = total - (base.easy + base.medium + base.hard);
  const order: Difficulty[] = ["medium", "easy", "hard"];
  let index = 0;
  while (remainder > 0) {
    const key = order[index % order.length];
    base[key] += 1;
    remainder -= 1;
    index += 1;
  }
  return base;
}

function selectQuestions(questions: QuizQuestion[], bias: Bias) {
  const grouped: Record<Difficulty, QuizQuestion[]> = { easy: [], medium: [], hard: [] };
  questions.forEach((question) => {
    grouped[question.difficulty || "medium"].push(question);
  });

  const total = questions.length;
  const target = computeCounts(total, biasDistribution[bias]);
  const picked: QuizQuestion[] = [];
  const used = new Set<string>();

  const takeFrom = (difficulty: Difficulty, count: number) => {
    const items = grouped[difficulty];
    for (const item of items) {
      if (picked.length >= total || count <= 0) break;
      if (used.has(item.id)) continue;
      picked.push(item);
      used.add(item.id);
      count -= 1;
    }
    return count;
  };

  let remainingEasy = takeFrom("easy", target.easy);
  let remainingMedium = takeFrom("medium", target.medium);
  let remainingHard = takeFrom("hard", target.hard);

  const fallbackOrder: Difficulty[] =
    bias === 1 ? ["medium", "hard", "easy"] : bias === -1 ? ["easy", "medium", "hard"] : ["easy", "medium", "hard"];

  const fillRemaining = () => {
    for (const difficulty of fallbackOrder) {
      for (const item of grouped[difficulty]) {
        if (picked.length >= total) return;
        if (used.has(item.id)) continue;
        picked.push(item);
        used.add(item.id);
      }
    }
  };

  if (remainingEasy > 0 || remainingMedium > 0 || remainingHard > 0) {
    fillRemaining();
  }

  return picked.length ? picked : questions;
}

export function LessonQuiz({ quiz, meta }: { quiz: LessonContent["quiz"]; meta: LessonQuizMeta }) {
  const { session } = useSession();
  const apiBase = API_BASE;
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [bias, setBias] = useState<Bias>(0);
  const [selected, setSelected] = useState<QuizQuestion[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Struggle detection: per-question elapsed seconds
  const [questionTimers, setQuestionTimers] = useState<Record<string, number>>({});
  const [hintShown, setHintShown] = useState<Record<string, boolean>>({});
  const activeQuestionRef = useRef<string | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!session) {
      setBias(0);
      return;
    }
    const params = new URLSearchParams({
      subject: meta.subject,
      grade: String(meta.grade),
    });
    if (meta.topicTag) {
      params.set("topicTag", meta.topicTag);
    }
    fetch(`${apiBase}/lessons/quiz/bias?${params.toString()}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data.bias === "number") {
          setBias(data.bias as Bias);
        }
      })
      .catch(() => {
        // ignore bias fetch errors
      });
  }, [apiBase, meta.grade, meta.subject, meta.topicTag, session]);

  useEffect(() => {
    if (submitted || Object.keys(answers).length > 0) return;
    const next = selectQuestions(quiz.questions, bias);
    setSelected(next);
  }, [answers, bias, quiz.questions, submitted]);

  // Per-question timer — starts when user first interacts with a question
  const startQuestionTimer = (questionId: string) => {
    if (activeQuestionRef.current === questionId) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    activeQuestionRef.current = questionId;
    timerIntervalRef.current = setInterval(() => {
      setQuestionTimers((prev) => {
        const next = { ...prev, [questionId]: (prev[questionId] ?? 0) + 1 };
        if (next[questionId] === 45) {
          setHintShown((h) => ({ ...h, [questionId]: true }));
        }
        return next;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); }, []);

  const score = useMemo(() => {
    if (!submitted) return 0;
    return selected.reduce((total, question) => {
      const value = answers[question.id] ?? "";
      return total + (isCorrect(question, value) ? 1 : 0);
    }, 0);
  }, [answers, selected, submitted]);

  const total = selected.length;

  return (
    <div className="week-card">
      <h3>Quick Quiz</h3>
      {submitted && (
        <p className="badge">
          Score: {score} / {total}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const localScore = selected.reduce((totalScore, question) => {
            const value = answers[question.id] ?? "";
            return totalScore + (isCorrect(question, value) ? 1 : 0);
          }, 0);
          setSubmitted(true);
          if (!session || total === 0) return;
          const scorePercent = Math.round((localScore / total) * 100);
          const timeSpentSeconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0;
          fetch(`${apiBase}/lessons/quiz/attempt`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": session.csrfToken,
            },
            body: JSON.stringify({
              subject: meta.subject,
              grade: meta.grade,
              lessonKey: meta.lessonKey,
              topicTag: meta.topicTag,
              scorePercent,
              correctCount: localScore,
              totalCount: total,
            }),
          }).catch(() => {
            // ignore submission errors
          });
          fetch(`${apiBase}/analytics/quiz-attempt`, {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": session.csrfToken,
            },
            body: JSON.stringify({
              lessonKey: meta.lessonKey,
              subject: meta.subject,
              grade: meta.grade,
              scorePercent,
              timeSpentSeconds,
              answersJson: answers,
            }),
          }).catch(() => {
            // ignore
          });
        }}
      >
        {selected.map((question, index) => (
          <div key={question.id} className="list-item">
            <div className="quiz-question-heading">
              <strong>
                {index + 1}. {question.prompt}
              </strong>
              <span className="quiz-difficulty">{difficultyLabel[question.difficulty]}</span>
            </div>
            {hintShown[question.id] && !submitted && (
              <div className="badge" style={{ borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.07)", color: "var(--amber)" }}>
                💡 Hint: {question.explanation.split(".")[0]}.
              </div>
            )}
            {question.type === "mcq" && (
              <div className="list">
                {question.options?.map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      disabled={submitted}
                      checked={(answers[question.id] ?? "") === option}
                      onChange={(event) =>
                        setAnswers((current) => {
                          if (!startedAt) setStartedAt(Date.now());
                          startQuestionTimer(question.id);
                          return { ...current, [question.id]: event.target.value };
                        })
                      }
                    />
                    {" "}{option}
                  </label>
                ))}
              </div>
            )}
            {question.type === "true_false" && (
              <div className="list">
                {["true", "false"].map((option) => (
                  <label key={option}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      disabled={submitted}
                      checked={(answers[question.id] ?? "") === option}
                      onChange={(event) =>
                        setAnswers((current) => {
                          if (!startedAt) setStartedAt(Date.now());
                          startQuestionTimer(question.id);
                          return { ...current, [question.id]: event.target.value };
                        })
                      }
                    />
                    {" "}{option === "true" ? "True" : "False"}
                  </label>
                ))}
              </div>
            )}
            {question.type === "short_answer" && (
              <div>
                <textarea
                  rows={3}
                  value={answers[question.id] ?? ""}
                  disabled={submitted}
                  onChange={(event) =>
                    setAnswers((current) => {
                      if (!startedAt) setStartedAt(Date.now());
                      startQuestionTimer(question.id);
                      return { ...current, [question.id]: event.target.value };
                    })
                  }
                />
              </div>
            )}
            {submitted && (
              <div className="badge">
                Answer: {question.answer}
                <br />
                Explanation: {question.explanation}
              </div>
            )}
          </div>
        ))}

        <div className="outline-actions">
          <button type="submit" disabled={submitted}>
            Submit quiz
          </button>
        </div>
      </form>
    </div>
  );
}
