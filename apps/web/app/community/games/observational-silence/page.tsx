"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ResearchTrialEventInput } from "@saedu/shared";
import { researchClient, ResearchApiError } from "@/lib/research/researchClient";
import {
  configForCondition,
  ObservationalSilenceStimulus,
  type IntruderCondition,
  type TrialQuality,
} from "@/lib/research/observationalSilenceStimulus";
import { isResearchStudyEnabled } from "@/lib/features";
import styles from "./page.module.css";

const STUDY_CODE = "observational-silence-v1";
const PRIMARY_TASK = "count teal-team passes";
const CONDITIONS: IntruderCondition[] = ["magenta", "teal_matched", "amber_matched"];

type Phase =
  | "consent"
  | "ready"
  | "playing"
  | "q_count"
  | "q_notice"
  | "q_notice_other"
  | "q_notice_shape"
  | "q_confidence"
  | "recall"
  | "debrief";

function deviceTier(): "low" | "mid" | "high" {
  const cores = typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 0 : 0;
  const mem = typeof navigator !== "undefined" ? (navigator as { deviceMemory?: number }).deviceMemory || 0 : 0;
  if ((mem && mem <= 2) || (cores && cores <= 4)) return "low";
  if ((mem && mem <= 4) || (cores && cores <= 6)) return "mid";
  return "high";
}

