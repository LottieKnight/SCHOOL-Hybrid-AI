"use client";

type StudyMessageProps = {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  attachmentName?: string;
};

export default function StudyMessage({ role, content, isStreaming = false, attachmentName }: StudyMessageProps) {
  const isUser = role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        width: "100%",
      }}
    >
      <div
        aria-busy={isStreaming || undefined}
        style={{
          maxWidth: "min(72%, 680px)",
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          background: isUser ? "color-mix(in srgb, var(--institution-primary, #5B6EF5) 15%, transparent)" : "var(--surface, rgba(255,255,255,0.04))",
          border: isUser
            ? "1px solid color-mix(in srgb, var(--institution-primary, #5B6EF5) 30%, transparent)"
            : "1px solid rgba(255,255,255,0.08)",
          color: "var(--text-1, #F2F2F2)",
          fontSize: "14px",
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.18)",
        }}
      >
        {attachmentName ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: content ? "8px" : 0,
              padding: "4px 10px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "12px",
              maxWidth: "100%",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 11.5L12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {attachmentName}
            </span>
          </div>
        ) : null}
        {content}
      </div>
      <style jsx>{`
        @media (max-width: 640px) {
          div[aria-busy] {
            max-width: 88%;
          }
        }
      `}</style>
    </div>
  );
}
