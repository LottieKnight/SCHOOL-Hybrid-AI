import type { Metadata } from "next";
import Link from "next/link";
import econ211 from "../../../../../content/modules-generated/econ211.generated.json";
import { FlashcardDeck } from "@/components/intelligence/FlashcardDeck";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";

type Flashcard = {
  id?: string;
  chapter: string;
  front: string;
  back: string;
};

type ChapterStudyItem = {
  chapter: string;
  flashcards?: Flashcard[];
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
  chapterStudyItems?: ChapterStudyItem[];
};

const content = econ211 as Econ211Content;

export const metadata: Metadata = {
  title: "ECON211 Notes",
  description: "ECON211 notes, flashcards, and revision checkpoints inside SCHOOL.",
};

function getAllFlashcards(chapters: ChapterStudyItem[]) {
  return chapters.flatMap((chapter) => chapter.flashcards ?? []);
}

export default function Econ211NotesPage() {
  const chapters = content.chapterStudyItems ?? [];
  const allFlashcards = getAllFlashcards(chapters);
  const keyTopics = (content.keyTopics ?? []).slice(0, 8);
  const commonErrors = (content.commonExamErrors ?? []).slice(0, 6);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="glass card" style={{ padding: 20, display: "grid", gap: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <Badge variant="gold">ECON211 Notes</Badge>
          <h1 style={{ margin: 0 }}>ECON211 chapter notes and flashcards</h1>
          <p className="assistant-helper" style={{ margin: 0, maxWidth: 920 }}>
            This is the fastest path to the module notes. Use the chapter map to jump straight into flashcards, key concepts, and exam traps for the ECON211 Macroeconomics syllabus.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/university/modules/econ211" className="button skeu-btn">
            Back to ECON211 module
          </Link>
          <Link href="/university/modules/econ211/past-papers" className="button skeu-btn-ghost">
            Open past papers
          </Link>
          <Link href="/tutor?q=Explain%20ECON211%20notes" className="button skeu-btn-ghost">
            Ask AI about these notes
          </Link>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className="assistant-context-chip">Module: ECON211</span>
          <span className="assistant-context-chip">{chapters.length} chapters</span>
          <span className="assistant-context-chip">{allFlashcards.length} flashcards</span>
          <span className="assistant-context-chip">North-West University</span>
        </div>
      </section>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1.05fr 0.95fr" }}>
        <SectionCard title="Chapter map" description="Jump to the exact chapter notes you need right now.">
          <div style={{ display: "grid", gap: 10 }}>
            {chapters.map((chapter) => {
              const count = chapter.flashcards?.length ?? 0;
              const anchor = chapter.chapter.toLowerCase().replace(/\s+/g, "-");
              return (
                <a
                  key={chapter.chapter}
                  href={`#${anchor}`}
                  className="glass"
                  style={{ borderRadius: 14, padding: 14, display: "grid", gap: 6, color: "inherit", textDecoration: "none" }}
                >
                  <strong>{chapter.chapter}</strong>
                  <span className="text-dim">{count} flashcards in this chapter</span>
                </a>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Quick revision" description="Use this deck for a fast pass before you dive into a specific chapter.">
          <FlashcardDeck cards={allFlashcards} />
        </SectionCard>
      </div>

      <SectionCard title="Key topics" description="The high-frequency concepts that keep showing up across notes and exam questions.">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {keyTopics.map((topic) => (
            <span key={topic} className="assistant-context-chip">
              {topic}
            </span>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Exam traps" description="The mistakes to avoid while revising these notes.">
        <div style={{ display: "grid", gap: 10 }}>
          {commonErrors.map((error) => (
            <div key={error} className="glass" style={{ borderRadius: 14, padding: 12, lineHeight: 1.6 }}>
              {error}
            </div>
          ))}
        </div>
      </SectionCard>

      <div style={{ display: "grid", gap: 16 }}>
        {chapters.map((chapter) => {
          const anchor = chapter.chapter.toLowerCase().replace(/\s+/g, "-");
          const cards = chapter.flashcards ?? [];
          return (
            <SectionCard
              key={chapter.chapter}
              title={chapter.chapter}
              description={`Flashcards and revision notes for ${chapter.chapter}.`}
              id={anchor}
            >
              <div style={{ display: "grid", gap: 12 }}>
                {cards.map((card) => (
                  <div key={card.id ?? `${chapter.chapter}-${card.front}`} className="glass" style={{ borderRadius: 16, padding: 16, display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <Badge variant="gold">Question</Badge>
                      <strong>{card.front}</strong>
                    </div>
                    <div className="glass" style={{ borderRadius: 12, padding: 12, lineHeight: 1.6 }}>
                      {card.back}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}
