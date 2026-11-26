import type { Metadata } from "next";
import Link from "next/link";
import { GroundedExplainPanel } from "@/components/intelligence/GroundedExplainPanel";
import { InlineExplainButton } from "@/components/intelligence/InlineExplainButton";
import { LanguageSearchPanel } from "@/components/intelligence/LanguageSearchPanel";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";

type Concept = {
  name: string;
  examCue: string;
  summary: string;
};

type Chapter = {
  id: string;
  title: string;
  theme: "amber" | "neutral" | "green";
  pages: string;
  summary: string;
  concepts: Concept[];
};

const chapters: Chapter[] = [
  {
    id: "ch3",
    title: "Chapter 3 · Business Ethics foundations",
    theme: "amber",
    pages: "pp. 51–74",
    summary:
      "Business ethics is treated as an interpretive process. The chapter frames ethical analysis through existentialism, accountability, recognition, dialogue, and fairness.",
    concepts: [
      {
        name: "Existentialism",
        examCue: "Freedom, authenticity, bad faith",
        summary:
          "Meaning is created through choice and responsibility. Key names in the stream around this idea include Sartre, Heidegger, Nietzsche, and Kierkegaard.",
      },
      {
        name: "Accountability",
        examCue: "Mandatory and voluntary accountability",
        summary:
          "Business action is embodied and collective. Ethical judgment cannot isolate an action from the wider workplace and its shared responsibilities.",
      },
      {
        name: "The Other and recognition",
        examCue: "Identity is partly shaped by recognition",
        summary:
          "Recognition or misrecognition affects identity and dignity. Ethical business practice must take relational harm seriously.",
      },
      {
        name: "Dialogue",
        examCue: "Collective meaning-making",
        summary:
          "Dialogue goes beyond information exchange. It implies active listening, mutual respect, and equal participation in decision-making.",
      },
      {
        name: "Fairness",
        examCue: "Justice without coercion",
        summary:
          "Fairness links business ethics to justice traditions, including Aristotle, Mill, Bentham, Marx, and Rawls.",
      },
    ],
  },
  {
    id: "ch7",
    title: "Chapter 7 · Ethics theories",
    theme: "neutral",
    pages: "pp. 155–170",
    summary:
      "This chapter moves from describing business behaviour to critically evaluating it through normative ethical frameworks.",
    concepts: [
      {
        name: "Descriptive vs normative ethics",
        examCue: "Uncritical description vs moral evaluation",
        summary:
          "Descriptive ethics reports what happens. Normative ethics asks whether actions are morally justified.",
      },
      {
        name: "Moral egoism",
        examCue: "Self-interest",
        summary:
          "Associated with Adam Smith, Ayn Rand, and Hobbes. The core tension is whether self-interest can be morally sufficient in business life.",
      },
      {
        name: "Moral altruism",
        examCue: "Social welfare",
        summary:
          "This positions the good of others and the common good as central, not secondary, to ethical reasoning.",
      },
      {
        name: "Moral relativism",
        examCue: "Ethics as context-sensitive",
        summary:
          "Ethical rules are shaped by social and cultural context, but harmful practices are still open to critique.",
      },
      {
        name: "Moral absolutism and deontology",
        examCue: "Kant and the categorical imperative",
        summary:
          "Some actions are right or wrong regardless of outcome. Universal principles and duties matter.",
      },
      {
        name: "Consequentialism",
        examCue: "Greatest happiness for the greatest number",
        summary:
          "Outcomes determine moral worth. This is the classic utilitarian line associated with Mill.",
      },
    ],
  },
  {
    id: "ch8",
    title: "Chapter 8 · African Moral Theory",
    theme: "green",
    pages: "pp. 171–196",
    summary:
      "African Moral Theory contributes a relational, community-shaped ethics grounded in Ubuntu, duty, and the common good.",
    concepts: [
      {
        name: "Ubuntu",
        examCue: '"I am because we are"',
        summary:
          "Personhood is realised through belonging, interdependence, and shared humanity rather than radical individual isolation.",
      },
      {
        name: "AMT humanism",
        examCue: "Human welfare at the centre",
        summary:
          "African ethics centres human flourishing and collective wellbeing rather than purely divine command or private gain.",
      },
      {
        name: "Communal personhood",
        examCue: "Community shapes identity",
        summary:
          "Duties to self, others, and community structure ethical life. The self is formed within relationships.",
      },
      {
        name: "Common good and social morality",
        examCue: "Collective good over isolated interest",
        summary:
          "The moral horizon is social. Duties to the community can outweigh narrow individual preference.",
      },
      {
        name: "Cosmopolitan humanity",
        examCue: "One universal human family",
        summary:
          "Ubuntu can scale from local belonging to global citizenship and shared responsibility.",
      },
    ],
  },
  {
    id: "ch9",
    title: "Chapter 9 · Business theories and governance",
    theme: "neutral",
    pages: "pp. 199–214",
    summary:
      "The final stream turns ethics into organisational design questions: who matters, who decides, and how governance should work.",
    concepts: [
      {
        name: "Shareholder theory",
        examCue: "Profit maximisation within the law",
        summary:
          "Associated with Friedman. It prioritises owners and financial return, but is often criticised for short-termism.",
      },
      {
        name: "Agency theory",
        examCue: "Principals vs agents",
        summary:
          "Managers and owners may have different incentives, goals, and risk preferences, creating governance tension.",
      },
      {
        name: "Stakeholder theory",
        examCue: "Balance all stakeholder interests",
        summary:
          "Freeman broadens the field beyond shareholders to include workers, communities, suppliers, and other affected parties.",
      },
      {
        name: "Stewardship theory",
        examCue: "Trust over control",
        summary:
          "Managers are treated as responsible stewards rather than default opportunists needing heavy surveillance.",
      },
      {
        name: "Resource dependency",
        examCue: "External resource power",
        summary:
          "Organisations depend on outside actors for critical resources, so governance is shaped by external power relations too.",
      },
    ],
  },
];

