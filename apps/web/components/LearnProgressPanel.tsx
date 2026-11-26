"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { LessonEngagementTracker } from "@/components/LessonEngagementTracker";
import { useSession } from "@/components/SessionProvider";
import { getStoredLiteMode } from "@/lib/liteMode";
import { parseLessonKey } from "@/lib/nextBestAction";
import { ConceptMap } from "@/components/ConceptMap";

type SectionItem = {
  key: string;
  label: string;
};

type CheckpointRecord = {
  lesson_key: string;
  section_key: string;
  completed: boolean;
  notes: string | null;
  updated_at: string;
};

type ReviewRecord = {
  id: string;
  lesson_key: string;
  subject: string;
  grade: number;
  next_review_at: string;
  score_percent: number;
  status: "pending" | "done" | "dismissed";
};

type RecommendationRecord = {
  lessonKey: string;
  subject: string;
  grade: number;
  avgScore: number;
  attempts: number;
  reason: string;
};

type BaselineRecord = {
  subject: string | null;
  grade: number | null;
  score_percent: number;
  confidence: "low" | "medium" | "high";
};

type MasteryRecord = {
  topic_tag: string;
  mastery_score: number;
  attempts: number;
};

type AdaptivePathItem = {
  lessonKey: string;
  subject: string;
  grade: number;
  scoreSignal: number;
  reason: string;
};

type Props = {
  lessonKey: string;
  sections: SectionItem[];
  prefetchHrefs?: string[];
};

type CheckpointMap = Record<string, { completed: boolean; notes: string }>;

const formatDate = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const toDueTime = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const MAX_SECTION_NOTE_LENGTH = 400;

