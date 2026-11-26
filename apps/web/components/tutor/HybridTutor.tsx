"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { RouteHeader } from "@/components/ui/RouteHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { SYSTEM_PROMPT, hintUserPrompt, markUserPrompt, planUserPrompt } from "@/lib/hybridTutor/prompts";
import { formatAvailability } from "@/lib/hybridTutor/display";
import { readLanguageModelAvailability } from "@/lib/hybridTutor/device";
import { fileToInlinePart, textPart } from "@/lib/hybridTutor/files";
import { compressImageFile } from "@/lib/hybridTutor/imageFit";
import { readPublicFirebaseConfig } from "@/lib/hybridTutor/config";
import { DEFAULT_SETTINGS, type TutorSettings } from "@/lib/hybridTutor/routing";
import { CLOSED_REVEAL, projectHintView, type HintReveal } from "@/lib/hybridTutor/hintGate";
import { applyMasteryEvent, listSkills, masteryLabel, type SkillMap } from "@/lib/hybridTutor/mastery";
import { estimateSavings, formatSavings, recordInference, type TutorStats, EMPTY_STATS } from "@/lib/hybridTutor/stats";
import {
  SKILL_MAP_KEY,
  STATS_KEY,
  cacheTopic,
  planOfflineHelp,
  readCachedTopic,
  readOpenedLessons,
  type CachedTopic,
} from "@/lib/hybridTutor/offline";
import { HINT_SCHEMA, type HintPayload, type MarkPayload, type PlanPayload } from "@/lib/hybridTutor/schemas";
import styles from "./tutor.module.css";

type AiRuntime = Awaited<ReturnType<typeof loadAi>>;

async function loadAi() {
  const [client, model, task] = await Promise.all([
    import("@/lib/hybridTutor/client"),
    import("@/lib/hybridTutor/hybridModel"),
    import("@/lib/hybridTutor/runTask"),
  ]);
  return { ...client, ...model, ...task };
}

