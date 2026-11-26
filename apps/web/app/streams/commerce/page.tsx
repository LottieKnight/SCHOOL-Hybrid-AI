import Link from "next/link";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getLessonsRoot } from "@saedu/shared";
import { renderMarkdown } from "@/lib/markdown";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type Outline = {
  stream: string;
  grades: Array<{
    grade: number;
    subjects: Array<{
      name: string;
      slug?: string;
      terms: Array<{
        term: number;
        weeks: Array<{
          week: number;
          title: string;
          lesson: string;
        }>;
      }>;
    }>;
  }>;
};

async function loadOutline(): Promise<Outline | null> {
  try {
    const lessonsRoot = getLessonsRoot();
    const outlinePath = join(lessonsRoot, "commerce", "outline.json");
    const raw = await readFile(outlinePath, "utf8");
    return JSON.parse(raw) as Outline;
  } catch {
    return null;
  }
}

export default async function CommerceStreamPage() {
  const outline = await loadOutline();

  if (!outline) {
    return (
      <main className={styles.main}>
        <h1>Commerce Stream</h1>
        <p>Curriculum content is being prepared. Check back soon.</p>
        <p className={styles.footer}>
          <Link href="/">Back home</Link>
        </p>
      </main>
    );
  }

  const lessonsRoot = getLessonsRoot();
  const firstWeek = outline.grades?.[0]?.subjects?.[0]?.terms?.[0]?.weeks?.[0] ?? null;

  let demoHtml = "";
  if (firstWeek?.lesson) {
    const lessonPath = join(lessonsRoot, firstWeek.lesson);
    const md = await readFile(lessonPath, "utf8");
    demoHtml = renderMarkdown(md);
  }

  return (
    <main className={styles.main}>
      <h1>Commerce Stream</h1>
      <p>This page is rendered from JSON + Markdown (data-driven).</p>

      <section className={styles.section}>
        <h2>Curriculum Outline</h2>

        {outline.grades.map((g) => (
          <div key={g.grade} className={styles.gradeContainer}>
            <h3>Grade {g.grade}</h3>
            {g.subjects.map((s) => (
              <div key={s.name} className={styles.subjectContainer}>
                <h4>{s.name}</h4>

                {s.terms.map((t) => (
                  <div key={t.term} className={styles.termContainer}>
                    <strong>Term {t.term}</strong>
                    <ul>
                      {t.weeks.map((w) => (
                        <li key={`${t.term}-${w.week}`}>
                          Week {w.week}: {w.title}{" "}
                          <span className={styles.lessonLabel}>({w.lesson})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </section>

      <hr className={styles.divider} />

      <section>
        <h2>Demo Lesson Render</h2>
        {!firstWeek ? (
          <p>No lesson found in outline.json yet.</p>
        ) : (
          <>
            <p>
              Showing: <strong>{firstWeek.title}</strong>
            </p>
            <article
              className={styles.article}
              dangerouslySetInnerHTML={{ __html: demoHtml }}
            />
          </>
        )}
      </section>

      <p className={styles.footer}>
        <Link href="/">Back home</Link>
      </p>
    </main>
  );
}
