import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import econ211 from "../../../../../content/modules-generated/econ211.generated.json";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ECON211 Past Papers & Practice Exams",
  description: "NWU ECON211 Macroeconomics past paper practice sets for June first opportunity exams.",
};

type QuizItem = {
  id: string;
  chapter: string;
  questionType: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
};

type ChapterStudyItem = {
  chapter: string;
  flashcards: { front: string; back: string }[];
  quizItems: QuizItem[];
};

type AssessmentItem = {
  name: string;
  weight?: string;
  chaptersCovered?: string;
  format?: string;
};

const content = econ211 as {
  moduleCode: string;
  moduleName: string;
  assessmentPlan?: AssessmentItem[];
  questionTypes?: string[];
  chapterStudyItems?: ChapterStudyItem[];
  commonExamErrors?: string[];
  chapters?: string[];
};

const JUNE_EXAM_STRUCTURE = [
  { section: "Section A", description: "Multiple Choice Questions (MCQ)", marks: "20", tip: "Each question has one correct answer. Eliminate obviously wrong options first." },
  { section: "Section B", description: "True/False with written justification", marks: "20", tip: "Full marks require both the True/False answer AND a complete explanation." },
  { section: "Section C", description: "Chain reaction questions", marks: "30", tip: "Always state PE and SE separately. SE must be in opposite direction to PE but smaller." },
  { section: "Section D", description: "Diagram questions (IS-LM, AD-AS, BP)", marks: "30", tip: "Label all axes, curves (IS₀, IS₁, LM₀, LM₁), equilibrium points (E₀, E₁), and shift arrows." },
  { section: "Section E", description: "Calculation questions", marks: "25", tip: "Show all working. A correct method with arithmetic error still earns partial marks." },
  { section: "Section F", description: "Long essay — policy analysis", marks: "25", tip: "Use IS-LM or AD-AS framework explicitly. Integrate chain reaction method." },
];

function getAllMCQs(): QuizItem[] {
  return (content.chapterStudyItems ?? []).flatMap((item) =>
    item.quizItems.filter((q) => q.questionType === "multiple-choice")
  );
}

function getQuizByChapter(chapter: string): QuizItem[] {
  const item = (content.chapterStudyItems ?? []).find((i) => i.chapter === chapter);
  return item?.quizItems ?? [];
}