const crossLinks = [
  ["Moral egoism", "Shareholder theory", "self-interest drives profit"],
  ["Moral altruism", "Stakeholder theory", "broader social interests"],
  ["Ubuntu", "The Other and recognition", "personhood through community"],
  ["Accountability", "Agency theory", "principal-agent accountability"],
  ["Dialogue", "Stakeholder theory", "inclusive decision-making"],
  ["Fairness", "Consequentialism", "just outcomes for all"],
  ["Communal personhood", "Moral relativism", "community-shaped ethics"],
  ["Common good", "Moral altruism", "social welfare principle"],
  ["Ubuntu", "Stakeholder theory", "communal corporate responsibility"],
  ["Existentialism", "Agency theory", "bad faith in management"],
] as const;

const thinkers = [
  "Sartre",
  "Heidegger",
  "Kierkegaard",
  "Nietzsche",
  "Charles Taylor",
  "Rawls",
  "Kant",
  "Mill",
  "Adam Smith",
  "Ayn Rand",
  "Hume",
  "Aristotle",
  "Mbiti",
  "Tutu",
  "Gyekye",
  "Freeman",
  "Friedman",
];

const studySprint = [
  "Start with Chapter 3 so the philosophical language is clear before governance theories show up.",
  "Pair each Chapter 7 theory with one real business decision example.",
  "Treat Ubuntu, communal personhood, and common good as a trio when revising Chapter 8.",
  "Compare stakeholder, shareholder, agency, and stewardship theory as a single exam table, not four isolated definitions.",
];

const selfCheck = [
  {
    q: "Why is the move from descriptive ethics to normative ethics important in business ethics?",
    a: "Because WVES312 is not just about reporting what businesses do. It is about judging whether those actions are morally justified.",
  },
  {
    q: "How does Ubuntu challenge a narrow shareholder-first model?",
    a: "Ubuntu frames personhood and responsibility relationally, so the business cannot be reduced to owners alone; community and stakeholder impact matter.",
  },
  {
    q: "What is the core tension between agency theory and stewardship theory?",
    a: "Agency theory assumes conflict and the need for control; stewardship theory assumes trust, intrinsic motivation, and responsible care.",
  },
  {
    q: "How can fairness connect Chapter 3 to consequentialism in Chapter 7?",
    a: "Both ask whether outcomes and structures are justifiable for affected people, though fairness also keeps pressure on coercion and equality.",
  },
];

