"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { GuestPrompt } from "@/components/ui/GuestPrompt";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { StateCard } from "@/components/ui/StateCard";
import { useSession } from "@/components/SessionProvider";

type QuizQuestion = {
  id: string;
  question_text: string;
  difficulty: number;
  subject: string;
};

type DailyQuizCompletedResponse = {
  completed: true;
  score: number;
  streak: number;
};

type DailyQuizReadyResponse = {
  completed?: false;
  quizId: string;
  questions: QuizQuestion[];
  weaknessSubjects: string[];
  streak: number;
};

type DailyQuizResponse = DailyQuizCompletedResponse | DailyQuizReadyResponse;

type QuizSubmitResponse = {
  score: number;
  scorePercent: number;
  answers: Array<{
    questionId: string;
    correct: boolean;
    correctAnswer: string;
    explanation?: string;
  }>;
  newStreak: number;
  streakBroken: boolean;
};

function isCompletedResponse(value: DailyQuizResponse | null): value is DailyQuizCompletedResponse {
  return Boolean(value && "completed" in value && value.completed);
}

function isReadyResponse(value: DailyQuizResponse | null): value is DailyQuizReadyResponse {
  return Boolean(value && "quizId" in value && Array.isArray(value.questions));
}

function getSubjectTone(subject: string) {
  const key = subject.toLowerCase();
  if (key.includes("math")) {
    return { background: "var(--gold-dim)", border: "var(--gold-border)", color: "var(--gold)" };
  }
  if (key.includes("science") || key.includes("physics") || key.includes("chem")) {
    return { background: "var(--green-dim)", border: "rgba(16, 185, 129, 0.22)", color: "var(--green)" };
  }
  if (key.includes("history") || key.includes("geo")) {
    return { background: "var(--amber-dim)", border: "rgba(245, 158, 11, 0.22)", color: "var(--amber)" };
  }
  return { background: "var(--surface-3)", border: "var(--border)", color: "var(--text-2)" };
}

