import type { Metadata } from "next";
import Link from "next/link";
import econ211 from "../../../../content/modules-generated/econ211.generated.json";
import { GroundedExplainPanel } from "@/components/intelligence/GroundedExplainPanel";
import { InlineExplainButton } from "@/components/intelligence/InlineExplainButton";
import { LanguageSearchPanel } from "@/components/intelligence/LanguageSearchPanel";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";

type AssessmentItem = {
  name: string;
  weight?: string;
  chaptersCovered?: string;
  format?: string;
};

type PolicyEffectRow = {
  shock: string;
  curvesShifting: string;
  primaryEffect: string;
  secondaryEffect: string;
  netR: string;
  netY: string;
  netP: string;
};

type ChapterInsight = {
  chapter: string;
  title: string;
  definitions?: string[];
  formulas?: string[];
  saContext?: string;
};

type Econ211Content = {
  moduleCode: string;
  moduleName: string;
  lecturer?: string;
  programme?: string;
  semester?: string;
  currentWeek?: number;
  keyTopics?: string[];
  commonExamErrors?: string[];
  assessmentPlan?: AssessmentItem[];
  questionTypes?: string[];
  chapterInsights?: ChapterInsight[];
  policyEffectsTable?: PolicyEffectRow[];
};

const content = econ211 as Econ211Content;

export const metadata: Metadata = {
  title: "ECON211",
  description: "ECON211 Macroeconomics study surface inside SCHOOL.",
};

export default function Econ211ModulePage() {
  const topConcepts = (content.keyTopics ?? []).slice(0, 12);
  const topErrors = (content.commonExamErrors ?? []).slice(0, 6);
  const chapterInsights = (content.chapterInsights ?? []).slice(0, 4);
  const policyRows = (content.policyEffectsTable ?? []).slice(0, 5);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="glass card" style={{ padding: 20, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <Badge variant="gold">Grounded module surface</Badge>
          <h1 style={{ margin: 0 }}>
            {content.moduleCode} · {content.moduleName}
          </h1>
          <p className="assistant-helper" style={{ margin: 0, maxWidth: 920 }}>
            A SCHOOL-native macroeconomics study surface grounded in generated ECON211 content: formulas, chapter insights, policy effects, common exam errors, and South African context.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/university/modules/econ211/notes" className="button skeu-btn">
            Open notes
          </Link>
          <Link href="/university/modules/econ211/past-papers" className="button skeu-btn">
            Past Papers &amp; Practice Exams
          </Link>
          <Link href="/university/learning" className="button skeu-btn-ghost">
            Back to learning path
          </Link>
          <Link href="/community/rooms/ECON211?onboarding_complete=1" className="button skeu-btn-ghost">
            Open module room
          </Link>
          <Link href="/tutor?q=Explain%20ECON211%20macroeconomics%20concepts" className="button skeu-btn-ghost">
            Ask AI about ECON211
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="assistant-context-chip">Lecturer: {content.lecturer ?? "Unknown"}</span>
          <span className="assistant-context-chip">Programme: {content.programme ?? "Unknown"}</span>
          <span className="assistant-context-chip">Semester: {content.semester ?? "Unknown"}</span>
          <span className="assistant-context-chip">Current week: {String(content.currentWeek ?? "—")}</span>
        </div>
      </section>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr 0.9fr" }}>
        <LanguageSearchPanel
          moduleCode="ECON211"
          title="Language-aware ECON211 search"
          description="Search formulas, chapter topics, policy effects, and exam pitfalls with typo-tolerant grounded retrieval."
        />
        <GroundedExplainPanel
          moduleCode="ECON211"
          title="Grounded macro explainer"
          description="Explain an ECON211 concept with module-aware grounding before falling back to generic explanation."
          suggestions={["opportunity cost", "IS-LM equilibrium", "crowding out", "liquidity trap"]}
        />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "2fr 1fr" }}>
        <SectionCard title="Core concepts" description="High-frequency ECON211 concepts to get fluent in early.">
          <div style={{ display: "grid", gap: 10 }}>
            {topConcepts.map((concept: string) => (
              <article key={concept} className="glass" style={{ borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{concept}</strong>
                  <Badge variant="neutral">Key topic</Badge>
                </div>
                <InlineExplainButton moduleCode="ECON211" concept={concept} />
              </article>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: "grid", gap: 16 }}>
          <SectionCard title="Assessment profile" description="What this module expects from you in tests and exams.">
            <div style={{ display: "grid", gap: 10 }}>
              {(content.assessmentPlan ?? []).map((item: AssessmentItem) => (
                <div key={`${item.name}-${item.weight ?? item.chaptersCovered ?? "x"}`} className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <strong>{item.name}</strong>
                  {item.weight ? <span className="text-dim">{item.weight}</span> : null}
                  {item.chaptersCovered ? <span>{item.chaptersCovered}</span> : null}
                  {item.format ? <span className="text-dim">{item.format}</span> : null}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Question types" description="The answer style matters in ECON211.">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, lineHeight: 1.6 }}>
              {(content.questionTypes ?? []).map((item: string) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.4fr 1fr" }}>
        <SectionCard title="Chapter insights" description="Grounded chapter-level outcomes, formulas, and South African context.">
          <div style={{ display: "grid", gap: 12 }}>
            {chapterInsights.map((chapter: ChapterInsight) => (
              <div key={`${chapter.chapter}-${chapter.title}`} className="glass" style={{ borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>
                    {chapter.chapter} · {chapter.title}
                  </h2>
                  <Badge variant="gold">Grounded</Badge>
                </div>
                {(chapter.definitions ?? []).slice(0, 2).map((definition: string) => (
                  <p key={definition} style={{ margin: 0, lineHeight: 1.6 }}>
                    {definition}
                  </p>
                ))}
                {(chapter.formulas ?? []).length ? (
                  <div style={{ display: "grid", gap: 6 }}>
                    <strong>Formulas</strong>
                    {(chapter.formulas ?? []).slice(0, 3).map((formula: string) => (
                      <code key={formula} className="assistant-context-chip" style={{ width: "fit-content" }}>
                        {formula}
                      </code>
                    ))}
                  </div>
                ) : null}
                {chapter.saContext ? (
                  <div className="glass" style={{ borderRadius: 12, padding: 12 }}>
                    <strong>SA context</strong>
                    <p style={{ margin: "6px 0 0 0", lineHeight: 1.6 }}>{chapter.saContext}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: "grid", gap: 16 }}>
          <SectionCard title="Common exam errors" description="Mistakes to actively avoid in tests and long answers.">
            <div style={{ display: "grid", gap: 10 }}>
              {topErrors.map((item: string) => (
                <div key={item} className="glass" style={{ borderRadius: 14, padding: 12, lineHeight: 1.55 }}>
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Policy effects table" description="Quick directional intuition for common macro shocks.">
            <div style={{ display: "grid", gap: 10 }}>
              {policyRows.map((row: PolicyEffectRow) => (
                <div key={row.shock} className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <strong>{row.shock}</strong>
                  <span className="text-dim">{row.curvesShifting}</span>
                  <span>PE: {row.primaryEffect}</span>
                  <span>SE: {row.secondaryEffect}</span>
                  <span>
                    Net: r {row.netR}, Y {row.netY}, P {row.netP}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
