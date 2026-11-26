import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ekip212 from "../../../../content/modules-generated/ekip212.generated.json";
import { GroundedExplainPanel } from "@/components/intelligence/GroundedExplainPanel";
import { InlineExplainButton } from "@/components/intelligence/InlineExplainButton";
import { LanguageSearchPanel } from "@/components/intelligence/LanguageSearchPanel";
import { Badge } from "@/components/ui/Badge";
import { SchoolLogo } from "@/components/ui/SchoolLogo";
import { SectionCard } from "@/components/ui/SectionCard";

type ScheduleItem = { label?: string; summary?: string; chapter?: string };
type AssessmentItem = { name: string; due?: string; scope?: string };
type WorkedStep = { label?: string; explanation?: string };
type WorkedExample = {
  id: string;
  chapter?: string;
  title: string;
  summary?: string;
  problem?: string;
  formula?: string;
  steps?: WorkedStep[];
  answer?: string;
  source?: string;
};
type CalculatorInput = { key: string; label: string; defaultValue?: number; min?: number; max?: number; step?: number };
type CalculatorItem = { id: string; title: string; description?: string; formulaLabel?: string; outputLabel?: string; inputs?: CalculatorInput[] };
type ChapterStudyItem = { chapter?: string; workedExamples?: WorkedExample[]; calculators?: CalculatorItem[] };
type Ekip212Content = {
  moduleCode: string;
  classSchedule?: ScheduleItem[];
  assessmentPlan?: AssessmentItem[];
  studyUnits?: string[];
  topicSeeds?: string[];
  chapterStudyItems?: ChapterStudyItem[];
};

const content = ekip212 as Ekip212Content;
const chapterStudy = (content.chapterStudyItems ?? [])[0];

export const metadata: Metadata = {
  title: "EKIP212 Trade Relations",
  description: "EKIP212 third-year extended international trade study surface inside SCHOOL.",
};

