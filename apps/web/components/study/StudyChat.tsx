"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import { useGuestLimit } from "../../hooks/useGuestLimit";
import StudyMessage from "@/components/study/StudyMessage";
import {
  PLANNER_UPLOAD_ACCEPT_ATTR,
  validatePlannerUploadFile,
} from "@/lib/plannerUploadValidation";
import { composeStudyMaterial } from "@/lib/studyAttachment";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachmentName?: string;
  grounding?: GroundingEvidence;
};

type GroundingSource = {
  id: string;
  label: string;
  subject: string | null;
  grade: number | null;
  curriculum: string | null;
  similarity: number;
};

type GroundingEvidence = {
  grounded: boolean;
  confidence: "high" | "medium" | "low";
  boundary: string;
  sources: GroundingSource[];
};

type Attachment = {
  name: string;
  text: string;
  preview: string;
};

type AssistantResponse = {
  result?: {
    explanation?: string;
    summary?: string;
    quiz?: {
      questions?: Array<{
        question?: string;
        answer?: string;
      }>;
    };
  };
  grounding?: GroundingEvidence;
  error?: string;
};

const SUGGESTIONS = [
  "Summarise my notes",
  "Generate practice questions",
  "Explain a concept",
];

function formatAssistantContent(payload: AssistantResponse["result"]) {
  if (!payload) return "";

  const parts: string[] = [];
  const explanation = payload.explanation?.trim() || "";
  const summary = payload.summary?.trim() || "";
  const questions = Array.isArray(payload.quiz?.questions) ? payload.quiz?.questions : [];

  if (explanation) {
    parts.push(explanation);
  }

  if (summary) {
    parts.push(explanation ? `Summary\n${summary}` : summary);
  }

  if (questions.length > 0) {
    const quizBlock = questions
      .map((item, index) => {
        const question = item.question?.trim() || "Question";
        const answer = item.answer?.trim() || "";
        return `${index + 1}. ${question}${answer ? `\n${answer}` : ""}`;
      })
      .join("\n\n");

    parts.push(`Practice Questions\n${quizBlock}`);
  }

  return parts.join("\n\n").trim();
}

