"use client";

import { Document, Page, pdfjs } from "react-pdf";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NextBestActionCard } from "@/components/NextBestActionCard";
import { TargetedRetryCard } from "@/components/TargetedRetryCard";
import { useSession } from "@/components/SessionProvider";
import { buildTargetedRetrySet } from "@/lib/pastPapers/targetedRetry";

type PastPaperQuestion = {
  id: string;
  qNumber: string;
  label: string;
  maxMarks: number | null;
  section?: string | null;
  topicTags?: string | null;
  orderIndex: number;
};

type PastPaperAnswer = {
  questionId: string;
  answerText: string;
  notes: string;
  autoScore?: number | null;
  reviewerScore?: number | null;
  maxMarks?: number | null;
  feedback?: string | null;
};

type PastPaperInfo = {
  id: string;
  title: string;
  paperNumber: string;
  language: string;
  province: string;
  grade: number;
  subject: string;
  year: number;
  session: string;
  paperUrlOriginal?: string | null;
  memoUrlOriginal?: string | null;
};

type PastPapersLiveClientProps = {
  attemptId: string;
  classId: string;
  paper: PastPaperInfo;
  questions: PastPaperQuestion[];
  initialAnswers: PastPaperAnswer[];
  paperUrl: string | null;
  memoUrl: string | null;
  attemptStatus: string;
  totalScore: number | null;
  totalMax: number | null;
  analytics: Record<string, any>;
  detailedReportUnlocked: boolean;
  detailedReportCreditCost: number;
};

const EMPTY_PER_QUESTION: Record<string, any> = {};

function formatSignedPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  const rounded = value.toFixed(2);
  return value > 0 ? `+${rounded}%` : `${rounded}%`;
}