export const metadata: Metadata = {
  title: "WVES312",
  description: "WVES312 Business Ethics learning-content mock-up inside SCHOOL.",
  openGraph: {
    title: "WVES312 | SCHOOL",
    description: "WVES312 Business Ethics learning-content mock-up inside SCHOOL.",
    url: "/university/modules/wves312",
    images: ["/images/icons/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "WVES312 | SCHOOL",
    description: "WVES312 Business Ethics learning-content mock-up inside SCHOOL.",
    images: ["/images/icons/og-image.png"],
  },
};

export default function Wves312ModulePage() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="glass card" style={{ padding: 20, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <Badge variant="amber">University module mock-up</Badge>
          <h1 style={{ margin: 0 }}>WVES312 · Business Ethics</h1>
          <p className="assistant-helper" style={{ margin: 0, maxWidth: 900 }}>
            Native SCHOOL version of the first WVES312 learning-content prototype. The old standalone concept-map site has been folded into the product and reorganised into chapter summaries, concept cards, cross-links, and exam cues.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/university/learning" className="button skeu-btn">Back to learning path</Link>
          <Link href="/community/rooms/WVES312?onboarding_complete=1" className="button skeu-btn-ghost">Open module room</Link>
          <Link href="/tutor?q=Explain%20WVES312%20business%20ethics%20concepts" className="button skeu-btn-ghost">Ask AI about WVES312</Link>
        </div>
      </section>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.1fr 0.9fr" }}>
        <LanguageSearchPanel
          moduleCode="WVES312"
          title="Language-aware WVES312 search"
          description="Search ethics concepts, study-unit terms, or mixed wording. SCHOOL will infer the right module context and retrieve grounded results."
        />
        <GroundedExplainPanel
          moduleCode="WVES312"
          title="Grounded concept explainer"
          description="Explain a WVES312 concept with module-aware grounding so the answer stays anchored to the course context."
          suggestions={["Ubuntu", "stakeholder theory", "accountability", "moral relativism"]}
        />
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "2fr 1fr" }}>
        <SectionCard
          title="Module spine"
          description="Four chapter clusters make up the current mock-up. Use this as the scaffold for future lesson, quiz, and flashcard generation."
        >
          <div style={{ display: "grid", gap: 12 }}>
            {chapters.map((chapter) => (
              <div key={chapter.id} className="glass" style={{ borderRadius: 16, padding: 16, display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{chapter.title}</h2>
                  <Badge variant={chapter.theme}>{chapter.pages}</Badge>
                </div>
                <p style={{ margin: 0, color: "var(--text-muted, #b8b6b0)", lineHeight: 1.6 }}>{chapter.summary}</p>
                <div style={{ display: "grid", gap: 10 }}>
                  {chapter.concepts.map((concept) => (
                    <article key={concept.name} className="glass" style={{ borderRadius: 14, padding: 14, display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 15 }}>{concept.name}</h3>
                        <Badge variant="neutral">Exam cue</Badge>
                      </div>
                      <p style={{ margin: 0, fontWeight: 600 }}>{concept.examCue}</p>
                      <p style={{ margin: 0, color: "var(--text-muted, #b8b6b0)", lineHeight: 1.6 }}>{concept.summary}</p>
                      <InlineExplainButton moduleCode="WVES312" concept={concept.name} />
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div style={{ display: "grid", gap: 16 }}>
          <SectionCard title="Cross-links" description="The original concept map was useful because it showed chapter-to-chapter bridges. Keep those visible in-product.">
            <div style={{ display: "grid", gap: 10 }}>
              {crossLinks.map(([left, right, note]) => (
                <div key={`${left}-${right}`} className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <strong>{left} → {right}</strong>
                  <span style={{ color: "var(--text-muted, #b8b6b0)", lineHeight: 1.5 }}>{note}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Thinkers to know" description="Names that recur across the current WVES312 prototype and are worth pinning for revision.">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {thinkers.map((thinker) => (
                <Badge key={thinker} variant="neutral">{thinker}</Badge>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Study sprint" description="A tighter revision path so the page feels like learning content, not just documentation.">
            <ol style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, lineHeight: 1.6 }}>
              {studySprint.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="Self-check" description="Fast oral-exam style prompts to test whether the chapter links are actually sticking.">
            <div style={{ display: "grid", gap: 10 }}>
              {selfCheck.map((item) => (
                <div key={item.q} className="glass" style={{ borderRadius: 14, padding: 12, display: "grid", gap: 6 }}>
                  <strong>{item.q}</strong>
                  <span style={{ color: "var(--text-muted, #b8b6b0)", lineHeight: 1.5 }}>{item.a}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="What this mock-up proves" description="This is now a SCHOOL-native content page, not a detached microsite.">
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, lineHeight: 1.6 }}>
              <li>WVES312 can live inside the main university learning flow.</li>
              <li>The chapter structure is now reusable for quizzes, summaries, AI tutoring, and assignment prep.</li>
              <li>Cross-links from the old map have been preserved as explicit concept relationships.</li>
              <li>The page is easier to maintain than embedding raw standalone HTML.</li>
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
