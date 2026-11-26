"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { ActionCluster } from "@/components/ui/ActionCluster";

type DailyQuizResponse =
  | {
      completed: true;
      score: number;
      streak: number;
    }
  | {
      completed?: false;
      quizId: string;
      questions: Array<{
        id: string;
        question_text: string;
        difficulty: number;
        subject: string;
      }>;
      weaknessSubjects: string[];
      streak: number;
    };

export function DailyQuizCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DailyQuizResponse | null>(null);

  useEffect(() => {
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
          throw new Error(payload.error || "Unable to load today's quiz.");
        }
        if (active) {
          setData(payload);
        }
      } catch (fetchError) {
        if (active) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load today's quiz.");
          setData(null);
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
  }, []);

  return (
    <SectionCard
      className="glass animate-fade-up"
      title={`Daily Quiz ${data?.completed ? "Complete" : "Ready"}`}
      description={
        loading
          ? "Loading today's questions."
          : data?.completed
            ? "You've finished today's quiz. Your streak is safe."
            : "Five questions, tuned to your weakest topics."
      }
      actions={
        <ActionCluster>
          <span className="ui-badge ui-badge--gold">🔥 {data?.streak ?? 0} day streak</span>
        </ActionCluster>
      }
    >

      {loading ? (
        <div
          style={{
            display: "grid",
            gap: "12px",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              style={{
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                minHeight: "96px",
                opacity: 0.55,
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="assistant-error">{error}</div>
      ) : data?.completed ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <strong style={{ fontFamily: "var(--font-mono)", fontSize: "28px", color: "var(--gold)" }}>
              {Math.round(data.score)}%
            </strong>
            <span className="text-muted">See you tomorrow for the next streak check-in.</span>
          </div>
          <Link href="/daily-quiz">
            <Button variant="outline">Review Quiz</Button>
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "grid", gap: "6px" }}>
            <strong style={{ color: "var(--text-1)" }}>Daily Quiz Ready</strong>
            <span className="text-muted">Targeting: {data?.weaknessSubjects?.[0] || "mixed revision"}</span>
          </div>
          <Link href="/daily-quiz">
            <Button variant="gold">Start Quiz</Button>
          </Link>
        </div>
      )}
    </SectionCard>
  );
}

export default DailyQuizCard;
