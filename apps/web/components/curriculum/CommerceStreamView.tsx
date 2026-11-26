import React from "react";
import styles from "./CommerceStreamView.module.css";

type Outline = {
  title?: string;
  grades?: Array<{
    id: string;
    title: string;
    subjects: Array<{
      id: string;
      title: string;
      terms?: Array<{ id: string; title: string; weeks?: number }>;
    }>;
  }>;
};

export function CommerceStreamView({
  outline,
  lessonTitle,
  lessonHtml,
}: {
  outline: Outline;
  lessonTitle: string;
  lessonHtml: string;
}) {
  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>
        {outline.title ?? "Commerce"}
      </h1>
      <p style={{ opacity: 0.75, marginTop: 0 }}>
        Prototype view (Storybook-friendly).
      </p>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 20 }}>Outline</h2>

        {(outline.grades ?? []).map((g) => (
          <div key={g.id} style={{ margin: "16px 0" }}>
            <h3 style={{ margin: "8px 0" }}>{g.title}</h3>

            {g.subjects.map((s) => (
              <div key={s.id} style={{ paddingLeft: 12, marginBottom: 8 }}>
                <strong>{s.title}</strong>

                {s.terms?.length ? (
                  <div style={{ paddingLeft: 12, opacity: 0.85 }}>
                    {s.terms.map((t) => (
                      <div key={t.id} style={{ marginTop: 4 }}>
                        {t.title}
                        {typeof t.weeks === "number" ? ` â€” ${t.weeks} weeks` : ""}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </section>

      <hr style={{ margin: "32px 0" }} />

      <section>
        <h2 style={{ fontSize: 20 }}>{lessonTitle}</h2>
        <article
          style={{
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 16,
          }}
          // Weâ€™re intentionally rendering HTML already produced by your markdown renderer.
          dangerouslySetInnerHTML={{ __html: lessonHtml }}
        />
      </section>

      <footer style={{ marginTop: 24, opacity: 0.7 }}>
        Storybook view. Real data comes from the page route.
      </footer>
    </main>
  );
}