export function PastPapersLiveClient({
  attemptId,
  classId,
  paper,
  questions,
  initialAnswers,
  paperUrl,
  memoUrl,
  attemptStatus,
  totalScore,
  totalMax,
  analytics,
  detailedReportUnlocked,
  detailedReportCreditCost,
}: PastPapersLiveClientProps) {
  const router = useRouter();
  const { session } = useSession();
  const pathname = usePathname();
  const currentSearchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pageWidth, setPageWidth] = useState(520);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [unlockStatus, setUnlockStatus] = useState<string | null>(null);
  const [unlockingDetailedReport, setUnlockingDetailedReport] = useState(false);
  const [detailedUnlocked, setDetailedUnlocked] = useState(detailedReportUnlocked);
  const [newQuestionLabel, setNewQuestionLabel] = useState("");
  const [reviewInputs, setReviewInputs] = useState<Record<string, { score: string; feedback: string }>>(() => {
    const map: Record<string, { score: string; feedback: string }> = {};
    for (const answer of initialAnswers) {
      map[answer.questionId] = {
        score: answer.reviewerScore != null ? String(answer.reviewerScore) : "",
        feedback: answer.feedback || "",
      };
    }
    return map;
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const answersRef = useRef<Record<string, { answerText: string; notes: string }>>({});
  const dirtyRef = useRef(false);
  const pendingTimeRef = useRef<Record<string, number>>({});
  const activeQuestionRef = useRef<{ id: string | null; startedAt: number | null }>({ id: null, startedAt: null });
  const initialAnswerMap = useMemo(() => {
    const map: Record<string, PastPaperAnswer> = {};
    for (const answer of initialAnswers) {
      map[answer.questionId] = answer;
    }
    return map;
  }, [initialAnswers]);

  const [answers, setAnswers] = useState<Record<string, { answerText: string; notes: string }>>(() => {
    const map: Record<string, { answerText: string; notes: string }> = {};
    for (const answer of initialAnswers) {
      map[answer.questionId] = { answerText: answer.answerText || "", notes: answer.notes || "" };
    }
    return map;
  });

  useEffect(() => {
    setDetailedUnlocked(detailedReportUnlocked);
  }, [detailedReportUnlocked]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    setMounted(true);
    try {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.getBoundingClientRect().width;
      setPageWidth(Math.max(320, Math.min(820, Math.floor(width))));
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const formatGrade = (grade: number) => (grade === 0 ? "R" : String(grade));

  const markFocus = (questionId: string) => {
    activeQuestionRef.current = { id: questionId, startedAt: Date.now() };
  };

  const markBlur = (questionId: string) => {
    const active = activeQuestionRef.current;
    if (!active.startedAt || active.id !== questionId) return;
    const seconds = Math.max(1, Math.round((Date.now() - active.startedAt) / 1000));
    pendingTimeRef.current[questionId] = (pendingTimeRef.current[questionId] || 0) + seconds;
    activeQuestionRef.current = { id: null, startedAt: null };
  };

  const updateAnswer = (questionId: string, field: "answerText" | "notes", value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], [field]: value },
    }));
    dirtyRef.current = true;
  };

  const saveAnswers = useCallback(
    async (force: boolean) => {
      if (attemptStatus !== "in_progress") return;
      const hasTime = Object.keys(pendingTimeRef.current).length > 0;
      if (!dirtyRef.current && !hasTime && !force) return;
      setSaveStatus("Saving...");
      const payload = questions.map((question) => {
        const answer = answersRef.current[question.id] || { answerText: "", notes: "" };
        const timeSpent = pendingTimeRef.current[question.id];
        const item: { questionId: string; answerText: string; notes: string; timeSpentSeconds?: number } = {
          questionId: question.id,
          answerText: answer.answerText || "",
          notes: answer.notes || "",
        };
        if (timeSpent) item.timeSpentSeconds = timeSpent;
        return item;
      });

      try {
        const response = await fetch("/api/past-papers/attempts/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId, answers: payload }),
        });
        if (!response.ok) throw new Error("Save failed");
        dirtyRef.current = false;
        pendingTimeRef.current = {};
        setLastSavedAt(new Date().toLocaleTimeString());
        setSaveStatus("Saved");
      } catch {
        setSaveStatus("Save failed");
      }
    },
    [attemptId, attemptStatus, questions]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      void saveAnswers(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [saveAnswers]);

  const submitAttempt = async () => {
    setIsSubmitting(true);
    await saveAnswers(true);
    try {
      const response = await fetch("/api/past-papers/attempts/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      if (!response.ok) throw new Error("Submit failed");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveReview = async (questionId: string, reviewerScore: number | null, feedback: string) => {
    setReviewStatus("Saving review...");
    try {
      const response = await fetch("/api/past-papers/attempts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, questionId, reviewerScore, feedback }),
      });
      if (!response.ok) throw new Error("Review save failed");
      setReviewStatus("Review saved");
      router.refresh();
    } catch {
      setReviewStatus("Review save failed");
    }
  };

  const addQuestion = async () => {
    const label = newQuestionLabel.trim();
    if (!label) return;
    setNewQuestionLabel("");
    await fetch("/api/past-papers/questions/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pastPaperId: paper.id, label }),
    });
    router.refresh();
  };

  const unlockDetailedReport = async () => {
    if (attemptStatus !== "marked" || detailedUnlocked || unlockingDetailedReport) return;
    if (!session?.csrfToken) {
      setUnlockStatus("Sign in to unlock the detailed report.");
      return;
    }
    setUnlockingDetailedReport(true);
    setUnlockStatus("Unlocking detailed report...");
    try {
      const response = await fetch("/api/past-papers/attempts/unlock-detailed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({ attemptId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error || "Unable to unlock report.")
            : "Unable to unlock report.";
        throw new Error(errorMessage);
      }
      setDetailedUnlocked(true);
      setUnlockStatus("Detailed report unlocked.");
      router.refresh();
    } catch (error) {
      setUnlockStatus(error instanceof Error ? error.message : "Unable to unlock report.");
    } finally {
      setUnlockingDetailedReport(false);
    }
  };

  const completion = useMemo(() => {
    if (!questions.length) return 0;
    const completed = questions.filter((question) => {
      const answer = answers[question.id];
      return answer && answer.answerText.trim().length > 0;
    }).length;
    return Math.round((completed / questions.length) * 100);
  }, [answers, questions]);

  const perQuestion = analytics?.perQuestion ?? EMPTY_PER_QUESTION;
  const memoSnippet = (analytics && analytics.memoSnippet) || "";
  const backHref = useMemo(() => {
    const raw = currentSearchParams.toString();
    return raw ? `${pathname}?${raw}` : pathname;
  }, [pathname, currentSearchParams]);
  const buildViewerHref = (fileUrl: string, title: string) => {
    const base = `/classes/${encodeURIComponent(classId)}/past-papers/viewer`;
    const query =
      `?file=${encodeURIComponent(fileUrl)}` +
      `&title=${encodeURIComponent(title)}` +
      `&back=${encodeURIComponent(backHref)}`;
    return `${base}${query}`;
  };

  const focusList = useMemo(() => {
    const scores = questions.map((question) => {
      const entry = perQuestion[question.id];
      const maxMarks = entry ? entry.maxMarks : question.maxMarks || 5;
      const score = entry ? entry.score : 0;
      const ratio = maxMarks > 0 ? score / maxMarks : 0;
      return { id: question.id, label: question.qNumber, ratio };
    });
    return scores.sort((a, b) => a.ratio - b.ratio).slice(0, 4);
  }, [questions, perQuestion]);

  const targetedRetrySet = useMemo(
    () => buildTargetedRetrySet(questions, perQuestion, 3),
    [questions, perQuestion]
  );
  const retryWorkspaceHref = `${pathname}?attempt=${encodeURIComponent(attemptId)}`;

  const detailedReportValue =
    analytics &&
    typeof analytics === "object" &&
    analytics.detailedReportValue &&
    typeof analytics.detailedReportValue === "object"
      ? (analytics.detailedReportValue as Record<string, any>)
      : null;

  const attemptComparison =
    detailedReportValue &&
    detailedReportValue.attemptComparison &&
    typeof detailedReportValue.attemptComparison === "object"
      ? (detailedReportValue.attemptComparison as Record<string, any>)
      : null;

  const weakestDomain =
    detailedReportValue &&
    detailedReportValue.weakestDomain &&
    typeof detailedReportValue.weakestDomain === "object"
      ? (detailedReportValue.weakestDomain as Record<string, any>)
      : null;

  return (
    <section style={{ display: "grid", gap: "18px" }}>
      <div className="card glass" style={{ display: "grid", gap: "12px" }}>
        <div className="crumbs">
          <span>Past Papers</span>
          <span>/</span>
          <span>{paper.province}</span>
          <span>/</span>
          <span>Grade {formatGrade(paper.grade)}</span>
          <span>/</span>
          <span>{paper.subject}</span>
          <span>/</span>
          <span>{paper.year}</span>
          <span>/</span>
          <span>{paper.session}</span>
        </div>
        <h1 className="title">Live Past Paper</h1>
        <p className="subtitle">{paper.title}</p>
        <div className="outline-actions">
          {paperUrl ? (
            <Link className="button" href={buildViewerHref(paperUrl, `${paper.title} (Paper)`)}>
              Open paper
            </Link>
          ) : (
            <span className="badge">Paper file unavailable</span>
          )}
          {memoUrl ? (
            <Link className="button" href={buildViewerHref(memoUrl, `${paper.title} (Memo)`)}>
              View memo
            </Link>
          ) : (
            <span className="badge">Memo not available yet (we&apos;ll fetch it when DBE updates)</span>
          )}
          <span className="pill">Completion: {completion}%</span>
          <span className="badge">Class {classId}</span>
          {saveStatus ? <span className="badge">{saveStatus}{lastSavedAt ? " at " + lastSavedAt : ""}</span> : null}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "18px" }}>
        <div className="card glass" style={{ flex: "1 1 520px", minWidth: "300px" }}>
          <h2>Paper preview</h2>
          <div ref={containerRef}>
            {paperUrl && mounted ? (
              <Document
                file={paperUrl}
                onLoadSuccess={(data) => {
                  setNumPages(data.numPages || 1);
                  setPageNumber(1);
                }}
              >
                <Page
                  pageNumber={pageNumber}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>
            ) : (
              <div className="list-item">No paper preview available.</div>
            )}
          </div>
          <div className="outline-actions">
            <button
              className="button"
              type="button"
              onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
              disabled={pageNumber <= 1}
            >
              Previous
            </button>
            <span className="badge">Page {pageNumber} of {numPages}</span>
            <button
              className="button"
              type="button"
              onClick={() => setPageNumber((prev) => Math.min(numPages, prev + 1))}
              disabled={pageNumber >= numPages}
            >
              Next
            </button>
          </div>
        </div>
        <div className="card glass" style={{ flex: "1 1 420px", minWidth: "300px" }}>
          <h2>Answer panel</h2>
          <div className="outline-actions">
            <input
              type="text"
              placeholder="Add a new question label"
              value={newQuestionLabel}
              onChange={(event) => setNewQuestionLabel(event.target.value)}
              style={{ flex: 1, minWidth: "200px" }}
            />
            <button className="button" type="button" onClick={addQuestion}>
              Add question
            </button>
          </div>
          {reviewStatus ? <div className="profile-notice profile-notice--info">{reviewStatus}</div> : null}
          <div className="list">
            {questions.map((question) => {
              const answer = answers[question.id] || { answerText: "", notes: "" };
              const initialAnswer = initialAnswerMap[question.id];
              const entry = perQuestion[question.id];
              const maxMarks = entry ? entry.maxMarks : question.maxMarks || 5;
              const score = entry ? entry.score : initialAnswer ? initialAnswer.autoScore || 0 : 0;
              const needsReview = entry ? entry.needsReview : false;
              const reviewInput = reviewInputs[question.id] || { score: "", feedback: "" };

              return (
                <div className="list-item" key={question.id}>
                  <div className="quiz-question-heading">
                    <strong>
                      {question.qNumber}: {question.label}
                    </strong>
                    <span className="badge">Max {maxMarks}</span>
                  </div>
                  <div className="outline-actions">
                    <Link
                      className="button"
                      href={`/tutor?mode=hints&pastPaperId=${encodeURIComponent(paper.id)}&subject=${encodeURIComponent(paper.subject)}&grade=${paper.grade}&q=${encodeURIComponent(`${question.qNumber}: ${question.label}`)}&marks=${maxMarks}`}
                    >
                      Get hints
                    </Link>
                    <Link
                      className="button"
                      href={`/tutor?mode=mark&pastPaperId=${encodeURIComponent(paper.id)}&subject=${encodeURIComponent(paper.subject)}&grade=${paper.grade}&q=${encodeURIComponent(`${question.qNumber}: ${question.label}`)}&marks=${maxMarks}&answer=${encodeURIComponent(answer.answerText.slice(0, 1500))}`}
                    >
                      Mark my answer
                    </Link>
                  </div>
                  <textarea
                    value={answer.answerText}
                    onChange={(event) => updateAnswer(question.id, "answerText", event.target.value)}
                    onFocus={() => markFocus(question.id)}
                    onBlur={() => {
                      markBlur(question.id);
                      void saveAnswers(false);
                    }}
                    placeholder="Type your answer"
                    disabled={attemptStatus !== "in_progress"}
                    style={{ width: "100%", minHeight: "120px" }}
                  />
                  <textarea
                    value={answer.notes}
                    onChange={(event) => updateAnswer(question.id, "notes", event.target.value)}
                    placeholder="Working notes or rough calculations"
                    disabled={attemptStatus !== "in_progress"}
                    style={{ width: "100%", minHeight: "70px" }}
                  />
                  {attemptStatus === "marked" ? (
                    detailedUnlocked ? (
                      <div className="list">
                        <div className="badge">Score: {score} / {maxMarks}</div>
                        {needsReview ? (
                          <div className="profile-notice profile-notice--info">Manual review recommended.</div>
                        ) : null}
                        <label className="profile-field">
                          Reviewer score
                          <input
                            type="number"
                            value={reviewInput.score}
                            onChange={(event) => {
                              setReviewInputs((prev) => ({
                                ...prev,
                                [question.id]: {
                                  ...(prev[question.id] || { score: "", feedback: "" }),
                                  score: event.target.value,
                                },
                              }));
                            }}
                          />
                        </label>
                        <label className="profile-field">
                          Feedback
                          <textarea
                            value={reviewInput.feedback}
                            onChange={(event) => {
                              setReviewInputs((prev) => ({
                                ...prev,
                                [question.id]: {
                                  ...(prev[question.id] || { score: "", feedback: "" }),
                                  feedback: event.target.value,
                                },
                              }));
                            }}
                            style={{ minHeight: "70px" }}
                          />
                        </label>
                        <button
                          className="button"
                          type="button"
                          onClick={() => {
                            const scoreValue = reviewInput.score.trim();
                            const reviewerScore = scoreValue ? Number(scoreValue) : null;
                            void saveReview(question.id, reviewerScore, reviewInput.feedback);
                          }}
                        >
                          Save review
                        </button>
                      </div>
                    ) : (
                      <div className="profile-notice profile-notice--info">
                        Detailed per-question scoring unlocks after wallet payment.
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="outline-actions">
            {attemptStatus === "marked" ? (
              <span className="pill">Total: {totalScore || 0} / {totalMax || 0}</span>
            ) : (
              <button className="button" type="button" onClick={submitAttempt} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit for marking"}
              </button>
            )}
          </div>
          {attemptStatus === "marked" ? (
            <div id="targeted-retry" className="list">
              <TargetedRetryCard
                retrySet={targetedRetrySet}
                paperHref={retryWorkspaceHref}
                parentAttemptId={attemptId}
              />
            </div>
          ) : null}
          {attemptStatus === "marked" ? (
            detailedUnlocked ? (
              <div className="list">
                <NextBestActionCard
                  heading="Golden path: Detailed report -> Dashboard"
                  title="Apply feedback on your next learning action"
                  description="Use your weak-area tags on the dashboard, then run another targeted paper."
                  primaryAction={{
                    label: "Open dashboard next action",
                    href: "/dashboard/progress",
                  }}
                  secondaryAction={{
                    label: "Practice another paper",
                    href:
                      `/classes/${encodeURIComponent(classId)}/past-papers/` +
                      `${encodeURIComponent(paper.province)}/${paper.grade}/${encodeURIComponent(paper.subject)}`,
                  }}
                />
                {detailedReportValue ? (
                  <div className="list-item">
                    <strong>Detailed report value snapshot</strong>
                    <p className="subtitle">
                      Readiness index:{" "}
                      {typeof detailedReportValue.readinessIndex === "number"
                        ? `${Math.round(detailedReportValue.readinessIndex)}/100`
                        : "n/a"}
                    </p>
                    {attemptComparison ? (
                      <p className="subtitle">
                        {attemptComparison.previousAttemptId
                          ? `Attempt delta: ${formatSignedPercent(
                              Number(attemptComparison.deltaPercent)
                            )} (${String(attemptComparison.trend || "n/a")})`
                          : "Attempt delta: baseline (first marked attempt)"}
                      </p>
                    ) : null}
                    {weakestDomain ? (
                      <p className="subtitle">
                        Weakest domain: {String(weakestDomain.domain || "General")} (
                        {typeof weakestDomain.averagePercent === "number"
                          ? `${weakestDomain.averagePercent.toFixed(1)}%`
                          : "n/a"}
                        )
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {memoSnippet ? (
                  <div className="list-item">
                    <strong>Memo snippet</strong>
                    <p className="subtitle">{memoSnippet}</p>
                  </div>
                ) : null}
                <div className="list-item">
                  <strong>Focus next</strong>
                  <div className="outline-actions">
                    {focusList.length ? focusList.map((item) => (
                      <span className="badge" key={item.id}>{item.label}</span>
                    )) : <span className="badge">No weak areas yet</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="list">
                <NextBestActionCard
                  heading="Golden path: Free summary -> Wallet paywall"
                  title="Detailed report locked"
                  description="Free summary is ready. Unlock full marking details, memo insights, and weak-area focus with wallet credits."
                  primaryAction={{
                    label:
                      unlockingDetailedReport
                        ? "Unlocking..."
                        : `Unlock detailed report (${detailedReportCreditCost} credits)`,
                    onClick: unlockDetailedReport,
                    disabled: unlockingDetailedReport,
                  }}
                  secondaryAction={{
                    label: "Open wallet pricing",
                    href: "/wallet",
                  }}
                  footnote={unlockStatus}
                />
              </div>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}