function deviceContext(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  const ua = navigator.userAgent;
  const m = ua.match(/Edg|SamsungBrowser|Chrome|Firefox|Safari|OPR/);
  return {
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    uaFamily: m ? m[0] : "Other",
    platform: "web",
    deviceTier: deviceTier(),
    prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function consentScope(): Record<string, unknown> {
  return {
    consentVersion: "v1",
    study: STUDY_CODE,
    purposes: ["academic_research", "scientific_publication", "deidentified_open_data"],
    dataCategories: ["gameplay_responses", "response_timing_ms", "self_report_answers", "coarse_device_info"],
    specialCategory: false,
    incompleteDisclosure: true,
    debriefProvided: true,
    voluntary: true,
    compensation: "none",
    crossBorderProcessing: true,
  };
}

const CONFIDENCE_LABELS = [
  "Not confident",
  "Slightly confident",
  "Moderately confident",
  "Confident",
  "Very confident",
];

export default function ObservationalSilencePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("consent");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // B5: research study is DRAFT pending NWU REC + POPIA approval. Keep it off the
  // launch build unless explicitly enabled via NEXT_PUBLIC_RESEARCH_STUDY_ENABLED=true.
  useEffect(() => {
    if (!isResearchStudyEnabled()) {
      router.replace("/community/games");
    }
  }, [router]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ObservationalSilenceStimulus | null>(null);
  const consentIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const conditionRef = useRef<IntruderCondition>("magenta");
  const qualityRef = useRef<TrialQuality | null>(null);
  const noticeLevelRef = useRef<number>(0);
  const bufferRef = useRef<ResearchTrialEventInput[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [agreed, setAgreed] = useState(false);
  const [reported, setReported] = useState<string>("");
  const [actualPassCount, setActualPassCount] = useState<number | null>(null);
  const [noticed, setNoticed] = useState<boolean | null>(null);
  const [recallBg, setRecallBg] = useState<string>("");
  const [recallFinished, setRecallFinished] = useState<"" | "yes" | "no">("");
  const [recallColour, setRecallColour] = useState<string>("");
  const [recallShape, setRecallShape] = useState<string>("");

  const flush = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0, bufferRef.current.length);
    try {
      await researchClient.sendEvents(sessionId, batch);
    } catch {
      bufferRef.current.unshift(...batch);
    }
  }, []);

  const handleConsent = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await researchClient.grantConsent(STUDY_CODE, {
        consentVersion: "v1",
        scope: consentScope(),
      });
      consentIdRef.current = res.consent.id;
      setPhase("ready");
    } catch (e) {
      if (e instanceof ResearchApiError) {
        if (e.code === "guardian_consent_required") {
          setError("A parent or guardian needs to give permission before you can take part. Check your account's guardian settings.");
        } else if (e.status === 403) {
          setError("This study is currently open to adults (18+) only.");
        } else if (e.status === 404) {
          setError("This study isn't open for new participants right now.");
        } else {
          setError("Something went wrong starting the study. Please try again.");
        }
      } else {
        setError("Unable to reach the server. Please check your connection.");
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const beginTrial = useCallback(async () => {
    setBusy(true);
    setError(null);
    const condition = CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)];
    conditionRef.current = condition;
    try {
      const res = await researchClient.startSession(STUDY_CODE, {
        condition: `naive_${condition}`,
        isPractice: false,
        primaryTask: PRIMARY_TASK,
        device: deviceContext(),
      });
      sessionIdRef.current = res.session.id;
      setPhase("playing");
    } catch {
      setError("Couldn't start the trial. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Engine + flush lifecycle, scoped to the playing phase.
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas || engineRef.current) return;

    const engine = new ObservationalSilenceStimulus(canvas, configForCondition(conditionRef.current), {
      onEvent: (event) => {
        bufferRef.current.push(event);
        if (bufferRef.current.length >= 40) void flush();
      },
      onEnd: ({ actualPassCount: count, quality }) => {
        setActualPassCount(count);
        qualityRef.current = quality;
        void flush();
        setPhase("q_count");
      },
    });
    engineRef.current = engine;
    engine.start();
    flushTimerRef.current = setInterval(() => void flush(), 2000);

    return () => {
      engine.stop();
      engineRef.current = null;
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    };
  }, [phase, flush]);

  // The graded Simons funnel: a "yes" at any level marks noticing; the level
  // distinguishes spontaneous report (2/3) from a prompted "yes" (4).
  const resolveNotice = useCallback(
    async (didNotice: boolean, level: number) => {
      setNoticed(didNotice);
      noticeLevelRef.current = didNotice ? level : 0;
      setPhase("q_confidence");
    },
    []
  );

  const submitConfidence = useCallback(
    async (confidence: number) => {
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        await flush();
        try {
          await researchClient.recordNoticing(sessionId, {
            criticalEventKey: "intruder",
            noticed: noticed ?? false,
            confidence,
            freeText: `level:${noticeLevelRef.current};condition:${conditionRef.current}`,
          });
        } catch {
          // best-effort
        }
      }
      setPhase("recall");
    },
    [flush, noticed]
  );

  const submitRecallAndComplete = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;
    setBusy(true);
    try {
      await researchClient.recordRecall(sessionId, {
        promptKey: "background_colour_end",
        responseValue: recallBg,
      });
      await researchClient.recordRecall(sessionId, {
        promptKey: "all_orbs_finished",
        responseValue: recallFinished === "" ? null : recallFinished === "yes",
      });
      if (noticed) {
        await researchClient.recordRecall(sessionId, { promptKey: "intruder_colour", responseValue: recallColour });
        await researchClient.recordRecall(sessionId, { promptKey: "intruder_shape", responseValue: recallShape });
      }
      const parsed = parseInt(reported, 10);
      await researchClient.completeSession(sessionId, {
        reportedPassCount: Number.isNaN(parsed) ? null : parsed,
        actualPassCount,
        qualityFlags: {
          client: "web_v1",
          condition: conditionRef.current,
          deviceTier: deviceTier(),
          ...(qualityRef.current ?? {}),
        },
      });
    } catch {
      // non-fatal; show the debrief regardless
    } finally {
      setBusy(false);
      setPhase("debrief");
    }
  }, [recallBg, recallFinished, recallColour, recallShape, reported, actualPassCount, noticed]);

  const withdraw = useCallback(async () => {
    const consentId = consentIdRef.current;
    if (!consentId) return;
    setBusy(true);
    try {
      await researchClient.withdraw(consentId, "withdrawn_at_debrief");
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setError("Your data has been withdrawn. Thanks for trying the study.");
    }
  }, []);

  const passError =
    actualPassCount != null && reported !== "" && !Number.isNaN(parseInt(reported, 10))
      ? Math.abs(parseInt(reported, 10) - actualPassCount)
      : null;

  return (
    <main className={styles.wrap}>
      <header className={styles.lockup}>
        <Link href="/community/games" className={styles.back}>
          ← Game Centre
        </Link>
        <div className={styles.mark} aria-hidden="true">
          ○ ◇ ○
        </div>
        <div className={styles.org}>AURA AI Laboratory</div>
        <div className={styles.partner}>in partnership with</div>
        <div className={styles.org}>SCHOOL Research</div>
        <div className={styles.divider} aria-hidden="true" />
        <span className={styles.badge}>Research</span>
      </header>

      <h1 className={styles.title}>Observational Silence</h1>

      <div className={styles.stage}>
        <canvas
          ref={canvasRef}
          width={640}
          height={380}
          className={styles.canvas}
          aria-label="Attention counting study"
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.panel}>
        {phase === "consent" && (
          <>
            <p>
              This short study (about 2 minutes) is run by AURA AI Laboratory with a North West
              University researcher. You&apos;ll watch an animation, count some passes, and answer a
              few questions afterwards.
            </p>
            <p className={styles.muted}>
              Taking part is voluntary and won&apos;t affect your account. Your responses are stored
              against a pseudonymous code and used de-identified for research. You can stop or withdraw
              at any time. Full details: <Link href="/legal/research-consent">participant information</Link>.
            </p>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />{" "}
              <span>
                I am 18 or older, I&apos;ve read the above, and I agree to take part and to the use of
                my de-identified data.
              </span>
            </label>
            <button className={styles.primary} onClick={handleConsent} disabled={busy || !agreed}>
              {busy ? "Please wait…" : "I consent — continue"}
            </button>
          </>
        )}

        {phase === "ready" && (
          <>
            <p>
              Your task: count how many times the <strong className={styles.teal}>teal</strong> orbs
              pass their token to each other. Ignore the amber orbs.
            </p>
            <p className={styles.muted}>Count silently — you&apos;ll report the number at the end.</p>
            <button className={styles.primary} onClick={beginTrial} disabled={busy}>
              {busy ? "Starting…" : "Begin trial"}
            </button>
          </>
        )}

        {phase === "playing" && (
          <p className={styles.muted}>Keep your eyes on the teal orbs and count their passes…</p>
        )}

        {phase === "q_count" && (
          <>
            <p>How many times did the teal orbs pass their token?</p>
            <input
              type="number"
              min={0}
              max={99}
              value={reported}
              onChange={(e) => setReported(e.target.value)}
              className={styles.number}
            />
            <button className={styles.primary} onClick={() => setPhase("q_notice")}>
              Continue
            </button>
          </>
        )}

        {phase === "q_notice" && (
          <>
            <p>Did you notice anything unusual during the animation?</p>
            <div className={styles.row}>
              <button className={styles.choice} onClick={() => void resolveNotice(true, 2)}>
                Yes
              </button>
              <button className={styles.choice} onClick={() => setPhase("q_notice_other")}>
                No
              </button>
            </div>
          </>
        )}

        {phase === "q_notice_other" && (
          <>
            <p>Did you notice anything other than the orbs and tokens?</p>
            <div className={styles.row}>
              <button className={styles.choice} onClick={() => void resolveNotice(true, 3)}>
                Yes
              </button>
              <button className={styles.choice} onClick={() => setPhase("q_notice_shape")}>
                No
              </button>
            </div>
          </>
        )}

        {phase === "q_notice_shape" && (
          <>
            <p>Did you see a shape that was not an orb?</p>
            <div className={styles.row}>
              <button className={styles.choice} onClick={() => void resolveNotice(true, 4)}>
                Yes
              </button>
              <button className={styles.choice} onClick={() => void resolveNotice(false, 0)}>
                No
              </button>
            </div>
          </>
        )}

        {phase === "q_confidence" && (
          <>
            <p>How confident are you in that answer?</p>
            <div className={styles.confidence}>
              {CONFIDENCE_LABELS.map((label, i) => (
                <button key={label} className={styles.choice} onClick={() => void submitConfidence(i + 1)}>
                  <span className={styles.confNum}>{i + 1}</span>
                  <span className={styles.confLabel}>{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === "recall" && (
          <>
            <label className={styles.field}>
              What colour did the background end as?
              <input
                type="text"
                value={recallBg}
                onChange={(e) => setRecallBg(e.target.value)}
                className={styles.text}
                placeholder="Your best guess"
              />
            </label>
            <p className={styles.fieldLabel}>Did all the moving circles stay on screen until the end?</p>
            <div className={styles.row}>
              <button
                className={recallFinished === "yes" ? styles.choiceOn : styles.choice}
                onClick={() => setRecallFinished("yes")}
              >
                Yes
              </button>
              <button
                className={recallFinished === "no" ? styles.choiceOn : styles.choice}
                onClick={() => setRecallFinished("no")}
              >
                No
              </button>
            </div>
            {noticed && (
              <>
                <label className={styles.field}>
                  If you saw a different shape, what colour was it?
                  <input
                    type="text"
                    value={recallColour}
                    onChange={(e) => setRecallColour(e.target.value)}
                    className={styles.text}
                  />
                </label>
                <label className={styles.field}>
                  …and what shape was it?
                  <input
                    type="text"
                    value={recallShape}
                    onChange={(e) => setRecallShape(e.target.value)}
                    className={styles.text}
                  />
                </label>
              </>
            )}
            <button className={styles.primary} onClick={() => void submitRecallAndComplete()} disabled={busy}>
              {busy ? "Saving…" : "Finish"}
            </button>
          </>
        )}

        {phase === "debrief" && (
          <>
            <h2 className={styles.subhead}>You just experienced inattentional blindness</h2>
            <p>
              When attention is focused on one task, people often miss unexpected events that are
              directly in front of them. This has been replicated for decades in psychology
              laboratories around the world.
            </p>
            <p className={styles.muted}>
              Today you contributed data to a real South African research project. There was a
              {" "}<span className={styles.intruderWord}>second shape</span> that crossed the screen
              for about six seconds.
            </p>
            {actualPassCount != null && (
              <div className={styles.cards}>
                <div className={styles.card}>
                  <div className={styles.k}>You counted</div>
                  <div className={styles.v}>{reported === "" ? "—" : reported}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.k}>Actual teal passes</div>
                  <div className={styles.v}>{actualPassCount}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.k}>Detected the shape</div>
                  <div className={styles.v}>{noticed ? "Yes" : "No"}</div>
                </div>
              </div>
            )}
            <p className={styles.muted}>
              This is science, not a competition — there&apos;s no score and no leaderboard. You can
              withdraw your data if you&apos;d prefer we didn&apos;t use it.
            </p>
            <div className={styles.row}>
              <Link href="/community/games" className={styles.primary}>
                Use my data — done
              </Link>
              <button className={styles.choice} onClick={() => void withdraw()} disabled={busy}>
                Withdraw my data
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
