"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { AnalyzeResponse, RewriteMode } from "@/lib/language/types";
import { Button } from "@/components/ui/Button";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { FlashcardDeck } from "@/components/intelligence/FlashcardDeck";
import { VoiceRecorder } from "@/components/intelligence/VoiceRecorder";

type AssistantMode = "explain" | "quiz" | "mixed";

type QuizItem = {
  question: string;
  answer: string;
};

type AssistantResult = {
  explanation?: string;
  summary?: string;
  quiz?: {
    questions: QuizItem[];
  };
};

type LanguageRewriteResponse = {
  outputs?: Array<{
    text: string;
    confidence: number;
    notes?: string[];
  }>;
};

const MODE_IDS: AssistantMode[] = ["mixed", "explain", "quiz"];

const SUBJECT_IDS: string[] = [
  "mathematics",
  "mathematical_literacy",
  "physical_sciences",
  "life_sciences",
  "economics",
  "accounting",
  "business_studies",
  "geography",
  "history",
  "life_orientation",
];

function renderRichText(text: string): ReactNode {
  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks.map((block, index) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const isList = lines.length > 1 && lines.every((line) => /^[-*\u2022]/.test(line));

    if (isList) {
      return (
        <ul className="assistant-list" key={`block-${index}`}>
          {lines.map((line, lineIndex) => (
            <li key={`line-${lineIndex}`}>{line.replace(/^[-*\u2022]\s*/, "")}</li>
          ))}
        </ul>
      );
    }

    return (
      <div className="assistant-copy" key={`block-${index}`}>
        {lines.map((line, lineIndex) => (
          <p key={`line-${lineIndex}`}>{line}</p>
        ))}
      </div>
    );
  });
}

