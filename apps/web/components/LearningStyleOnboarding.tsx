"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import styles from "./LearningStyleOnboarding.module.css";

type LearningStyle = "visual" | "reading" | "kinesthetic" | "auditory";

const questions = [
  {
    id: "q1",
    text: "When learning something new, I prefer to...",
    options: [
      { label: "Watch videos or diagrams", value: "visual" },
      { label: "Read notes or textbooks", value: "reading" },
      { label: "Try it hands-on right away", value: "kinesthetic" },
      { label: "Listen to someone explain it", value: "auditory" },
    ],
  },
  {
    id: "q2",
    text: "To remember something important, I...",
    options: [
      { label: "Draw a diagram or mind map", value: "visual" },
      { label: "Write it out multiple times", value: "reading" },
      { label: "Act it out or build something", value: "kinesthetic" },
      { label: "Repeat it aloud", value: "auditory" },
    ],
  },
  {
    id: "q3",
    text: "I find it easiest to understand when...",
    options: [
      { label: "I see visual examples and charts", value: "visual" },
      { label: "I read a detailed explanation", value: "reading" },
      { label: "I can immediately practise it", value: "kinesthetic" },
      { label: "Someone talks me through it", value: "auditory" },
    ],
  },
  {
    id: "q4",
    text: "When I'm stuck on a problem, I...",
    options: [
      { label: "Look for a picture or example", value: "visual" },
      { label: "Re-read the instructions carefully", value: "reading" },
      { label: "Just start trying different things", value: "kinesthetic" },
      { label: "Ask someone to explain it", value: "auditory" },
    ],
  },
  {
    id: "q5",
    text: "After a lesson, I remember best what I...",
    options: [
      { label: "Saw on the board or in diagrams", value: "visual" },
      { label: "Read in my notes", value: "reading" },
      { label: "Practised or wrote out myself", value: "kinesthetic" },
      { label: "Heard the teacher say", value: "auditory" },
    ],
  },
] as const;

const styleDescriptions: Record<LearningStyle, string> = {
  visual: "Visual learner — we'll lead with diagrams, worked examples, and visual summaries.",
  reading: "Reading/writing learner — we'll prioritise detailed notes and written explanations.",
  kinesthetic: "Hands-on learner — we'll put practice problems and activities front and centre.",
  auditory: "Auditory learner — we'll highlight audio summaries and discussion opportunities.",
};

export function LearningStyleOnboarding() {
  const { session } = useSession();
  const [visible, setVisible] = useState(false);
  const [answers, setAnswers] = useState<Record<string, LearningStyle>>({});
  const [result, setResult] = useState<LearningStyle | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    // Check app_preferences for existing learning style
    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        const prefs = data?.profile?.appPreferences ?? {};
        if (!prefs.learningStyle) setVisible(true);
      })
      .catch(() => {});
  }, [session]);

  if (!visible) return null;

  const allAnswered = questions.every((q) => answers[q.id]);

  const computeResult = (): LearningStyle => {
    const counts: Record<LearningStyle, number> = { visual: 0, reading: 0, kinesthetic: 0, auditory: 0 };
    for (const v of Object.values(answers)) counts[v] += 1;
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) as LearningStyle;
  };

  const handleSubmit = async () => {
    if (!allAnswered || !session) return;
    const style = computeResult();
    setResult(style);
    setSaving(true);
    try {
      await fetch("/api/profile/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-csrf-token": session.csrfToken },
        body: JSON.stringify({ appPreferences: { learningStyle: style } }),
      });
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.emoji}>🎓</div>
          <h2 className={styles.title}>How do you learn best?</h2>
          <p className={styles.subtitle}>
            5 quick questions so we can personalise your lesson experience.
          </p>
        </div>

        {result ? (
          <div className={styles.result}>
            <div className={styles.resultBadge}>{result}</div>
            <p className={styles.resultDesc}>{styleDescriptions[result]}</p>
            <button className={styles.doneBtn} onClick={() => setVisible(false)}>
              Get started →
            </button>
          </div>
        ) : (
          <>
            <div className={styles.questions}>
              {questions.map((q) => (
                <div key={q.id} className={styles.qBlock}>
                  <p className={styles.qText}>{q.text}</p>
                  <div className={styles.qOptions}>
                    {q.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={styles.qOption}
                        data-selected={answers[q.id] === opt.value ? "true" : "false"}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.value as LearningStyle }))}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.footer}>
              <button className={styles.skipBtn} onClick={() => setVisible(false)}>
                Skip for now
              </button>
              <button
                className={styles.submitBtn}
                disabled={!allAnswered || saving}
                onClick={handleSubmit}
              >
                {saving ? "Saving…" : "See my style →"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