export default function DailyQuizPage() {
  const t = useTranslations("quiz");
  const { authState } = useSession();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DailyQuizResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<QuizSubmitResponse | null>(null);

  useEffect(() => {
    if (authState.isGuest) return;

    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/quiz/daily", {
          credentials: "include",
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as DailyQuizResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || t("errorLoadQuiz"));
        }
        if (active) {
          setData(payload);
          setCurrentIndex(0);
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : t("errorLoadQuiz"));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [authState.isGuest]);

  const questions = isReadyResponse(data) ? data.questions : [];
  const currentQuestion = questions[currentIndex] ?? null;
  const answeredCount = useMemo(
    () => questions.filter((question) => (answers[question.id] ?? "").trim().length > 0).length,
    [answers, questions]
  );
  const progressPercent = questions.length > 0 ? ((currentIndex + (results ? questions.length : 1)) / questions.length) * 100 : 0;

  if (authState.isGuest) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px" }}>
        <GuestPrompt reason="take the daily quiz and track your streak" />
      </div>
    );
  }

  const handleNext = () => {
    if (!currentQuestion) return;
    const currentAnswer = (answers[currentQuestion.id] ?? "").trim();
    if (!currentAnswer) {
      setError(t("errorAddAnswer"));
      return;
    }
    setError(null);
    setCurrentIndex((index) => Math.min(index + 1, questions.length - 1));
  };

  const handleSubmit = async () => {
    if (!isReadyResponse(data)) return;

    const payloadAnswers = data.questions.map((question) => ({
      questionId: question.id,
      answer: answers[question.id] ?? "",
    }));

    if (payloadAnswers.some((item) => item.answer.trim().length === 0)) {
      setError(t("errorAnswerAll"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: data.quizId,
          answers: payloadAnswers,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as QuizSubmitResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || t("errorSubmitQuiz"));
      }

      setResults(payload);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("errorSubmitQuiz"));
    } finally {
      setSubmitting(false);
    }
  };

  if (authState.isGuest) {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: "0 24px" }}>
        <GuestPrompt reason="take the daily quiz and track your streak" />
      </div>
    );
  }

  return (
    <div
      className="animate-fade-up"
      style={{
        maxWidth: "860px",
        margin: "0 auto",
        display: "grid",
        gap: "24px",
      }}
    >
      <RouteHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            borderRadius: "999px",
            border: "1px solid var(--gold-border)",
            background: "var(--gold-dim)",
            color: "var(--gold)",
            padding: "6px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 600,
            height: "fit-content",
          }}
        >
          <span>🔥</span>
          <span>
            {t("dayStreak", { count: results?.newStreak ?? (isCompletedResponse(data) ? data.streak : isReadyResponse(data) ? data.streak : 0) })}
          </span>
        </div>
      </RouteHeader>

      {loading ? (
        <StateCard title={t("loadingTitle")} description={t("loadingDescription")} />
      ) : error ? (
        <div className="assistant-error">{error}</div>
      ) : isCompletedResponse(data) ? (
        <section
          className="glass"
          style={{
            display: "grid",
            gap: "18px",
            padding: "32px",
            justifyItems: "center",
            textAlign: "center",
          }}
        >
          <strong style={{ fontFamily: "var(--font-mono)", fontSize: "48px", color: "var(--gold)" }}>
            {Math.round(data.score)}%
          </strong>
          <div style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: "var(--text-1)", fontWeight: 700 }}>{t("todaysScore")}</span>
            <span className="text-muted">{t("completedDescription")}</span>
          </div>
          <Link href="/dashboard">
            <Button variant="outline">{t("backToDashboard")}</Button>
          </Link>
        </section>
      ) : results && isReadyResponse(data) ? (
        <section style={{ display: "grid", gap: "20px" }}>
          <div
            className="glass"
            style={{
              display: "grid",
              gap: "16px",
              padding: "28px",
              justifyItems: "center",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "120px",
                height: "120px",
                borderRadius: "999px",
                border: "1px solid var(--gold-border)",
                background: "var(--gold-dim)",
                color: "var(--gold)",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: "34px",
                fontWeight: 700,
              }}
            >
              {results.score}
            </div>
            <div style={{ display: "grid", gap: "6px" }}>
              <strong style={{ color: "var(--text-1)", fontSize: "22px", fontFamily: "var(--font-display)" }}>
                {Math.round(results.scorePercent)}%
              </strong>
              <span className="text-muted">
                {results.streakBroken ? t("streakRestarted") : t("streakContinues")}
              </span>
            </div>
          </div>

          <section className="glass" style={{ display: "grid", gap: "14px", padding: "24px" }}>
            {data.questions.map((question, index) => {
              const result = results.answers.find((item) => item.questionId === question.id);
              return (
                <article
                  key={question.id}
                  style={{
                    display: "grid",
                    gap: "8px",
                    padding: "16px",
                    borderRadius: "var(--r-lg)",
                    border: result?.correct
                      ? "1px solid rgba(16, 185, 129, 0.24)"
                      : "1px solid rgba(239, 68, 68, 0.24)",
                    background: result?.correct ? "var(--green-dim)" : "var(--red-dim)",
                  }}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--gold)" }}>
                    {t("questionLabel", { number: index + 1 })}
                  </span>
                  <strong style={{ color: "var(--text-1)" }}>{question.question_text}</strong>
                  <span style={{ color: result?.correct ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
                    {result?.correct ? t("correct") : t("incorrect")}
                  </span>
                  {!result?.correct ? (
                    <span className="text-muted">{t("correctAnswer", { answer: result?.correctAnswer ?? "" })}</span>
                  ) : null}
                </article>
              );
            })}
          </section>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/dashboard">
              <Button variant="gold">{t("backToDashboard")}</Button>
            </Link>
          </div>
        </section>
      ) : isReadyResponse(data) && currentQuestion ? (
        <section style={{ display: "grid", gap: "18px" }}>
          <div
            style={{
              width: "100%",
              height: "10px",
              borderRadius: "999px",
              background: "var(--surface-2)",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                display: "block",
                width: `${progressPercent}%`,
                height: "100%",
                background: "var(--gold)",
              }}
            />
          </div>

          <article
            className="glass"
            style={{
              display: "grid",
              gap: "18px",
              padding: "28px",
              borderRadius: "var(--r-xl)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--gold)" }}>
                {t("questionOf", { current: currentIndex + 1, total: questions.length })}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 10px",
                  borderRadius: "999px",
                  border: `1px solid ${getSubjectTone(currentQuestion.subject).border}`,
                  background: getSubjectTone(currentQuestion.subject).background,
                  color: getSubjectTone(currentQuestion.subject).color,
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {currentQuestion.subject}
              </span>
            </div>

            <strong style={{ fontSize: "16px", color: "var(--text-1)" }}>{currentQuestion.question_text}</strong>

            <textarea
              value={answers[currentQuestion.id] ?? ""}
              onChange={(event) =>
                setAnswers((current) => ({
                  ...current,
                  [currentQuestion.id]: event.target.value,
                }))
              }
              placeholder={t("answerPlaceholder")}
              style={{
                minHeight: "112px",
                width: "100%",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <span className="text-muted">{t("answeredCount", { answered: answeredCount, total: questions.length })}</span>
              {currentIndex < questions.length - 1 ? (
                <Button variant="gold" onClick={handleNext}>
                  {t("nextQuestion")}
                </Button>
              ) : (
                <Button variant="gold" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? t("submitting") : t("submitQuiz")}
                </Button>
              )}
            </div>
          </article>
        </section>
      ) : (
        <StateCard icon="?" title={t("noQuizTitle")} description={t("noQuizDescription")} />
      )}
    </div>
  );
}