export default function AssistantPage() {
  const t = useTranslations("assistant");

  const MODES: Array<{ id: AssistantMode; label: string }> = MODE_IDS.map((id) => ({
    id,
    label: t(id === "mixed" ? "modeMixed" : id === "explain" ? "modeExplain" : "modeQuiz"),
  }));

  const SUBJECTS: Array<{ id: string; label: string }> = SUBJECT_IDS.map((id) => ({
    id,
    label: t(
      id === "mathematics" ? "subjectMathematics"
      : id === "mathematical_literacy" ? "subjectMathematicalLiteracy"
      : id === "physical_sciences" ? "subjectPhysicalSciences"
      : id === "life_sciences" ? "subjectLifeSciences"
      : id === "economics" ? "subjectEconomics"
      : id === "accounting" ? "subjectAccounting"
      : id === "business_studies" ? "subjectBusinessStudies"
      : id === "geography" ? "subjectGeography"
      : id === "history" ? "subjectHistory"
      : "subjectLifeOrientation"
    ),
  }));

  const prefillApplied = useRef(false);
  const [material, setMaterial] = useState("");
  const [mode, setMode] = useState<AssistantMode>("mixed");
  const [socratic, setSocratic] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (prefillApplied.current) return;
    prefillApplied.current = true;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) {
      setMaterial(t("communityPrefill", { q: decodeURIComponent(q) }));
      setMode("explain");
    }
  }, [t]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [languageInsight, setLanguageInsight] = useState<AnalyzeResponse | null>(null);
  const [languageLoading, setLanguageLoading] = useState(false);
  const [lastRewriteMode, setLastRewriteMode] = useState<RewriteMode | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submittedMaterial, setSubmittedMaterial] = useState("");
  const [memoryConceptKey, setMemoryConceptKey] = useState<string | null>(null);
  const [memoryConceptLabel, setMemoryConceptLabel] = useState<string | null>(null);
  const [isNewConcept, setIsNewConcept] = useState(false);
  const [flashcards, setFlashcards] = useState<any[] | null>(null);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [subject, setSubject] = useState<string | null>(null);
  const [sourcesFound, setSourcesFound] = useState<number | null>(null);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);

  const handleGenerateFlashcards = async () => {
    const trimmed = material.trim();
    if (!trimmed) {
      setError(t("errorPasteMaterial"));
      return;
    }

    setGeneratingCards(true);
    setFlashcards(null);
    setError(null);

    try {
      const response = await fetch("/api/intelligence/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("errorGenerateFlashcards"));
      setFlashcards(data.flashcards);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorGenerateFlashcards"));
    } finally {
      setGeneratingCards(false);
    }
  };

  const speak = (text: string) => {
    if (!voiceActive || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(t("speechNotSupported"));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-ZA";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setMaterial((prev) => (prev ? `${prev}\n\n${transcript}` : transcript));
    };

    recognition.start();
  };

  const runLanguageAnalyze = async (nextMaterial: string) => {
    const response = await fetch("/api/language/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: nextMaterial, surface: "writer", moduleCode: "ECON211" }),
    });

    const data = (await response.json().catch(() => ({}))) as AnalyzeResponse & { error?: string };
    if (!response.ok) {
      throw new Error(data?.error || t("errorAnalyzeFailed"));
    }
    setLanguageInsight(data);
    return data;
  };

  const sendLanguageFeedback = async (payload: {
    eventType: string;
    accepted?: boolean;
    editedAfterAccept?: boolean;
    rating?: number;
    note?: string;
  }) => {
    try {
      await fetch("/api/language/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionId ? { "x-session-id": sessionId } : {}),
        },
        body: JSON.stringify({
          surface: "writer",
          metadata: { moduleCode: "ECON211" },
          ...payload,
        }),
      });
    } catch {
      // best-effort only
    }
  };

  const runLanguageRewrite = async (rewriteMode: RewriteMode) => {
    const trimmed = material.trim();
    if (!trimmed) {
      setError(t("errorPasteMaterial"));
      return;
    }

    setLanguageLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/language/rewrite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: trimmed,
          mode: rewriteMode,
          surface: "writer",
          moduleCode: "ECON211",
        }),
      });

      const data = (await response.json().catch(() => ({}))) as LanguageRewriteResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data?.error || t("errorRewriteFailed"));
      }

      const rewritten = data.outputs?.[0]?.text;
      if (!rewritten) {
        throw new Error(t("errorRewriteNoText"));
      }

      setMaterial(rewritten);
      setLastRewriteMode(rewriteMode);
      setResult((prev) => ({
        explanation:
          rewriteMode === "academic_tone"
            ? t("rewriteAcademicResult")
            : t("rewriteSimplifiedResult"),
        summary: rewritten,
        quiz: prev?.quiz,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorRewriteFailed"));
    } finally {
      setLanguageLoading(false);
    }
  };

  const runAssistantRequest = async (nextMaterial: string, nextMode: AssistantMode) => {
    const response = await fetch("/api/assistant", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        material: nextMaterial,
        mode: nextMode,
        sessionId,
        socratic,
        ...(subject ? { subject } : {}),
      }),
    });

    const nextSessionId = response.headers.get("x-session-id");
    if (nextSessionId) setSessionId(nextSessionId);

    setCacheStatus(response.headers.get("x-cache"));

    const conceptKeyHeader = response.headers.get("x-memory-concept-key");
    const conceptLabelHeader = response.headers.get("x-memory-concept-label");
    const isNewConceptHeader = response.headers.get("x-memory-is-new-concept");
    setMemoryConceptKey(conceptKeyHeader || null);
    setMemoryConceptLabel(conceptLabelHeader || null);
    setIsNewConcept(isNewConceptHeader === "true");

    const data = (await response.json().catch(() => ({}))) as {
      error?: string;
      result?: AssistantResult;
      sources_found?: number;
    };

    if (!response.ok) {
      throw new Error(data?.error || t("errorAssistantFailed"));
    }

    if (!data?.result) {
      throw new Error(t("errorNoContent"));
    }

    setSourcesFound(data.sources_found ?? null);
    return data.result;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    const trimmed = material.trim();
    if (!trimmed) {
      setError(t("errorPasteMaterial"));
      return;
    }

    setLoading(true);
    try {
      setSubmittedMaterial(trimmed);
      await runLanguageAnalyze(trimmed).catch(() => null);
      const nextResult = await runAssistantRequest(trimmed, mode);
      setResult(nextResult);
      if (nextResult.explanation) speak(nextResult.explanation);
      else if (nextResult.summary) speak(nextResult.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorUnexpected"));
    } finally {
      setLoading(false);
    }
  };

  const handleStillStuck = async () => {
    if (!submittedMaterial.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await fetch("/api/memory/events", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "struggle_signal",
          source_type: "manual_feedback",
          concept_key: memoryConceptKey,
          module_code: null,
          session_id: sessionId,
          metadata: {
            origin: "assistant_followup_button",
          },
        }),
      }).catch(() => null);

      const followUpMaterial = `${submittedMaterial}

The student still does not understand this. Re-explain it from a different angle, use a simpler step-by-step explanation, and use a concrete example if that helps.`;
      const nextResult = await runAssistantRequest(followUpMaterial, "explain");
      setResult(nextResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errorFollowUp"));
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading || material.trim().length === 0;

  return (
    <div className="assistant-page">
      <RouteHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        className="assistant-header animate-fade-up"
        size={76}
      />

      <SectionCard className="glass card animate-fade-up">
        <form className="assistant-form" onSubmit={handleSubmit}>
          <div
            className="assistant-mode-group"
            aria-label={t("subjectSelectorLabel")}
            style={{ overflowX: "auto", flexWrap: "nowrap", paddingBottom: "2px", marginBottom: "4px" }}
          >
            <button
              type="button"
              className={subject === null ? "assistant-mode-chip is-active" : "assistant-mode-chip"}
              onClick={() => setSubject(null)}
            >
              {t("subjectAutoDetect")}
            </button>
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={subject === s.id ? "assistant-mode-chip is-active" : "assistant-mode-chip"}
                onClick={() => setSubject(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="assistant-mode-group" aria-label={t("modeSelectorLabel")}>
            {MODES.map((item) => (
              <button
                key={item.id}
                className={mode === item.id ? "assistant-mode-chip is-active" : "assistant-mode-chip"}
                type="button"
                onClick={() => setMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px", margin: "16px 0", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setSocratic(!socratic)}
              className={socratic ? "assistant-mode-chip is-active" : "assistant-mode-chip"}
              style={socratic ? { background: "var(--gold-dim)", borderColor: "var(--gold)" } : {}}
            >
              {socratic ? t("socraticOn") : t("socraticOff")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (voiceActive) window.speechSynthesis.cancel();
                setVoiceActive(!voiceActive);
              }}
              className={voiceActive ? "assistant-mode-chip is-active" : "assistant-mode-chip"}
              style={voiceActive ? { background: "var(--gold-dim)", borderColor: "var(--gold)" } : {}}
            >
              {voiceActive ? t("voiceActive") : t("voiceOff")}
            </button>
            <button
              type="button"
              onClick={startListening}
              className={isListening ? "assistant-mode-chip is-active" : "assistant-mode-chip"}
              disabled={isListening}
            >
              {isListening ? t("listening") : t("dictateNote")}
            </button>
          </div>

          <div style={{ margin: "16px 0" }}>
            <VoiceRecorder
              onTranscriptReady={(transcript, summary) => {
                setMaterial(transcript);
                setResult({ summary, explanation: t("voiceSummaryExplanation") });
              }}
            />
          </div>

          <textarea
            className="assistant-textarea"
            value={material}
            onChange={(event) => setMaterial(event.target.value)}
            rows={10}
            placeholder={t("textareaPlaceholder")}
          />

          <div className="assistant-submit-row" style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <Button variant="gold" type="submit" disabled={disabled}>
              {t("generateStudyHelp")}
            </Button>
            <Button variant="outline" type="button" onClick={handleGenerateFlashcards} disabled={disabled || generatingCards}>
              {generatingCards ? t("generatingCards") : t("createFlashcards")}
            </Button>
            <Button variant="outline" type="button" onClick={() => runLanguageRewrite("simpler_english")} disabled={disabled || languageLoading}>
              {t("makeSimpler")}
            </Button>
            <Button variant="outline" type="button" onClick={() => runLanguageRewrite("academic_tone")} disabled={disabled || languageLoading}>
              {t("academicRewrite")}
            </Button>
            <Button variant="outline" type="button" onClick={() => runLanguageAnalyze(material.trim())} disabled={disabled || languageLoading}>
              {languageLoading ? t("analyzing") : t("analyzeLanguage")}
            </Button>
            {loading ? <span className="assistant-loading">{t("thinking")}</span> : null}
          </div>
        </form>
      </SectionCard>

      {error ? <div className="assistant-error">{error}</div> : null}

      {languageInsight ? (
        <SectionCard className="glass card animate-fade-up" style={{ marginTop: "16px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "10px" }}>
            <span className="assistant-context-label">{t("languageLayerLabel")}</span>
            <span className="assistant-context-chip">{t("intentChip", { intent: languageInsight.intent ?? "general" })}</span>
            <span className="assistant-context-chip">{t("domainChip", { domain: languageInsight.domain ?? "general" })}</span>
            <span className="assistant-context-chip">{t("codeSwitchChip", { score: (languageInsight.codeSwitchScore * 100).toFixed(0) })}</span>
          </div>
          <div className="assistant-copy">
            <p>
              {t("detectedLanguages", { languages: languageInsight.languages.map((item) => `${item.code} (${Math.round(item.confidence * 100)}%)`).join(", ") })}
            </p>
            <p>{t("normalizedInput", { text: languageInsight.normalizedText })}</p>
          </div>
          {lastRewriteMode ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
              <span className="assistant-context-chip">{t("lastRewriteChip", { mode: lastRewriteMode })}</span>
              <Button variant="outline" size="sm" type="button" onClick={() => sendLanguageFeedback({ eventType: "rewrite_accept", accepted: true, note: `mode:${lastRewriteMode}` })}>
                {t("goodRewrite")}
              </Button>
              <Button variant="outline" size="sm" type="button" onClick={() => sendLanguageFeedback({ eventType: "rewrite_reject", accepted: false, note: `mode:${lastRewriteMode}` })}>
                {t("badRewrite")}
              </Button>
            </div>
          ) : null}
        </SectionCard>
      ) : null}

      {flashcards && (
        <section className="animate-fade-up">
          <h2 style={{ textAlign: "center", marginBottom: "8px", color: "var(--gold)" }}>{t("studyDeck")}</h2>
          <FlashcardDeck cards={flashcards} />
        </section>
      )}

      {result ? (
        <section className="assistant-response animate-fade-up">
          {sourcesFound !== null && sourcesFound > 0 ? (
            <div className="assistant-context-row">
              <span className="assistant-context-label">{t("capsLabel")}</span>
              <span className="assistant-context-value">
                {t("sourcesRetrieved", { count: sourcesFound ?? 0 })}
              </span>
              {cacheStatus === "SEMANTIC-HIT" ? (
                <span className="assistant-context-chip">{t("semanticCache")}</span>
              ) : cacheStatus === "HIT" ? (
                <span className="assistant-context-chip">{t("cached")}</span>
              ) : null}
            </div>
          ) : null}

          {memoryConceptLabel ? (
            <div className="assistant-context-row">
              <span className="assistant-context-label">{t("conceptLabel")}</span>
              <span className="assistant-context-value">{memoryConceptLabel}</span>
              {isNewConcept ? <span className="assistant-context-chip">{t("newTerritory")}</span> : null}
            </div>
          ) : null}

          {result.explanation ? (
            <div className="assistant-section">
              <h2 className="assistant-section-title">{t("sectionExplanation")}</h2>
              {renderRichText(result.explanation)}
            </div>
          ) : null}

          {result.summary ? (
            <div className="assistant-section">
              <h2 className="assistant-section-title">{t("sectionSummary")}</h2>
              {renderRichText(result.summary)}
            </div>
          ) : null}

          {result.quiz && result.quiz.questions && result.quiz.questions.length > 0 ? (
            <div className="assistant-section">
              <h2 className="assistant-section-title">{t("sectionPracticeQuestions")}</h2>
              <div className="assistant-quiz-list">
                {result.quiz.questions.map((item, index) => (
                  <div className="assistant-quiz-item" key={`${item.question}-${index}`}>
                    <p className="assistant-question">{item.question}</p>
                    <p className="assistant-answer">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="assistant-support-row">
            <Button variant="outline" size="sm" type="button" onClick={handleStillStuck} disabled={loading}>
              {t("stillStuck")}
            </Button>
            <span className="assistant-support-copy">
              {t("supportCopy")}
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