function LoadingBubble() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", width: "100%" }}>
      <div
        style={{
          maxWidth: "min(72%, 680px)",
          padding: "12px 16px",
          borderRadius: "18px 18px 18px 4px",
          background: "var(--surface, rgba(255,255,255,0.04))",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          minHeight: "46px",
        }}
      >
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "999px",
              background: "rgba(242, 242, 242, 0.88)",
              animation: `study-dot-pulse 1.1s ${dot * 0.16}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function GroundingRail({ evidence }: { evidence: GroundingEvidence }) {
  return (
    <aside className={`study-grounding-rail study-grounding-rail--${evidence.confidence}`} aria-label="Answer evidence">
      <div className="study-grounding-rail__top">
        <span className="study-grounding-rail__label">{evidence.grounded ? "GROUNDED ANSWER" : "GENERAL EXPLANATION"}</span>
        <span className="study-grounding-rail__confidence">{evidence.confidence} confidence</span>
      </div>
      <p>{evidence.boundary}</p>
      {evidence.sources.length > 0 ? (
        <ul>
          {evidence.sources.slice(0, 3).map((source) => (
            <li key={source.id}>
              <span>{source.label}</span>
              <small>{source.subject || "Curriculum"}{source.grade ? ` · Grade ${source.grade}` : ""}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

export default function StudyChat() {
  const { authState } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const guestLimit = useGuestLimit();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showGuestUpgrade, setShowGuestUpgrade] = useState(false);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const [showDailyUpgrade, setShowDailyUpgrade] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const cancelledRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const returnPath = useMemo(() => {
    const query = searchParams?.toString();
    if (!pathname) return "/study";
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (authState.isGuest || authState.isPaidUser) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/study-assistant", { credentials: "include" });
        if (!response.ok || cancelled) return;
        const data = (await response.json().catch(() => null)) as
          | { paid?: boolean; remaining?: number; limit?: number }
          | null;
        if (!data || data.paid) return;
        if (typeof data.remaining === "number") setDailyRemaining(data.remaining);
        if (typeof data.limit === "number") setDailyLimit(data.limit);
      } catch {
        // non-fatal — the server will still enforce the cap
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState.isGuest, authState.isPaidUser]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;

    node.style.height = "0px";
    const nextHeight = Math.min(node.scrollHeight, 24 * 5);
    node.style.height = `${nextHeight}px`;
    node.style.overflowY = node.scrollHeight > nextHeight ? "auto" : "hidden";
  }, [input]);

  function clearAttachment() {
    setAttachment(null);
    setAttachmentError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleFileSelected(file: File) {
    setAttachmentError("");

    if (authState.isGuest) {
      // Image OCR and PDF parsing are AI-backed; keep them behind a free account.
      setShowGuestUpgrade(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const validation = validatePlannerUploadFile(file.name, file.type, file.size);
    if (!validation.ok) {
      setAttachmentError(validation.error);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/study-assistant/extract", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = (await response.json().catch(() => ({}))) as {
        text?: string;
        preview?: string;
        fileName?: string;
        error?: string;
      };

      if (cancelledRef.current) return;

      if (!response.ok || !data.text) {
        setAttachmentError(data.error || "Couldn't read that file. Please try another.");
        return;
      }

      setAttachment({
        name: data.fileName || file.name,
        text: data.text,
        preview: data.preview || "",
      });
    } catch {
      if (cancelledRef.current) return;
      setAttachmentError("Couldn't upload that file. Please try again.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!cancelledRef.current) setIsExtracting(false);
    }
  }

  async function handleSubmit() {
    const trimmed = input.trim();
    if ((!trimmed && !attachment) || isLoading || isExtracting) return;
    if (authState.isGuest && guestLimit.hydrated && guestLimit.hasReachedLimit) {
      setShowGuestUpgrade(true);
      return;
    }

    const material = composeStudyMaterial(trimmed, attachment?.text ?? "", attachment?.name);
    if (!material) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed || (attachment ? `Sent ${attachment.name}` : ""),
      attachmentName: attachment?.name,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    clearAttachment();
    setIsLoading(true);

    try {
      const response = await fetch("/api/study-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          material,
          mode: "mixed",
        }),
      });

      if (cancelledRef.current) return;

      const data = (await response.json().catch(() => ({}))) as AssistantResponse & {
        dailyLimitReached?: boolean;
        dailyRemaining?: number;
      };

      if (cancelledRef.current) return;

      const remainingHeader = response.headers.get("X-Daily-Remaining");
      if (remainingHeader !== null && !authState.isGuest) {
        const parsed = Number(remainingHeader);
        if (Number.isFinite(parsed)) setDailyRemaining(Math.max(0, parsed));
      }

      if (!response.ok) {
        if (data.dailyLimitReached) {
          setDailyRemaining(0);
          setShowDailyUpgrade(true);
        }
        throw new Error(data.error || "Request failed.");
      }

      const assistantContent = formatAssistantContent(data.result);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: assistantContent || "Something went wrong. Please try again.",
          grounding: data.grounding,
        },
      ]);
      if (authState.isGuest) {
        guestLimit.increment();
      }
    } catch (error) {
      if (cancelledRef.current) return;

      // Surface the server's actual message (e.g. validation hints like
      // "Please paste at least a sentence…") instead of a generic failure,
      // so a 400 doesn't read to the user as the assistant being offline.
      const detail =
        error instanceof Error && error.message ? error.message : "";

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: detail || "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      if (cancelledRef.current) return;
      setIsLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        padding: "24px 16px",
        background:
          "radial-gradient(circle at top left, rgba(91, 110, 245, 0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(255, 255, 255, 0.06), transparent 26%)",
      }}
    >
      <section
        style={{
        width: "min(980px, 100%)",
        margin: "0 auto",
          height: "calc(100dvh - 48px)",
          borderRadius: "28px",
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(10, 10, 11, 0.86)",
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.36)",
          overflow: "hidden",
          display: "grid",
          gridTemplateRows: "1fr auto",
          backdropFilter: "blur(18px)",
        }}
      >
        <div
          style={{
            minHeight: 0,
            overflowY: "auto",
            padding: "28px 20px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {showGuestUpgrade ? (
            <div
              className="glass card"
              style={{
                display: "grid",
                gap: "12px",
                padding: "18px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div>
                <strong>Create a free account to keep studying</strong>
                <p style={{ margin: "6px 0 0", color: "var(--text-3)", lineHeight: 1.55 }}>
                  Guests get one AI generation. A free account unlocks saved sessions, saved notes, and more study generations.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link className="button" href={`/auth?next=${encodeURIComponent(returnPath)}`}>
                  Create free account
                </Link>
                <button className="button button-ghost" type="button" onClick={() => setShowGuestUpgrade(false)}>
                  Maybe later
                </button>
              </div>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <div
              style={{
                flex: 1,
                minHeight: "100%",
                display: "grid",
                placeItems: "center",
                padding: "24px 0",
              }}
            >
              <div
                style={{
                  width: "min(560px, 100%)",
                  display: "grid",
                  justifyItems: "center",
                  gap: "14px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "24px",
                    letterSpacing: "0.22em",
                    color: "rgba(242, 242, 242, 0.4)",
                  }}
                >
                  SCHOOL
                </div>
                <p style={{ fontSize: "14px", color: "var(--text-2, #8A8A8A)" }}>
                  What are you studying today?
                </p>
                {authState.isGuest ? (
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--text-3, #8A8A8A)" }}>
                    Guest mode includes {guestLimit.limit} AI generation before free-account unlock.
                  </p>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "10px",
                  }}
                >
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      style={{
                        borderRadius: "999px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        background: "rgba(255,255,255,0.04)",
                        color: "var(--text-1, #F2F2F2)",
                        padding: "10px 14px",
                        fontSize: "13px",
                        lineHeight: 1,
                        transition: "border-color 180ms ease, background 180ms ease, transform 180ms ease",
                        cursor: "pointer",
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="study-message-stack">
                <StudyMessage
                  role={message.role}
                  content={message.content}
                  attachmentName={message.attachmentName}
                />
                {message.role === "assistant" && message.grounding ? <GroundingRail evidence={message.grounding} /> : null}
              </div>
            ))
          )}

          {isLoading ? <LoadingBubble /> : null}
          <div ref={scrollAnchorRef} />
        </div>

        <div
          style={{
            position: "sticky",
            bottom: 0,
            padding: "16px",
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, rgba(10,10,11,0.72), rgba(10,10,11,0.96))",
            backdropFilter: "blur(16px)",
          }}
        >
          {showDailyUpgrade ? (
            <div
              className="glass card"
              style={{
                display: "grid",
                gap: "12px",
                padding: "18px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div>
                <strong>You've used today's free AI generations</strong>
                <p style={{ margin: "6px 0 0", color: "var(--text-3)", lineHeight: 1.55 }}>
                  Free accounts get {dailyLimit ?? 10} AI generations per day. The cap resets tomorrow —
                  or upgrade for unlimited AI sessions.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link className="button" href="/settings">
                  Upgrade plan
                </Link>
                <button className="button button-ghost" type="button" onClick={() => setShowDailyUpgrade(false)}>
                  Maybe later
                </button>
              </div>
            </div>
          ) : authState.isGuest ? null : !authState.isPaidUser && dailyRemaining !== null ? (
            <div style={{ paddingBottom: "12px", color: "var(--text-3)", fontSize: "12px" }}>
              {dailyRemaining > 0
                ? `Free plan: ${dailyRemaining} AI ${dailyRemaining === 1 ? "generation" : "generations"} left today.`
                : "Free plan: daily AI cap reached. Upgrade for unlimited generations."}
            </div>
          ) : null}
          {attachment ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "10px",
                padding: "10px 12px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M21 11.5L12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--text-1, #F2F2F2)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {attachment.name}
                </div>
                {attachment.preview ? (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-3, #8A8A8A)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {attachment.preview}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                aria-label="Remove attachment"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--text-2, #8A8A8A)",
                  cursor: "pointer",
                  fontSize: "16px",
                  lineHeight: 1,
                  padding: "2px 6px",
                }}
              >
                ×
              </button>
            </div>
          ) : null}

          {attachmentError ? (
            <div style={{ marginBottom: "10px", fontSize: "12px", color: "#ff8a8a" }}>
              {attachmentError}
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept={PLANNER_UPLOAD_ACCEPT_ATTR}
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: "12px",
              alignItems: "end",
              borderRadius: "22px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              padding: "12px 12px 12px 12px",
            }}
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtracting || isLoading}
              aria-label="Attach an image or PDF"
              title="Attach an image or PDF of your notes"
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "var(--text-1, #F2F2F2)",
                display: "grid",
                placeItems: "center",
                opacity: isExtracting || isLoading ? 0.42 : 1,
                cursor: isExtracting || isLoading ? "not-allowed" : "pointer",
                transition: "opacity 180ms ease, border-color 180ms ease",
              }}
            >
              {isExtracting ? (
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.25)",
                    borderTopColor: "rgba(255,255,255,0.9)",
                    animation: "study-spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M21 11.5L12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <textarea
              ref={textareaRef}
              value={input}
              rows={1}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Ask anything about your notes, past papers, or course content…"
              style={{
                resize: "none",
                border: "none",
                outline: "none",
                background: "transparent",
                color: "var(--text-1, #F2F2F2)",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                lineHeight: 1.6,
                minHeight: "24px",
                maxHeight: "120px",
                width: "100%",
              }}
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isLoading || isExtracting || (!input.trim() && !attachment)}
              aria-label="Send message"
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "14px",
                border: "1px solid color-mix(in srgb, var(--institution-primary, #5B6EF5) 30%, transparent)",
                background: "color-mix(in srgb, var(--institution-primary, #5B6EF5) 18%, transparent)",
                color: "var(--text-1, #F2F2F2)",
                display: "grid",
                placeItems: "center",
                opacity: isLoading || isExtracting || (!input.trim() && !attachment) ? 0.42 : 1,
                cursor: isLoading || isExtracting || (!input.trim() && !attachment) ? "not-allowed" : "pointer",
                transition: "opacity 180ms ease, border-color 180ms ease, transform 180ms ease",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 12.5L19 5L14 19L11.4 13.1L4 12.5Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <style jsx>{`
        textarea::placeholder {
          color: var(--text-2, #8a8a8a);
        }

        textarea:focus,
        button:focus-visible {
          outline: none;
        }

        section :global(textarea:focus) {
          box-shadow: none;
        }

        section > div:last-child > div:has(textarea:focus) {
          border-color: color-mix(in srgb, var(--institution-primary, #5b6ef5) 60%, transparent);
        }

        @keyframes study-dot-pulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes study-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 640px) {
          main {
            padding: 0;
          }

          section {
            width: 100%;
            height: 100dvh;
            border-radius: 0;
          }

          section > div:first-child {
            padding: 22px 14px 18px;
          }

          section > div:last-child {
            padding: 12px;
          }

          section > div:last-child > div:has(textarea) {
            grid-template-columns: auto 1fr auto;
          }

          section :global(div[aria-busy]),
          section :global(div[aria-busy] + style + *),
          section :global(div[aria-busy="true"]) {
            max-width: 88%;
          }

          section :global([aria-busy]),
          section :global([style*="max-width: min(72%, 680px)"]) {
            max-width: 88% !important;
          }
        }
      `}</style>
    </main>
  );
}