export default function Ekip212ModulePage() {
  const studyUnits = (content.studyUnits ?? []).slice(0, 8);
  const schedule = (content.classSchedule ?? []).slice(0, 8);
  const assessments = (content.assessmentPlan ?? []).slice(0, 6);
  const workedExamples = (chapterStudy?.workedExamples ?? []).slice(0, 3);
  const calculators = (chapterStudy?.calculators ?? []).slice(0, 2);
  const topicSeeds = (content.topicSeeds ?? []).slice(0, 8);
  const highlights = [
    "Year 3, Semester 1",
    "Extended programme",
    `${studyUnits.length} study units`,
    `${workedExamples.length} worked examples`,
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section
        className="glass card"
        style={{
          padding: 20,
          display: "grid",
          gap: 16,
          position: "relative",
          overflow: "hidden",
          background:
            "linear-gradient(135deg, rgba(8, 16, 30, 0.95) 0%, rgba(12, 20, 38, 0.9) 40%, rgba(21, 31, 53, 0.88) 100%)",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.22,
            pointerEvents: "none",
          }}
        >
          <Image
            src="/images/phase-background.webp"
            alt=""
            fill
            sizes="100vw"
            style={{ objectFit: "cover" }}
            priority
          />
        </div>

        <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 18, alignItems: "stretch" }}>
          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <SchoolLogo size={72} />
              <div style={{ display: "grid", gap: 6 }}>
                <Badge variant="gold">Grounded trade relations surface</Badge>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {highlights.map((item) => (
                    <span key={item} className="assistant-context-chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, maxWidth: 900 }}>
              <h1 style={{ margin: 0, fontSize: "clamp(2.2rem, 5vw, 4rem)", lineHeight: 1.02 }}>
                {content.moduleCode} · International Trade Relations
              </h1>
              <p className="assistant-helper" style={{ margin: 0, maxWidth: 820 }}>
                This is the curated EKIP212 study surface for the third-year extended programme first semester: study units, trade theory, policy instruments, worked examples, calculators, and revision checkpoints, presented with richer visual structure instead of a plain text dump.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href="/university/learning" className="button skeu-btn">Back to learning path</Link>
              <Link href="/community/rooms/EKIP212?onboarding_complete=1" className="button skeu-btn-ghost">Open module room</Link>
              <Link href="/tutor?q=Explain%20EKIP212%20international%20trade%20concepts" className="button skeu-btn-ghost">Ask AI about EKIP212</Link>
            </div>
          </div>

          <div
            className="glass"
            style={{
              borderRadius: 22,
              padding: 16,
              display: "grid",
              gap: 12,
              minHeight: 240,
              alignContent: "space-between",
              background: "linear-gradient(180deg, rgba(246, 239, 220, 0.1) 0%, rgba(6, 10, 17, 0.35) 100%)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              <span className="assistant-context-chip">Semester 1 / Year 3</span>
              <strong style={{ fontSize: 18 }}>Trade relations at a glance</strong>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                Use the study units below for theory, the worked examples for calculation practice, and the schedule spine to keep the semester pacing visible.
              </p>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span className="text-dim">Study units</span>
                <strong>{studyUnits.length}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span className="text-dim">Topic seeds</span>
                <strong>{topicSeeds.length}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span className="text-dim">Worked examples</span>
                <strong>{workedExamples.length}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <SectionCard title="Module view" description="The trade relations route is now visually curated for focused revision.">
          <div style={{ display: "grid", gap: 10 }}>
            <span className="assistant-context-chip">North-West University</span>
            <span className="assistant-context-chip">Extended programme</span>
            <span className="assistant-context-chip">Third year semester 1</span>
          </div>
        </SectionCard>
        <SectionCard title="Study approach" description="Use the page in the same order the semester unfolds.">
          <div style={{ display: "grid", gap: 10 }}>
            <span className="assistant-context-chip">Theory first</span>
            <span className="assistant-context-chip">Then worked examples</span>
            <span className="assistant-context-chip">Then calculators and review</span>
          </div>
        </SectionCard>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr 0.9fr" }}>
        <LanguageSearchPanel
          moduleCode="EKIP212"
          title="Language-aware EKIP212 search"
          description="Search study units, trade concepts, quota examples, and policy tools with grounded retrieval and clearer route framing."
        />
        <GroundedExplainPanel
          moduleCode="EKIP212"
          title="Grounded trade explainer"
          description="Explain an EKIP212 trade concept with module-aware grounding first."
          suggestions={["comparative advantage", "non-tariff barriers", "quota", "effective rate of protection"]}
        />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "2fr 1fr" }}>
        <SectionCard title="Study units and topic entry points" description="The fastest way into EKIP212 is by study unit and concrete trade-policy topics.">
          <div style={{ display: "grid", gap: 10 }}>
            {studyUnits.map((unit: string) => (
              <article key={unit} className="glass" style={{ borderRadius: 16, padding: 14, display: "grid", gap: 8, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <strong>{unit}</strong>
                  <Badge variant="neutral">Study unit</Badge>
                </div>
                <InlineExplainButton moduleCode="EKIP212" concept={unit} />
              </article>
            ))}
            {topicSeeds.map((topic: string) => (
              <article key={topic} className="glass" style={{ borderRadius: 16, padding: 14, display: "grid", gap: 8, background: "rgba(255,255,255,0.03)" }}>
                <strong>{topic}</strong>
                <InlineExplainButton moduleCode="EKIP212" concept={topic} label="Explain topic" />
              </article>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: "grid", gap: 16 }}>
          <SectionCard title="Assessment flow" description="Use the workplan to pace the module instead of studying blind.">
            <div style={{ display: "grid", gap: 10 }}>
              {assessments.map((item: AssessmentItem) => (
                <div key={`${item.name}-${item.due ?? "x"}`} className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <strong>{item.name}</strong>
                  {item.due ? <span className="text-dim">{item.due}</span> : null}
                  {item.scope ? <span>{item.scope}</span> : null}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Schedule spine" description="Workplan checkpoints extracted from the generated module content.">
            <div style={{ display: "grid", gap: 10 }}>
              {schedule.map((item: ScheduleItem) => (
                <div key={`${item.label}-${item.summary}`} className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <strong>{item.label ?? "Week"}</strong>
                  <span>{item.summary}</span>
                  {item.chapter ? <span className="assistant-context-chip">{item.chapter}</span> : null}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.5fr 1fr" }}>
        <SectionCard title="Worked examples" description="Concrete quota and protection examples make EKIP212 much easier to internalize.">
          <div style={{ display: "grid", gap: 12 }}>
            {workedExamples.map((example: WorkedExample) => (
              <div key={example.id} className="glass" style={{ borderRadius: 18, padding: 16, display: "grid", gap: 10, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{example.title}</h2>
                  {example.chapter ? <Badge variant="gold">{example.chapter}</Badge> : null}
                </div>
                {example.summary ? <p style={{ margin: 0, lineHeight: 1.6 }}>{example.summary}</p> : null}
                {example.problem ? <p style={{ margin: 0 }}><strong>Problem:</strong> {example.problem}</p> : null}
                {example.formula ? <code className="assistant-context-chip" style={{ width: "fit-content" }}>{example.formula}</code> : null}
                {(example.steps ?? []).length ? (
                  <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, lineHeight: 1.6 }}>
                    {(example.steps ?? []).map((step: WorkedStep, idx: number) => (
                      <li key={`${example.id}-${idx}`}>
                        <strong>{step.label ?? `Step ${idx + 1}`}</strong>: {step.explanation}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {example.answer ? <div className="glass" style={{ borderRadius: 12, padding: 12 }}><strong>Answer:</strong> {example.answer}</div> : null}
                {example.source ? <span className="text-dim">Source: {example.source}</span> : null}
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: "grid", gap: 16 }}>
          <SectionCard title="Calculators / tools" description="Generated tool ideas already extracted from the module pack.">
            <div style={{ display: "grid", gap: 10 }}>
              {calculators.map((item: CalculatorItem) => (
                <div key={item.id} className="glass" style={{ borderRadius: 16, padding: 12, display: "grid", gap: 6, background: "rgba(255,255,255,0.04)" }}>
                  <strong>{item.title}</strong>
                  {item.description ? <span>{item.description}</span> : null}
                  {item.formulaLabel ? <code className="assistant-context-chip" style={{ width: "fit-content" }}>{item.formulaLabel}</code> : null}
                  {(item.inputs ?? []).length ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(item.inputs ?? []).map((input: CalculatorInput) => (
                        <span key={input.key} className="assistant-context-chip">{input.label}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
