"use client";

import { useEffect, useState } from "react";
import styles from "./NpsSurveyModal.module.css";

export function NpsSurveyModal() {
  const [show, setShow] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Check if dismissed in local storage first for immediate hiding
    if (localStorage.getItem("saedu_nps_dismissed") === "true") return;

    fetch("/api/feedback/check")
      .then(res => res.json())
      .then(d => {
        if (d.show) setShow(true);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = () => {
    if (score === null) return;
    fetch("/api/feedback/nps", {
      method: "POST",
      body: JSON.stringify({ score, comment }),
    }).then(() => {
      setSubmitted(true);
      setTimeout(() => setShow(false), 3000);
    });
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("saedu_nps_dismissed", "true");
  };

  if (!show) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {submitted ? (
          <div className={styles.success}>
            <h4>Thanks for your feedback! 🎉</h4>
            <p>Your input helps us build a better SCHOOL for everyone.</p>
          </div>
        ) : (
          <>
            <h3 className={styles.title}>How likely are you to recommend SCHOOL to a friend?</h3>
            <div className={styles.scores}>
              {Array.from({ length: 11 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.scoreBtn}
                  data-active={score === i}
                  onClick={() => setScore(i)}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className={styles.labels}>
              <span>Not likely</span>
              <span>Very likely</span>
            </div>
            <textarea
              className={styles.comment}
              placeholder="What made you choose this score? (Optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className={styles.actions}>
              <button type="button" className={styles.dismissBtn} onClick={dismiss}>Remind me later</button>
              <button type="button" className={styles.submitBtn} disabled={score === null} onClick={handleSubmit}>Submit Feedback</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