export function LearnProgressPanel({ lessonKey, sections, prefetchHrefs = [] }: Props) {
  const apiBase = API_BASE;
  const router = useRouter();
  const { session } = useSession();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<CheckpointMap>({});
  const [dueReviews, setDueReviews] = useState<ReviewRecord[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationRecord[]>([]);
  const [baseline, setBaseline] = useState<BaselineRecord | null>(null);
  const [mastery, setMastery] = useState<MasteryRecord[]>([]);
  const [adaptivePath, setAdaptivePath] = useState<AdaptivePathItem[]>([]);
  const [reviewActionId, setReviewActionId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "overdue" | "due_soon" | "upcoming">("all");
  const [sectionFilter, setSectionFilter] = useState<"all" | "complete" | "incomplete">("all");
  const [dirtySections, setDirtySections] = useState<Record<string, boolean>>({});
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [prefetching, setPrefetching] = useState(false);

  const liteMode = useMemo(() => getStoredLiteMode() === true, []);

  const ensureDefaults = useCallback(() => {
    setCheckpoints((prev) => {
      const next: CheckpointMap = { ...prev };
      for (const section of sections) {
        if (!next[section.key]) {
          next[section.key] = { completed: false, notes: "" };
        }
      }
      return next;
    });
  }, [sections]);

  const loadPanelData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setNotice(null);
    try {
      const [
        checkpointResponse,
        reviewResponse,
        recommendationResponse,
        baselineResponse,
        masteryResponse,
        adaptiveResponse,
      ] = await Promise.all([
        fetch(`${apiBase}/analytics/lesson-checkpoints?lessonKey=${encodeURIComponent(lessonKey)}`, {
          credentials: "include",
        }),
        fetch(`${apiBase}/analytics/spaced-reviews?dueOnly=true&limit=6`, { credentials: "include" }),
        fetch(`${apiBase}/analytics/recommendations?limit=4`, { credentials: "include" }),
        fetch(`${apiBase}/analytics/baseline`, { credentials: "include" }),
        fetch(`${apiBase}/analytics/mastery-heatmap?limit=6`, { credentials: "include" }),
        fetch(`${apiBase}/analytics/adaptive-path?limit=5`, { credentials: "include" }),
      ]);

      if (
        !checkpointResponse.ok ||
        !reviewResponse.ok ||
        !recommendationResponse.ok
      ) {
        throw new Error("Unable to load adaptive learning data.");
      }

      const checkpointData = (await checkpointResponse.json()) as { checkpoints: CheckpointRecord[] };
      const reviewData = (await reviewResponse.json()) as { reviews: ReviewRecord[] };
      const recommendationData = (await recommendationResponse.json()) as {
        recommendations: RecommendationRecord[];
      };
      const baselineData = baselineResponse.ok
        ? ((await baselineResponse.json()) as { baseline?: BaselineRecord | null })
        : { baseline: null };
      const masteryData = masteryResponse.ok
        ? ((await masteryResponse.json()) as { mastery?: MasteryRecord[] })
        : { mastery: [] };
      const adaptiveData = adaptiveResponse.ok
        ? ((await adaptiveResponse.json()) as { path?: AdaptivePathItem[] })
        : { path: [] };

      const nextMap: CheckpointMap = {};
      for (const section of sections) {
        nextMap[section.key] = { completed: false, notes: "" };
      }
      for (const record of checkpointData.checkpoints || []) {
        nextMap[record.section_key] = {
          completed: Boolean(record.completed),
          notes: record.notes || "",
        };
      }
      setCheckpoints(nextMap);
      setDueReviews(reviewData.reviews || []);
      setRecommendations(recommendationData.recommendations || []);
      setBaseline(baselineData.baseline ?? null);
      setMastery(masteryData.mastery || []);
      setAdaptivePath(adaptiveData.path || []);
      setDirtySections({});
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to load adaptive learning data."));
      ensureDefaults();
      setBaseline(null);
      setMastery([]);
      setAdaptivePath([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase, ensureDefaults, lessonKey, sections, session]);

  useEffect(() => {
    if (!session) {
      setDueReviews([]);
      setRecommendations([]);
      setLastSyncedAt(null);
      setDirtySections({});
      ensureDefaults();
      return;
    }
    void loadPanelData();
  }, [ensureDefaults, loadPanelData, session]);

  const completedCount = useMemo(
    () => sections.filter((section) => checkpoints[section.key]?.completed).length,
    [checkpoints, sections]
  );
  const progressPercent = useMemo(
    () => (sections.length ? Math.round((completedCount / sections.length) * 100) : 0),
    [completedCount, sections.length]
  );
  const filteredSections = useMemo(() => {
    if (sectionFilter === "all") return sections;
    return sections.filter((section) =>
      sectionFilter === "complete"
        ? Boolean(checkpoints[section.key]?.completed)
        : !checkpoints[section.key]?.completed
    );
  }, [checkpoints, sectionFilter, sections]);
  const sortedDueReviews = useMemo(
    () => [...dueReviews].sort((a, b) => toDueTime(a.next_review_at) - toDueTime(b.next_review_at)),
    [dueReviews]
  );
  const visibleDueReviews = useMemo(() => {
    const now = Date.now();
    const soonBoundary = now + 24 * 60 * 60 * 1000;
    return sortedDueReviews.filter((review) => {
      const dueAt = toDueTime(review.next_review_at);
      if (reviewFilter === "all") return true;
      if (reviewFilter === "overdue") return dueAt < now;
      if (reviewFilter === "due_soon") return dueAt >= now && dueAt <= soonBoundary;
      return dueAt > soonBoundary;
    });
  }, [reviewFilter, sortedDueReviews]);
  const overdueReviewCount = useMemo(() => {
    const now = Date.now();
    return dueReviews.filter((review) => toDueTime(review.next_review_at) < now).length;
  }, [dueReviews]);
  const dirtySectionCount = useMemo(
    () => Object.values(dirtySections).filter(Boolean).length,
    [dirtySections]
  );
  const masteryAverage = useMemo(() => {
    if (!mastery.length) return null;
    const total = mastery.reduce((sum, item) => sum + Number(item.mastery_score || 0), 0);
    return total / mastery.length;
  }, [mastery]);
  const rankedRecommendations = useMemo(
    () =>
      [...recommendations].sort(
        (a, b) => Number(a.avgScore || 0) - Number(b.avgScore || 0) || Number(b.attempts || 0) - Number(a.attempts || 0)
      ),
    [recommendations]
  );
  const rankedAdaptivePath = useMemo(
    () => [...adaptivePath].sort((a, b) => Number(a.scoreSignal || 0) - Number(b.scoreSignal || 0)),
    [adaptivePath]
  );

  const saveCheckpoint = async (sectionKey: string, next: { completed: boolean; notes: string }) => {
    if (!session) return;
    setCheckpoints((prev) => ({ ...prev, [sectionKey]: next }));
    try {
      const response = await fetch(`${apiBase}/analytics/lesson-checkpoints`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
        body: JSON.stringify({
          lessonKey,
          sectionKey,
          completed: next.completed,
          notes: next.notes || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to save checkpoint.");
      }
      const completesLesson = next.completed && sections.every((section) =>
        section.key === sectionKey ? next.completed : Boolean(checkpoints[section.key]?.completed)
      );
      if (completesLesson) void captureLessonCompletion();
      setDirtySections((prev) => ({ ...prev, [sectionKey]: false }));
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to save checkpoint."));
      setDirtySections((prev) => ({ ...prev, [sectionKey]: true }));
    }
  };

  const captureLessonCompletion = async () => {
    const parsed = parseLessonKey(lessonKey);
    try {
      await fetch(`${apiBase}/learning/revision-artifacts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "lesson",
          title: `Lesson complete · ${parsed?.subjectKey || lessonKey}`,
          subject: parsed?.subjectKey || null,
          sourceType: "lesson",
          sourceId: lessonKey,
          takeaways: [
            `Completed all ${sections.length} learning checkpoint${sections.length === 1 ? "" : "s"}.`,
            `Grade ${parsed?.grade ?? ""} · Term ${parsed?.term ?? ""} · Week ${parsed?.week ?? ""}`.replace(/ · $/, ""),
          ],
          nextAction: "Try the linked practice activity or return for a spaced review when it becomes due.",
          evidence: [{ type: "lesson_completion", label: `${sections.length} checkpoints complete` }],
        }),
      });
    } catch {
      // Completion capture is best-effort and must not interrupt lesson progress.
    }
  };

  const handleReviewAction = async (reviewId: string, action: "done" | "dismiss") => {
    if (!session) return;
    setReviewActionId(reviewId);
    try {
      const response = await fetch(`${apiBase}/analytics/spaced-reviews/${reviewId}/${action}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": session.csrfToken,
        },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to update review status.");
      }
      setDueReviews((prev) => prev.filter((review) => review.id !== reviewId));
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Unable to update review status."));
    } finally {
      setReviewActionId(null);
    }
  };

  const handleBulkReviewAction = async (action: "done" | "dismiss") => {
    if (!session || bulkUpdating || visibleDueReviews.length === 0) return;
    setBulkUpdating(true);
    setNotice(null);
    try {
      for (const review of visibleDueReviews) {
        await handleReviewAction(review.id, action);
      }
      setNotice(
        action === "done"
          ? `Marked ${visibleDueReviews.length} review(s) done.`
          : `Dismissed ${visibleDueReviews.length} review(s).`
      );
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSetAllCompletion = async (nextCompleted: boolean) => {
    if (!session || bulkUpdating) return;
    const snapshot = sections.map((section) => ({
      sectionKey: section.key,
      state: checkpoints[section.key] || { completed: false, notes: "" },
    }));
    setBulkUpdating(true);
    setNotice(null);
    try {
      await Promise.all(
        snapshot.map(({ sectionKey, state }) =>
          saveCheckpoint(sectionKey, {
            completed: nextCompleted,
            notes: state.notes || "",
          })
        )
      );
      if (nextCompleted) void captureLessonCompletion();
      setNotice(nextCompleted ? "Marked all checkpoints complete." : "Reset all checkpoints.");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSaveDirtySections = async () => {
    if (!session || bulkUpdating) return;
    const dirtyKeys = sections
      .map((section) => section.key)
      .filter((sectionKey) => Boolean(dirtySections[sectionKey]));
    if (!dirtyKeys.length) {
      setNotice("All section notes are already synced.");
      return;
    }
    setBulkUpdating(true);
    setNotice(null);
    try {
      await Promise.all(
        dirtyKeys.map((sectionKey) => {
          const state = checkpoints[sectionKey] || { completed: false, notes: "" };
          return saveCheckpoint(sectionKey, state);
        })
      );
      setNotice("Saved all pending section notes.");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleLitePrefetch = async () => {
    if (!prefetchHrefs.length) return;
    setPrefetching(true);
    for (const href of prefetchHrefs.slice(0, 3)) {
      router.prefetch(href);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    setPrefetching(false);
    setNotice("Queued nearby weeks for prefetch.");
  };

  const handleGenerateFlashcards = async () => {
    if (!session || bulkUpdating) return;
    setBulkUpdating(true);
    setNotice(null);
    try {
      const response = await fetch("/api/flashcards/generate", {
        method: "POST",
        body: JSON.stringify({ lessonKey, ...parseLessonKey(lessonKey) }),
      });
      if (!response.ok) throw new Error("Failed to generate flashcards.");
      setNotice("Flashcards generated! You can study them offline.");
    } catch (error) {
      setNotice(getApiErrorMessage(error, "Failed to generate flashcards."));
    } finally {
      setBulkUpdating(false);
    }
  };

  const completedKeys = useMemo(
    () => sections.filter((s) => checkpoints[s.key]?.completed).map((s) => s.key),
    [checkpoints, sections]
  );

  return (
    <div className="week-card">
      <LessonEngagementTracker lessonKey={lessonKey} />
      
      <div style={{ margin: "24px 0" }}>
        <ConceptMap title={lessonKey} sections={sections} completedKeys={completedKeys} />
      </div>

      <h3>Learning Actions</h3>
      <p className="badge">
        Progress: {completedCount}/{sections.length} checkpoints complete ({progressPercent}%).
      </p>
      <div className="learn-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
        <span className="learn-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="learn-status-row">
        <span className="badge">
          {progressPercent === 100
            ? "All sections complete."
            : progressPercent >= 60
            ? "Steady progress."
            : "Focus on incomplete sections."}
        </span>
        <span className="badge">Overdue reviews: {overdueReviewCount}</span>
        <span className="badge">
          {lastSyncedAt ? `Synced ${formatDate(lastSyncedAt)}` : "Not synced yet"}
        </span>
      </div>
      {notice ? <p className="badge">{notice}</p> : null}
      {loading ? <p className="badge">Loading adaptive data...</p> : null}
      <div className="learn-actions">
        <button
          type="button"
          onClick={() => void loadPanelData()}
          disabled={loading || !session}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <button
          type="button"
          onClick={() => void handleSetAllCompletion(true)}
          disabled={bulkUpdating || !session || sections.length === 0}
        >
          Mark all complete
        </button>
        <button
          type="button"
          onClick={() => void handleSetAllCompletion(false)}
          disabled={bulkUpdating || !session || sections.length === 0}
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={() => void handleSaveDirtySections()}
          disabled={bulkUpdating || !session || dirtySectionCount === 0}
        >
          Save notes ({dirtySectionCount})
        </button>
        <button
          type="button"
          onClick={() => void handleGenerateFlashcards()}
          disabled={bulkUpdating || !session}
        >
          Generate Flashcards 🎴
        </button>
        <label className="learn-inline-field">
          View
          <select
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value as "all" | "complete" | "incomplete")}
          >
            <option value="all">All sections</option>
            <option value="incomplete">Incomplete only</option>
            <option value="complete">Complete only</option>
          </select>
        </label>
      </div>

      <div className="list">
        {filteredSections.map((section) => {
          const state = checkpoints[section.key] || { completed: false, notes: "" };
          const noteLength = state.notes?.length || 0;
          const isDirty = Boolean(dirtySections[section.key]);
          return (
            <div key={section.key} className="list-item">
              <label className="learn-section-meta">
                <input
                  type="checkbox"
                  checked={state.completed}
                  onChange={(event) =>
                    void saveCheckpoint(section.key, {
                      ...state,
                      completed: event.target.checked,
                    })
                  }
                />
                {" "}{section.label}
                {isDirty ? <span className="badge">Unsaved</span> : <span className="badge">Saved</span>}
              </label>
              <textarea
                rows={2}
                value={state.notes}
                placeholder="Optional notes"
                onChange={(event) =>
                  setCheckpoints((prev) => ({
                    ...prev,
                    [section.key]: {
                      ...state,
                      notes: event.target.value.slice(0, MAX_SECTION_NOTE_LENGTH),
                    },
                  }))
                }
                onInput={() =>
                  setDirtySections((prev) => ({
                    ...prev,
                    [section.key]: true,
                  }))
                }
                onBlur={() =>
                  void saveCheckpoint(section.key, checkpoints[section.key] || { completed: false, notes: "" })
                }
              />
              <p className="learn-note-counter">
                {noteLength}/{MAX_SECTION_NOTE_LENGTH}
              </p>
            </div>
          );
        })}
        {filteredSections.length === 0 ? (
          <p className="badge">No sections match this filter.</p>
        ) : null}
      </div>

      <div className="list">
        <div className="list-item">
          <strong>Due Reviews</strong>
          <p className="badge">
            {sortedDueReviews.length} due | {overdueReviewCount} overdue
          </p>
          <div className="learn-actions">
            <label className="learn-inline-field">
              View
              <select
                value={reviewFilter}
                onChange={(event) =>
                  setReviewFilter(event.target.value as "all" | "overdue" | "due_soon" | "upcoming")
                }
              >
                <option value="all">All due</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due in 24h</option>
                <option value="upcoming">Later</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void handleBulkReviewAction("done")}
              disabled={bulkUpdating || visibleDueReviews.length === 0}
            >
              Mark shown done
            </button>
            <button
              type="button"
              onClick={() => void handleBulkReviewAction("dismiss")}
              disabled={bulkUpdating || visibleDueReviews.length === 0}
            >
              Dismiss shown
            </button>
          </div>
          {dueReviews.length === 0 ? (
            <p className="badge">No due spaced reviews.</p>
          ) : (
            visibleDueReviews.map((review) => (
              <div key={review.id} className="outline-actions">
                <span className="badge">
                  {review.lesson_key} | score {Number(review.score_percent).toFixed(0)}% | due {formatDate(review.next_review_at)}
                </span>
                <button
                  type="button"
                  onClick={() => void handleReviewAction(review.id, "done")}
                  disabled={reviewActionId === review.id || bulkUpdating}
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => void handleReviewAction(review.id, "dismiss")}
                  disabled={reviewActionId === review.id || bulkUpdating}
                >
                  Dismiss
                </button>
              </div>
            ))
          )}
          {dueReviews.length > 0 && visibleDueReviews.length === 0 ? (
            <p className="badge">No reviews match this filter.</p>
          ) : null}
        </div>

        <div className="list-item">
          <strong>Recommended Reinforcement</strong>
          {recommendations.length === 0 ? (
            <p className="badge">No recommendations right now.</p>
          ) : (
            <ul>
              {rankedRecommendations.map((item) => (
                <li key={item.lessonKey}>
                  {item.lessonKey} ({item.subject} G{item.grade}) - {item.reason}, avg {item.avgScore.toFixed(0)}%,
                  attempts {item.attempts}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="list-item">
          <strong>Baseline and Mastery</strong>
          {baseline ? (
            <p className="badge">
              Baseline: {Number(baseline.score_percent).toFixed(0)}% ({baseline.confidence})
            </p>
          ) : (
            <p className="badge">No baseline score yet.</p>
          )}
          {masteryAverage !== null ? (
            <p className="badge">Average mastery: {masteryAverage.toFixed(0)}%</p>
          ) : null}
          {mastery.length === 0 ? (
            <p className="badge">No topic mastery records yet.</p>
          ) : (
            <ul>
              {mastery.slice(0, 4).map((topic) => (
                <li key={topic.topic_tag}>
                  {topic.topic_tag}: {Number(topic.mastery_score).toFixed(0)}% ({topic.attempts} attempts)
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="list-item">
          <strong>Adaptive Path</strong>
          {adaptivePath.length === 0 ? (
            <p className="badge">No adaptive path suggestions yet.</p>
          ) : (
            <ul>
              {rankedAdaptivePath.map((item) => (
                <li key={item.lessonKey}>
                  {item.lessonKey} ({item.subject} G{item.grade}) - {item.reason}, signal{" "}
                  {Number(item.scoreSignal).toFixed(0)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {liteMode && prefetchHrefs.length > 0 ? (
        <div className="outline-actions">
          <button type="button" onClick={() => void handleLitePrefetch()} disabled={prefetching}>
            {prefetching ? "Prefetching..." : "Prefetch nearby weeks"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