function QuestionCard({ q, idx }: { q: QuizItem; idx: number }) {
  return (
    <div className="glass" style={{ borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <Badge
          variant={q.questionType === "multiple-choice" ? "gold" : "amber"}
          style={{ flexShrink: 0, marginTop: 2 }}
        >
          {q.questionType === "multiple-choice" ? "MCQ" : "T/F"}
        </Badge>
        <p style={{ margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
          Q{idx + 1}. {q.prompt}
        </p>
      </div>
      {q.options.length > 0 && (
        <ol type="A" style={{ margin: "0 0 0 20px", padding: 0, display: "grid", gap: 4 }}>
          {q.options.map((opt) => (
            <li key={opt} style={{ lineHeight: 1.5 }}>{opt}</li>
          ))}
        </ol>
      )}
      <details style={{ marginTop: 4 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-dim, #888)", userSelect: "none" }}>
          Show answer &amp; explanation
        </summary>
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge variant="green">Answer</Badge>
            <strong>{q.answer}</strong>
          </div>
          <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14 }}>{q.explanation}</p>
        </div>
      </details>
    </div>
  );
}

function SignUpGate({ returnPath }: { returnPath: string }) {
  return (
    <div
      style={{
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      {/* Blurred preview beneath */}
      <div
        aria-hidden="true"
        style={{
          filter: "blur(6px)",
          opacity: 0.45,
          pointerEvents: "none",
          userSelect: "none",
          display: "grid",
          gap: 8,
        }}
      >
        {[
          "Which of the following best describes crowding out in the IS-LM model?",
          "True or False: Under a fixed exchange rate, expansionary monetary policy is highly effective.",
          "The IS curve shifts right when government spending increases. What is the secondary effect?",
        ].map((q, i) => (
          <div key={i} className="glass" style={{ borderRadius: 14, padding: 14 }}>
            <p style={{ margin: 0, fontWeight: 500, lineHeight: 1.6 }}>Q{i + 1}. {q}</p>
            <ol type="A" style={{ margin: "8px 0 0 20px", padding: 0, display: "grid", gap: 4 }}>
              <li>Option A</li>
              <li>Option B</li>
              <li>Option C</li>
              <li>Option D</li>
            </ol>
          </div>
        ))}
      </div>

      {/* Overlay CTA */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "linear-gradient(to bottom, transparent 0%, var(--bg-glass, rgba(0,0,0,0.6)) 40%)",
          backdropFilter: "blur(2px)",
          borderRadius: 20,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <Badge variant="gold" style={{ justifySelf: "center" }}>Free account required</Badge>
          <h3 style={{ margin: 0, fontSize: 22 }}>Unlock all practice papers</h3>
          <p style={{ margin: 0, maxWidth: 420, lineHeight: 1.6, fontSize: 15 }}>
            Create a free SCHOOL account to access all practice exam papers, the full MCQ drill, chapter readiness checklist, and common exam error guide.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link
            href={`/auth/signup?next=${encodeURIComponent(returnPath)}`}
            className="button skeu-btn"
            style={{ fontSize: 16, padding: "12px 28px" }}
          >
            Sign up free
          </Link>
          <Link
            href={`/auth?next=${encodeURIComponent(returnPath)}`}
            className="button skeu-btn-ghost"
          >
            Log in
          </Link>
        </div>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7 }}>
          No credit card required &middot; Takes 30 seconds
        </p>
      </div>
    </div>
  );
}

export default async function Econ211PastPapersPage() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  const isLoggedIn = Boolean(session?.user?.id);

  const mcqs = getAllMCQs();
  const allQuestions = mcqs.length + (content.chapterStudyItems ?? []).flatMap((i) => i.quizItems.filter((q) => q.questionType === "short-answer")).length;
  const returnPath = "/university/modules/econ211/past-papers";

  const ch1Questions = getQuizByChapter("Chapter 1");
  const ch2aQuestions = getQuizByChapter("Chapter 2A");
  const ch2bQuestions = getQuizByChapter("Chapter 2B");
  const ch3Questions = getQuizByChapter("Chapter 3");
  const ch4Questions = getQuizByChapter("Chapter 4");
  const ch6Questions = getQuizByChapter("Chapter 6");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Header */}
      <section className="glass card" style={{ padding: 20, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <Badge variant="gold">June 2026 — First Opportunity</Badge>
          <h1 style={{ margin: 0 }}>ECON211 Past Papers &amp; Practice Exams</h1>
          <p className="assistant-helper" style={{ margin: 0, maxWidth: 920 }}>
            Practice exam sets for ECON211 Macroeconomics (NWU). Covers all six chapters tested in the June first-opportunity paper: Chapter 1, Chapter 2A, Chapter 2B, Chapter 3, Chapter 4, Chapter 6.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/university/modules/econ211/notes" className="button skeu-btn-ghost">
            Open notes
          </Link>
          <Link href="/university/modules/econ211" className="button skeu-btn">
            Back to ECON211 module
          </Link>
          <Link href="/tutor?q=Generate%20an%20ECON211%20practice%20exam%20question" className="button skeu-btn-ghost">
            Ask AI for more practice
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="assistant-context-chip">Module: ECON211</span>
          <span className="assistant-context-chip">Chapters: 1, 2A, 2B, 3, 4, 6</span>
          <span className="assistant-context-chip">{allQuestions} practice questions</span>
          <span className="assistant-context-chip">Exam weight: 40%</span>
          {!isLoggedIn && (
            <span className="assistant-context-chip" style={{ color: "var(--color-gold, #c9a227)" }}>
              Preview mode — sign up to unlock all
            </span>
          )}
        </div>
      </section>

      {/* NWU eFundi access instructions — always visible */}
      <SectionCard
        title="Access NWU Official Past Papers"
        description="NWU past papers are available through eFundi (the NWU learning management system) and the NWU Library portal."
      >
        <div style={{ display: "grid", gap: 10 }}>
          <div className="glass" style={{ borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge variant="green">Step 1</Badge>
              <strong>Log in to NWU eFundi</strong>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              Go to <strong>efundi.nwu.ac.za</strong> and sign in with your NWU student credentials. Navigate to the ECON211 course site. Your lecturer (Dr. Khwazi Magubane) typically posts past papers under the <em>Resources</em> or <em>Past Assessments</em> section.
            </p>
          </div>

          <div className="glass" style={{ borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge variant="green">Step 2</Badge>
              <strong>NWU Library — Past Exam Papers Portal</strong>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              The NWU Library hosts past exam papers at <strong>library.nwu.ac.za</strong>. Search for <em>ECON211</em> under the Past Exam Papers section. Papers from 2018–2024 are typically available. You will need your NWU library card or student login.
            </p>
          </div>

          <div className="glass" style={{ borderRadius: 14, padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Badge variant="amber">Tip</Badge>
              <strong>Request from your lecturer</strong>
            </div>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              If past papers are not posted on eFundi, email Dr. Magubane directly or ask during tutorial sessions. NWU lecturers are generally willing to share previous June and November papers, especially for first-opportunity preparation.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* June Exam Structure — always visible */}
      <SectionCard
        title="June Exam Paper Structure"
        description="Understanding the format helps you plan your time. Total: 150 marks, 3 hours."
      >
        <div style={{ display: "grid", gap: 10 }}>
          {JUNE_EXAM_STRUCTURE.map((section) => (
            <div key={section.section} className="glass" style={{ borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{section.section}</strong>
                <Badge variant="neutral">{section.marks} marks</Badge>
                <span>{section.description}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--text-dim, #888)" }}>
                {section.tip}
              </p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Practice Paper 1 — Chapter 1 always visible as free preview */}
      <SectionCard
        title="Practice Paper 1 — Foundations (Chapters 1, 2A, 2B)"
        description="Covers GDP, business cycles, Keynesian model, money market. Approximately 75 marks."
        actions={<Badge variant="gold">Practice</Badge>}
      >
        {/* Chapter 1 always shown as free preview */}
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>Chapter 1</h3>
              <Badge variant="green">Free preview</Badge>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {ch1Questions.map((q, idx) => (
                <QuestionCard key={q.id} q={q} idx={idx} />
              ))}
            </div>
          </div>

          {isLoggedIn ? (
            <>
              {[{ chapter: "Chapter 2A", questions: ch2aQuestions }, { chapter: "Chapter 2B", questions: ch2bQuestions }].map(({ chapter, questions }) =>
                questions.length > 0 ? (
                  <div key={chapter}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>{chapter}</h3>
                    <div style={{ display: "grid", gap: 8 }}>
                      {questions.map((q, idx) => (
                        <QuestionCard key={q.id} q={q} idx={idx} />
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </>
          ) : (
            <SignUpGate returnPath={returnPath} />
          )}
        </div>
      </SectionCard>

      {/* Practice Papers 2 & 3 — gated */}
      {isLoggedIn ? (
        <>
          <SectionCard
            title="Practice Paper 2 — IS-LM &amp; Open Economy (Chapters 3 &amp; 4)"
            description="Covers IS-LM equilibrium, fiscal and monetary policy, Mundell-Fleming, BP curve."
            actions={<Badge variant="gold">Practice</Badge>}
          >
            <div style={{ display: "grid", gap: 12 }}>
              {[{ chapter: "Chapter 3", questions: ch3Questions }, { chapter: "Chapter 4", questions: ch4Questions }].map(({ chapter, questions }) =>
                questions.length > 0 ? (
                  <div key={chapter}>
                    <h3 style={{ margin: "0 0 8px 0", fontSize: 16 }}>{chapter}</h3>
                    <div style={{ display: "grid", gap: 8 }}>
                      {questions.map((q, idx) => (
                        <QuestionCard key={q.id} q={q} idx={idx} />
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Practice Paper 3 — Aggregate Demand &amp; Supply (Chapter 6)"
            description="Covers AD derivation, SRAS, LRAS, stagflation, accommodation dilemma."
            actions={<Badge variant="gold">Practice</Badge>}
          >
            <div style={{ display: "grid", gap: 8 }}>
              {ch6Questions.map((q, idx) => (
                <QuestionCard key={q.id} q={q} idx={idx} />
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Section A Drill — All MCQs (All Chapters)"
            description="Timed drill for Section A of the June paper. All multiple-choice questions across all 6 chapters."
            actions={<Badge variant="neutral">{mcqs.length} questions</Badge>}
          >
            <div style={{ display: "grid", gap: 8 }}>
              {mcqs.map((q, idx) => (
                <div key={q.id} className="glass" style={{ borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span className="assistant-context-chip" style={{ flexShrink: 0 }}>{q.chapter}</span>
                    <p style={{ margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
                      {idx + 1}. {q.prompt}
                    </p>
                  </div>
                  <ol type="A" style={{ margin: "0 0 0 20px", padding: 0, display: "grid", gap: 4 }}>
                    {q.options.map((opt) => (
                      <li key={opt} style={{ lineHeight: 1.5 }}>{opt}</li>
                    ))}
                  </ol>
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--text-dim, #888)", userSelect: "none" }}>
                      Show answer
                    </summary>
                    <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <Badge variant="green">Answer</Badge>
                        <strong>{q.answer}</strong>
                      </div>
                      <p style={{ margin: 0, lineHeight: 1.6, fontSize: 14 }}>{q.explanation}</p>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="June Exam Readiness Checklist"
            description="Tick off each item before sitting the exam. If you cannot confidently do any item, revise that chapter."
          >
            <div style={{ display: "grid", gap: 8 }}>
              {[
                { chapter: "Chapter 1", items: ["Calculate real GDP from nominal GDP and price level", "Name SA's 5 macroeconomic policy objectives", "State circular flow equilibrium: S+T+M = I+G+X", "Trace a full chain reaction with PE and SE", "Identify all 4 business cycle phases"] },
                { chapter: "Chapter 2A", items: ["Write and interpret C = a + b(1−t)Y", "Calculate expenditure multiplier KE = 1/(1−b(1−t)+m)", "Draw and label a Keynesian Cross diagram", "Calculate ΔY from a ΔG using the multiplier"] },
                { chapter: "Chapter 2B", items: ["Apply Fisher equation: r = i − π", "State Keynes's 3 money demand motives", "Distinguish MD curve SHIFT vs movement ALONG", "Calculate theoretical credit multiplier = 1/R", "Explain SARB's 3 monetary policy tools"] },
                { chapter: "Chapter 3", items: ["Explain why IS slopes down; LM slopes up", "State the Golden Rule for IS-LM policy", "Trace full fiscal expansion PE and SE (crowding out)", "Trace full monetary expansion PE and SE", "Solve IS-LM system of equations for r* and Y*", "Explain liquidity trap vs classical range"] },
                { chapter: "Chapter 4", items: ["State BoP = CA + FA and explain each", "Draw and label BP curve", "Apply Mundell-Fleming: Fixed=Fiscal, Float=Monetary", "Calculate rand price of imported good after depreciation", "Explain SA's hot money vulnerability"] },
                { chapter: "Chapter 6", items: ["Derive AD from IS-LM", "Distinguish SRAS (upward) from LRAS (vertical)", "Analyse negative supply shock → stagflation", "Explain accommodation dilemma", "Trace long-run adjustment after AD expansion"] },
              ].map(({ chapter, items }) => (
                <div key={chapter} className="glass" style={{ borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
                  <strong>{chapter}</strong>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4, lineHeight: 1.6 }}>
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Common Exam Errors — Avoid These"
            description="Mistakes that cost students marks every year in ECON211. Review these before the exam."
            actions={<Badge variant="red">Critical</Badge>}
          >
            <div style={{ display: "grid", gap: 8 }}>
              {(content.commonExamErrors ?? []).map((error, idx) => (
                <div key={idx} className="glass" style={{ borderRadius: 14, padding: 12, display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.6 }}>
                  <Badge variant="red" style={{ flexShrink: 0, marginTop: 2 }}>{idx + 1}</Badge>
                  <span>{error}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      ) : (
        /* Teaser cards for logged-out users */
        <div style={{ display: "grid", gap: 16 }}>
          {[
            { title: "Practice Paper 2 — IS-LM & Open Economy", description: "Chapters 3 & 4 · IS-LM equilibrium, fiscal and monetary policy, Mundell-Fleming, BP curve." },
            { title: "Practice Paper 3 — Aggregate Demand & Supply", description: "Chapter 6 · AD derivation, SRAS, LRAS, stagflation, accommodation dilemma." },
            { title: `Section A Drill — ${mcqs.length} MCQs across all chapters`, description: "Timed multiple-choice drill mirroring the June Section A format." },
            { title: "June Exam Readiness Checklist", description: "30 specific competencies to tick off before sitting the paper." },
            { title: "Common Exam Errors — Critical", description: "10 high-frequency mistakes that cost students marks every year." },
          ].map(({ title, description }) => (
            <div key={title} className="glass card" style={{ padding: 20, display: "grid", gap: 10, position: "relative", overflow: "hidden" }}>
              <div style={{ filter: "blur(1px)", opacity: 0.5 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
                <p style={{ margin: 0, lineHeight: 1.6 }}>{description}</p>
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: 20, flexWrap: "wrap" }}>
                <Badge variant="neutral">Locked</Badge>
                <Link href={`/auth/signup?next=${encodeURIComponent(returnPath)}`} className="button skeu-btn">
                  Sign up free to unlock
                </Link>
                <Link href={`/auth?next=${encodeURIComponent(returnPath)}`} className="button skeu-btn-ghost">
                  Log in
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