type Tab = "hint" | "mark" | "plan" | "sitting";
type SittingQuestion = {
  id: string;
  pastPaperId: string;
  qNumber: string;
  label: string;
  maxMarks: number;
  subject: string;
  title: string;
  topicTags: string | null;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function HybridTutor() {
  const params = useSearchParams();
  const aiRuntime = useRef<AiRuntime | null>(null);
  const [tab, setTab] = useState<Tab>("hint");
  const [settings, setSettings] = useState<TutorSettings>(DEFAULT_SETTINGS);
  const [settingsSource, setSettingsSource] = useState<"defaults" | "remote_config">("defaults");
  const [configured, setConfigured] = useState(false);
  const [configNote, setConfigNote] = useState<string | null>(null);
  const [availability, setAvailability] = useState("unsupported");
  const [download, setDownload] = useState<number | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [stats, setStats] = useState<TutorStats>(EMPTY_STATS);
  const [skills, setSkills] = useState<SkillMap>({});
  const [openedLessons, setOpenedLessons] = useState<string[]>([]);
  const [cached, setCached] = useState<CachedTopic | null>(null);
  const [booted, setBooted] = useState(false);
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [sourceKind, setSourceKind] = useState<"on_device" | "in_cloud" | null>(null);

  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("12");
  const [pastPaperId, setPastPaperId] = useState("");
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [fullHint, setFullHint] = useState<HintPayload | null>(null);
  const [reveal, setReveal] = useState<HintReveal>(CLOSED_REVEAL);

  const [marks, setMarks] = useState(10);
  const [memo, setMemo] = useState("");
  const [answer, setAnswer] = useState("");
  const [markResult, setMarkResult] = useState<MarkPayload | null>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);

  const [days, setDays] = useState(7);
  const [pdf, setPdf] = useState<File | null>(null);
  const [plan, setPlan] = useState<PlanPayload | null>(null);

  const [minutes, setMinutes] = useState(25);
  const [sittingId, setSittingId] = useState<string | null>(null);
  const [sittingQuestions, setSittingQuestions] = useState<SittingQuestion[]>([]);
  const [sittingIndex, setSittingIndex] = useState(0);
  const [sittingPhase, setSittingPhase] = useState<"write" | "review">("write");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sittingAnswer, setSittingAnswer] = useState("");
  const [reviewNote, setReviewNote] = useState<string | null>(null);

  useEffect(() => {
    const mode = params.get("mode");
    if (mode === "mark" || mode === "plan" || mode === "sitting") setTab(mode);
    if (mode === "hints") setTab("hint");
    setSubject(params.get("subject") ?? "");
    setGrade(params.get("grade") || "12");
    setPastPaperId(params.get("pastPaperId") ?? "");
    setQuestion(params.get("q") ?? "");
    const answerParam = params.get("answer");
    if (answerParam) setAnswer(answerParam);
    const markParam = Number(params.get("marks"));
    if (Number.isFinite(markParam) && markParam > 0) setMarks(markParam);
  }, [params]);

  useEffect(() => {
    setStats(readJson(STATS_KEY, EMPTY_STATS));
    setSkills(readJson(SKILL_MAP_KEY, {}));
    setOpenedLessons(readOpenedLessons(window.localStorage));
    setCached(readCachedTopic(window.localStorage));
    const sync = () => setOffline(typeof navigator !== "undefined" ? !navigator.onLine : false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    let cancelled = false;
    void loadAi().then((runtime) => {
      aiRuntime.current = runtime;
    }).catch(() => undefined);
    void (async () => {
      await fetch("/api/tutor/session", { method: "POST" }).catch(() => null);
      const status = await readLanguageModelAvailability();
      if (!cancelled) setAvailability(status);
      const firebase = readPublicFirebaseConfig();
      if (!firebase.ok) {
        if (!cancelled) {
          setConfigNote("Firebase is not set up on this phone yet. You can still read a saved topic. Add the Firebase keys to turn hybrid answers on.");
          setBooted(true);
        }
        return;
      }
      try {
        const ai = await loadAi();
        const app = ai.getFirebaseApp();
        const loaded = await ai.loadTutorSettings(app);
        await ai.ensureAnonymousUser(app);
        if (!cancelled) {
          setSettings(loaded.settings);
          setSettingsSource(loaded.source);
          setConfigured(true);
        }
      } catch (cause) {
        if (!cancelled) setConfigNote(cause instanceof Error ? cause.message : "Firebase could not start.");
      }
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (!sittingId || sittingPhase !== "write" || secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [sittingId, sittingPhase, secondsLeft]);

  useEffect(() => {
    if (sittingId && sittingPhase === "write" && secondsLeft === 0) setSittingPhase("review");
  }, [sittingId, sittingPhase, secondsLeft]);

  function persistStats(next: TutorStats) {
    setStats(next);
    window.localStorage.setItem(STATS_KEY, JSON.stringify(next));
  }

  function persistSkills(next: SkillMap) {
    setSkills(next);
    window.localStorage.setItem(SKILL_MAP_KEY, JSON.stringify(next));
  }

  function rememberSource(source: "on_device" | "in_cloud", display: string) {
    setSourceKind(source);
    setSourceLabel(display);
    persistStats(recordInference(stats, source));
  }

  const visibleHint = useMemo(() => (fullHint ? projectHintView(fullHint, reveal) : null), [fullHint, reveal]);
  const savings = estimateSavings(stats.onDevice);
  const offlinePlan = planOfflineHelp({
    offline,
    onDeviceReady: availability === "available",
    hasCachedTopic: Boolean(cached?.hints.length),
    hasOpenedLessons: openedLessons.length > 0,
    task: tab === "sitting" ? "mark" : tab,
  });

  function onEnableDevice() {
    setDeviceError(null);
    const ai = aiRuntime.current;
    if (!ai) {
      setDeviceError("The on-device tools are still loading. Tap Enable again in a moment.");
      void loadAi().then((runtime) => {
        aiRuntime.current = runtime;
      });
      return;
    }
    try {
      const model = ai.hybridModel({
        ai: ai.getTutorAi(ai.getFirebaseApp()),
        settings,
        schema: HINT_SCHEMA,
        systemInstruction: SYSTEM_PROMPT,
        forceCloud: false,
        modeName: "PREFER_ON_DEVICE",
      });
      void ai.enableOnDeviceFromGesture(model, (progress) => setDownload(progress))
        .then(() => setAvailability("available"))
        .catch((cause: unknown) => setDeviceError(cause instanceof Error ? cause.message : "The on-device model did not start."));
    } catch (cause) {
      setDeviceError(cause instanceof Error ? cause.message : "Firebase is not configured.");
    }
  }

  async function onHint(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFollowUp(null);
    if (!question.trim() && !image) {
      setError("Type a question or attach a photo.");
      return;
    }
    if (!configured) {
      setError(configNote ?? "Firebase AI Logic is not configured.");
      return;
    }
    setBusy(true);
    setOptimistic("Reading your question on this phone…");
    try {
      const ai = aiRuntime.current ?? await loadAi();
      aiRuntime.current = ai;
      const parts = [textPart(hintUserPrompt({ question: question || "See the attached photo.", subject, grade }))];
      if (image) parts.push(await fileToInlinePart(await compressImageFile(image)));
      const result = await ai.runTutorTask({
        ai: ai.getTutorAi(),
        settings,
        task: "hint",
        parts,
        offline,
      });
      if (result.task !== "hint") return;
      setFullHint(result.data);
      setReveal({ hintsShown: 1, solutionAsked: false, answerAsked: false });
      rememberSource(result.source, result.display);
      persistSkills(applyMasteryEvent(skills, { type: "hint", topic: result.data.topic, subject, depth: 1 }));
      const topic: CachedTopic = {
        topic: result.data.topic,
        subject: subject || "CAPS",
        hints: [...result.data.hints],
        solution: result.data.solution,
        lessonHrefs: readOpenedLessons(window.localStorage),
        savedAt: Date.now(),
      };
      cacheTopic(window.localStorage, topic);
      setCached(topic);
      const uid = (await ai.ensureAnonymousUser(ai.getFirebaseApp())) ?? "anonymous";
      void ai.saveTutorAttempt(ai.getFirebaseApp(), uid, {
        kind: "hint",
        topic: result.data.topic,
        inferenceSource: result.source,
      }).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The hint ladder did not run.");
    } finally {
      setBusy(false);
      setOptimistic(null);
    }
  }

  function showNextHint() {
    if (!fullHint) return;
    const depth = Math.min(3, reveal.hintsShown + 1) as 1 | 2 | 3;
    setReveal((current) => ({ ...current, hintsShown: Math.min(3, current.hintsShown + 1) }));
    persistSkills(applyMasteryEvent(skills, { type: "hint", topic: fullHint.topic, subject, depth }));
  }

  async function onMark(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!configured) {
      setError(configNote ?? "Firebase AI Logic is not configured.");
      return;
    }
    setBusy(true);
    setOptimistic("Checking your working…");
    try {
      const ai = aiRuntime.current ?? await loadAi();
      aiRuntime.current = ai;
      const result = await ai.runTutorTask({
        ai: ai.getTutorAi(),
        settings,
        task: "mark",
        answerText: answer,
        offline,
        parts: [textPart(markUserPrompt({ question, marks, memo, answer, subject }))],
      });
      if (result.task !== "mark") return;
      setMarkResult(result.data);
      rememberSource(result.source, result.display);
      persistSkills(applyMasteryEvent(skills, {
        type: "quiz",
        topic: question.slice(0, 80) || subject || "Answer",
        subject,
        score: result.data.score,
        outOf: result.data.out_of,
      }));
      const saved = await fetch("/api/tutor/mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pastPaperId: pastPaperId || undefined,
          subject,
          grade: Number(grade),
          question,
          marks,
          answer,
          score: result.data.score,
          outOf: result.data.out_of,
          feedback: result.data.feedback,
          missedSteps: result.data.missed_steps,
          topic: subject || "Answer",
        }),
      });
      const payload = await saved.json().catch(() => null);
      if (saved.ok && payload?.followUp?.href) setFollowUp(payload.followUp.href as string);
      else if (!saved.ok) setError(payload?.error ?? "The mark was shown, but it was not saved to your paper history.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Marking did not run.");
    } finally {
      setBusy(false);
      setOptimistic(null);
    }
  }

  async function onPlan(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!configured) {
      setError(configNote ?? "Firebase AI Logic is not configured.");
      return;
    }
    setBusy(true);
    setOptimistic(pdf ? "Sending the paper to the cloud…" : "Building your plan…");
    try {
      const ai = aiRuntime.current ?? await loadAi();
      aiRuntime.current = ai;
      const parts = [textPart(planUserPrompt({ subject, grade, days, paperNote: pastPaperId ? `Past paper ${pastPaperId}` : undefined }))];
      if (pdf) parts.push(await fileToInlinePart(pdf, "application/pdf"));
      const result = await ai.runTutorTask({
        ai: ai.getTutorAi(),
        settings,
        task: "plan",
        parts,
        hasPdf: Boolean(pdf),
        offline,
        planDays: days,
      });
      if (result.task !== "plan") return;
      setPlan(result.data);
      rememberSource(result.source, result.display);
      const saved = await fetch("/api/tutor/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pastPaperId: pastPaperId || undefined, subject, grade: Number(grade), days, plan: result.data }),
      });
      if (!saved.ok) {
        const payload = await saved.json().catch(() => null);
        setError(payload?.error ?? "The plan is on screen, but it was not saved against a past paper.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The planner did not run.");
    } finally {
      setBusy(false);
      setOptimistic(null);
    }
  }

  async function startSitting(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const weak = listSkills(skills).slice(0, 6).map((skill) => ({
        topic: skill.topic,
        subject: skill.subject,
        mastery: skill.mastery,
      }));
      const response = await fetch("/api/tutor/sitting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes,
          limit: 4,
          weak,
          subject: subject || undefined,
          grade: Number(grade) || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not start the sitting.");
      setSittingId(payload.attemptId);
      setSittingQuestions(payload.questions);
      setSittingIndex(0);
      setSittingPhase("write");
      setSecondsLeft(Number(payload.minutes) * 60);
      setSittingAnswer("");
      setReviewNote(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the sitting.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewCurrent() {
    const current = sittingQuestions[sittingIndex];
    if (!current || !sittingId || !configured) {
      setError(configNote ?? "Firebase AI Logic is not configured, so this answer cannot be marked yet.");
      return;
    }
    setBusy(true);
    setError(null);
    setOptimistic("Marking this question…");
    try {
      const ai = aiRuntime.current ?? await loadAi();
      aiRuntime.current = ai;
      const result = await ai.runTutorTask({
        ai: ai.getTutorAi(),
        settings,
        task: "mark",
        answerText: sittingAnswer,
        offline,
        parts: [textPart(markUserPrompt({
          question: `${current.qNumber}: ${current.label} (${current.title})`,
          marks: current.maxMarks,
          memo: "Use CAPS method marks. A memorandum was not attached.",
          answer: sittingAnswer,
          subject: current.subject,
        }))],
      });
      if (result.task !== "mark") return;
      setMarkResult(result.data);
      rememberSource(result.source, result.display);
      const topic = current.topicTags || current.subject;
      persistSkills(applyMasteryEvent(skills, {
        type: "quiz",
        topic,
        subject: current.subject,
        score: result.data.score,
        outOf: result.data.out_of,
      }));
      const done = sittingIndex >= sittingQuestions.length - 1;
      const saved = await fetch("/api/tutor/sitting/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: sittingId,
          questionId: current.id,
          answer: sittingAnswer,
          score: result.data.score,
          outOf: result.data.out_of,
          feedback: result.data.feedback,
          missedSteps: result.data.missed_steps,
          topic,
          subject: current.subject,
          questionLabel: `${current.qNumber}: ${current.label}`,
          done,
        }),
      });
      const payload = await saved.json().catch(() => null);
      if (!saved.ok) {
        setReviewNote(result.data.feedback);
        setError(typeof payload?.error === "string" ? payload.error : "This answer was not saved. It is still here so you can try again.");
        return;
      }
      setReviewNote(result.data.feedback);
      if (payload?.followUp?.prompt) setFollowUp(payload.followUp.href ?? null);
      if (!done) {
        setSittingIndex((index) => index + 1);
        setSittingAnswer("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This answer was not marked.");
    } finally {
      setBusy(false);
      setOptimistic(null);
    }
  }

  async function shareFamily() {
    setError(null);
    const response = await fetch("/api/tutor/family", { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setError(payload?.error ?? "Could not create a family link.");
      return;
    }
    const url = `${window.location.origin}${payload.path}`;
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setFollowUp(payload.path);
    setSourceLabel("Family link copied");
  }

  const currentQuestion = sittingQuestions[sittingIndex];
  const clock = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <div className={styles.page}>
      <RouteHeader
        eyebrow="Grade 10–12 · CAPS"
        title="Hybrid tutor"
        description="Hints stay on this phone when they can. Long answers and whole papers use the cloud. Mobile data stays for the work that needs it."
      />
      <div className={styles.layout}>
        <div className={styles.stack}>
          <SectionCard
            title="Where this answer runs"
            description={settingsSource === "remote_config" ? "Remote Config is loaded." : "Using safe defaults until Remote Config loads."}
            actions={<span className={styles.chip}>{settings.ai_enabled ? settings.inference_mode : "Tutor off"}</span>}
          >
            <div className={styles.row}>
              <span className={styles.chip} data-testid="device-status">{formatAvailability(availability)}</span>
              <Button variant="gold" size="sm" type="button" onClick={onEnableDevice}>Enable on-device AI</Button>
              {download !== null ? <span>{Math.round(download * 100)}% downloaded</span> : null}
            </div>
            {deviceError ? <p className={styles.error}>{deviceError}</p> : null}
            {configNote ? <p className={styles.note}>{configNote}</p> : null}
            <p className={styles.note} data-testid="offline-plan">{offlinePlan.message}</p>
            {offline && cached ? (
              <div>
                <strong>Saved topic: {cached.topic}</strong>
                <ol className={styles.hintList}>
                  {cached.hints.map((hint) => <li key={hint}>{hint}</li>)}
                </ol>
              </div>
            ) : null}
            {offline ? (
              <div className={styles.row}>
                {openedLessons.map((href) => <a key={href} href={href}>Opened lesson</a>)}
                <a href="/offline">Offline page</a>
              </div>
            ) : null}
          </SectionCard>

          <div className={styles.tabs} role="tablist">
            {([
              ["hint", "Hint ladder"],
              ["mark", "Mark my answer"],
              ["plan", "Paper plan"],
              ["sitting", "Timed sitting"],
            ] as const).map(([id, label]) => (
              <button key={id} className={styles.tab} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "hint" ? (
            <SectionCard title="Hint ladder" description="Three hints, then the worked solution only if you ask. The final answer stays hidden until you ask after the hints.">
              <form className={styles.form} onSubmit={onHint}>
                <label className={styles.field}>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
                <label className={styles.field}>Grade
                  <select value={grade} onChange={(event) => setGrade(event.target.value)}>
                    <option>10</option><option>11</option><option>12</option>
                  </select>
                </label>
                <label className={styles.field}>Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} /></label>
                <div className={styles.row}>
                  <label className={styles.field}>Take a photo
                    <input type="file" accept="image/*" capture="environment" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
                  </label>
                  <label className={styles.field}>Choose a photo
                    <input type="file" accept="image/*" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
                  </label>
                </div>
                <div className={styles.dock}>
                  <Button variant="gold" type="submit" disabled={busy}>{busy ? "Reading…" : "Get hints"}</Button>
                </div>
              </form>
              {!booted ? <div className={styles.skeleton} aria-hidden="true" /> : null}
              {optimistic ? <p className={styles.note}>{optimistic}</p> : null}
              {visibleHint ? (
                <div className={styles.result} data-testid="hint-view">
                  <strong>{visibleHint.topic}</strong>
                  <p className={styles.note}>Swipe the cards. The answer stays hidden until you ask.</p>
                  <ol className={styles.hintCards}>
                    {visibleHint.hints.map((hint, index) => <li key={`${index}-${hint}`}>Hint {index + 1}. {hint}</li>)}
                  </ol>
                  <div className={styles.dock}>
                    <Button type="button" disabled={visibleHint.hintsRemaining === 0} onClick={showNextHint}>Next hint</Button>
                    <Button type="button" disabled={!visibleHint.canAskForSolution} onClick={() => setReveal((current) => ({ ...current, solutionAsked: true }))}>Show the working</Button>
                    <Button type="button" disabled={!visibleHint.canAskForAnswer} onClick={() => setReveal((current) => ({ ...current, answerAsked: true }))}>Show the final answer</Button>
                  </div>
                  {visibleHint.solution ? <p>{visibleHint.solution}</p> : null}
                  {visibleHint.final_answer ? <p data-testid="final-answer"><strong>Final answer:</strong> {visibleHint.final_answer}</p> : <p>The final answer is still hidden.</p>}
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {tab === "mark" ? (
            <SectionCard title="Mark my answer" description="Method marks count when the working is right. Answers longer than the Remote Config limit go to the cloud.">
              <form className={styles.form} onSubmit={onMark}>
                <label className={styles.field}>Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={4} /></label>
                <label className={styles.field}>Marks<input type="number" min={1} value={marks} onChange={(event) => setMarks(Number(event.target.value))} /></label>
                <label className={styles.field}>Memo<textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={3} /></label>
                <label className={styles.field}>Your answer<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} /></label>
                <div className={styles.row}>
                  <Button variant="gold" type="submit" disabled={busy}>Mark this answer</Button>
                  <Button type="button" variant="outline" onClick={() => {
                    if (!question) return;
                    persistSkills(applyMasteryEvent(skills, { type: "retry", topic: question.slice(0, 80), subject }));
                  }}>Count a retry</Button>
                </div>
              </form>
              {markResult ? (
                <div className={styles.result}>
                  <strong>{markResult.score} / {markResult.out_of}</strong>
                  <ul>{markResult.missed_steps.map((step) => <li key={step}>{step}</li>)}</ul>
                  <p>{markResult.feedback}</p>
                  <p>{markResult.next_action}</p>
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {tab === "plan" ? (
            <SectionCard title="Whole-paper plan" description="A PDF always goes to the cloud. The plan is saved on the past paper, with one task row per topic.">
              <form className={styles.form} onSubmit={onPlan}>
                <label className={styles.field}>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
                <label className={styles.field}>Days<input type="number" min={2} max={21} value={days} onChange={(event) => setDays(Number(event.target.value))} /></label>
                <label className={styles.field}>Paper PDF<input type="file" accept="application/pdf" onChange={(event) => setPdf(event.target.files?.[0] ?? null)} /></label>
                <Button variant="gold" type="submit" disabled={busy}>Build the plan</Button>
              </form>
              {plan ? (
                <div className={styles.result}>
                  <strong>{plan.subject}</strong>
                  <ul className={styles.planList}>
                    {plan.topics.map((topic) => <li key={topic.name}>{topic.name} · {topic.marks} marks · {topic.priority}</li>)}
                  </ul>
                  <ol className={styles.planList}>
                    {plan.plan.map((day) => <li key={day.day}>Day {day.day}: {day.focus}. {day.tasks.join(" ")}</li>)}
                  </ol>
                </div>
              ) : null}
            </SectionCard>
          ) : null}

          {tab === "sitting" ? (
            <SectionCard title="Timed sitting" description="Questions are weighted toward the topics your skill map and paper scores already show as thin.">
              {!sittingId ? (
                <form className={styles.form} onSubmit={startSitting}>
                  <label className={styles.field}>Minutes<input type="number" min={5} max={180} value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /></label>
                  <Button variant="gold" type="submit" disabled={busy}>Start the sitting</Button>
                </form>
              ) : (
                <div className={styles.question}>
                  <div className={styles.timer} data-testid="sitting-clock">{sittingPhase === "write" ? clock : "Review"}</div>
                  {currentQuestion ? (
                    <>
                      <p>{currentQuestion.subject} · {currentQuestion.title}</p>
                      <strong>{currentQuestion.qNumber}. {currentQuestion.label}</strong>
                      <p>Max {currentQuestion.maxMarks}</p>
                      {sittingPhase === "write" ? (
                        <Button type="button" onClick={() => setSittingPhase("review")}>Finish and review one question at a time</Button>
                      ) : (
                        <>
                          <label className={styles.field}>Your answer<textarea value={sittingAnswer} onChange={(event) => setSittingAnswer(event.target.value)} rows={5} /></label>
                          <Button variant="gold" type="button" disabled={busy} onClick={() => void reviewCurrent()}>Mark this question</Button>
                        </>
                      )}
                      {reviewNote ? <p>{reviewNote}</p> : null}
                    </>
                  ) : <p>This sitting is marked.</p>}
                </div>
              )}
            </SectionCard>
          ) : null}

          {error ? (
            <p className={styles.error} role="alert">
              {error}{" "}
              <button type="button" className="ui-button ui-button--outline" onClick={() => setError(null)}>Try again</button>
            </p>
          ) : null}
          {sourceLabel ? <p className={styles.source} data-testid="inference-source" data-source={sourceKind ?? undefined}>{sourceLabel}</p> : null}
          {followUp ? <p><a href={followUp}>Open the follow-up practice</a></p> : null}
        </div>

        <aside className={styles.side}>
          <SectionCard title="This phone" description="On-device answers are the ones that did not use mobile data.">
            <p data-testid="stats-counts">{stats.onDevice} on-device · {stats.inCloud} cloud</p>
            <p data-testid="stats-saved">{formatSavings(stats.onDevice)}</p>
            <p>About R{savings.rands.toFixed(2)} at R85/GB.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void shareFamily()}>Family view link</Button>
            <p className={styles.note}>Long-answer cloud switch: {settings.long_answer_chars} characters. Model: {settings.cloud_model}.</p>
          </SectionCard>
          <SectionCard title="Skill map" description="Hints, retries and quiz scores move a topic. Needing more hints lowers it. A better quiz score lifts it.">
            <ul className={styles.skillList}>
              {listSkills(skills).length === 0 ? <li>No topics yet. Ask for a hint or mark an answer.</li> : null}
              {listSkills(skills).map((skill) => (
                <li key={`${skill.subject}-${skill.topic}`}>
                  <strong>{skill.topic}</strong>
                  <div>{skill.subject} · {masteryLabel(skill.mastery)} · {skill.mastery}</div>
                  <div className={styles.bar}><span style={{ width: `${skill.mastery}%` }} /></div>
                  <small>{skill.hintsUsed} hints · {skill.retries} retries · {skill.quizzes} checks</small>
                </li>
              ))}
            </ul>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
