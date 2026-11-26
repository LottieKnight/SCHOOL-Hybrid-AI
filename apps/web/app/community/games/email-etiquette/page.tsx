"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type EmailError = {
  id: string;
  label: string;
  explanation: string;
};

type EmailPair = {
  context: string;
  badEmail: {
    subject: string;
    greeting: string;
    body: string[];
    signOff: string;
  };
  errors: EmailError[];
};

const EMAIL_PAIRS: EmailPair[] = [
  {
    context: "Student emailing a lecturer about a missed deadline",
    badEmail: {
      subject: "",
      greeting: "Hey Prof",
      body: [
        "Soooo I missed the assignment submission lol",
        "I was super busy with other stuff tbh",
        "Can u just give me more time? It won't happen again 🙏😊",
        "My friends also didn't submit btw so maybe just extend for everyone??",
      ],
      signOff: "(no sign-off)",
    },
    errors: [
      { id: "no-subject", label: "Missing email subject line", explanation: "Every professional email needs a clear subject line so the recipient knows what to expect." },
      { id: "wrong-greeting", label: "Inappropriate greeting ('Hey Prof')", explanation: "'Dear Dr Surname' or 'Good morning Prof Surname' is the correct form for academic email." },
      { id: "abbreviations", label: "Text abbreviations (lol, tbh, u)", explanation: "Abbreviations are for personal texts, not professional or academic communication." },
      { id: "emoji", label: "Emojis in a professional email", explanation: "Emojis are never appropriate in formal academic or professional correspondence." },
      { id: "blame-others", label: "Blaming others / deflecting responsibility", explanation: "Mentioning that friends also didn't submit undermines your credibility and is inappropriate." },
      { id: "no-signoff", label: "No professional sign-off", explanation: "Always end with 'Kind regards,' or 'Yours sincerely,' followed by your full name and student number." },
    ],
  },
  {
    context: "Job application email to a bank's HR department",
    badEmail: {
      subject: "Job",
      greeting: "To whom it may concern or whatever",
      body: [
        "I seen your ad for a junior analyst position and I want to apply.",
        "I am a very hard worker and I'm passionate about banking and stuff.",
        "My CV is attached I think.",
        "I'm available for interviews whenever, just WhatsApp me.",
      ],
      signOff: "Thanks\nMike",
    },
    errors: [
      { id: "vague-subject", label: "Vague subject line ('Job')", explanation: "The subject should be specific: 'Application: Junior Analyst Position – Ref: BA2024'." },
      { id: "dismissive-greeting", label: "Dismissive greeting phrasing", explanation: "'To whom it may concern' is acceptable but 'or whatever' makes it sound careless. Research the contact person's name." },
      { id: "grammar-error", label: "Grammar error ('I seen')", explanation: "Correct form is 'I saw' — grammar errors in a job application are immediately disqualifying." },
      { id: "vague-language", label: "Vague language ('stuff', 'I think')", explanation: "Vague language signals lack of preparation. Specificity and confidence are essential in applications." },
      { id: "informal-contact", label: "Requesting WhatsApp contact", explanation: "Always use professional channels. Never ask an employer to WhatsApp you for interview arrangements." },
      { id: "no-student-number", label: "No full professional sign-off", explanation: "Include: full name, degree, university, student number (if student), phone, and email address." },
    ],
  },
  {
    context: "Internship follow-up email after an interview",
    badEmail: {
      subject: "just checking in",
      greeting: "Hi there",
      body: [
        "I interviewed with you guys like 2 weeks ago for the marketing internship.",
        "I haven't heard back so I'm just following up.",
        "Hopefully you pick me cause I really need this lol",
        "If you're not going to offer it to me just let me know so I can apply somewhere else.",
      ],
      signOff: "Regards\nZanele",
    },
    errors: [
      { id: "lowercase-subject", label: "Lowercase subject line", explanation: "Email subject lines should use title case: 'Follow-Up: Marketing Internship Interview – 5 May'." },
      { id: "vague-greeting", label: "Vague greeting ('Hi there')", explanation: "Address the specific person by name: 'Dear Ms Dlamini,' — you met them at the interview." },
      { id: "informal-tone", label: "Informal/casual phrasing ('you guys', 'like')", explanation: "Professional follow-up emails must maintain the same formal register as your original application." },
      { id: "emotional-pressure", label: "Emotional pressure ('I really need this')", explanation: "Sharing personal need in a professional follow-up appears unprepared and desperate." },
      { id: "ultimatum", label: "Giving an ultimatum to the employer", explanation: "Never pressure an employer. A follow-up should express continued interest and reaffirm your value." },
    ],
  },
  {
    context: "Student complaint email to the university registrar",
    badEmail: {
      subject: "URGENT!!!!! This is ridiculous",
      greeting: "Hello",
      body: [
        "I am VERY ANGRY about my registration being cancelled without warning.",
        "This is completely unacceptable and I will be going to the media if this isn't fixed TODAY.",
        "Other students have the same problem so clearly your system is broken.",
        "I paid my fees so you have no right to do this.",
      ],
      signOff: "Angrily,\nThabo M",
    },
    errors: [
      { id: "all-caps-subject", label: "Excessive capitalisation and punctuation in subject", explanation: "Multiple exclamation marks and CAPS LOCK read as aggressive — use a professional, factual subject line." },
      { id: "aggressive-tone", label: "Aggressive/threatening tone ('going to media')", explanation: "Even when you're right, threatening tone closes doors. State your grievance factually and request a specific resolution." },
      { id: "vague-complaint", label: "Vague greeting ('Hello')", explanation: "Address the specific person: 'Dear Mr/Ms [Registrar's name],' — you can find this on the university website." },
      { id: "ultimatum-deadline", label: "Giving an ultimatum deadline ('fixed TODAY')", explanation: "Demanding same-day resolution of a systemic issue is unrealistic and undermines your credibility." },
      { id: "wrong-sign-off", label: "Emotionally loaded sign-off ('Angrily')", explanation: "Always end with 'Kind regards' or 'Yours sincerely' — never let frustration enter your formal sign-off." },
    ],
  },
  {
    context: "Requesting a reference letter from a professor",
    badEmail: {
      subject: "reference",
      greeting: "Hi Professor",
      body: [
        "Can you write me a reference letter? I need it by Friday.",
        "It's for a bursary application. I'm in your ECO201 class.",
        "Please make it really positive and mention my marks.",
        "Sorry for the late notice, I forgot about this.",
      ],
      signOff: "Thx\nNomvula",
    },
    errors: [
      { id: "incomplete-subject", label: "Incomplete subject line", explanation: "Specify: 'Reference Letter Request – Nomvula Khumalo – ABC Bursary 2024'." },
      { id: "no-surname", label: "Missing professor's surname in greeting", explanation: "Use 'Dear Professor Mahlangu,' — using just 'Professor' is impersonal and shows you don't know them." },
      { id: "short-notice", label: "Giving insufficient notice without proper apology", explanation: "Requests for reference letters need at least 2-3 weeks notice. Acknowledge this properly, not as an afterthought." },
      { id: "dictating-content", label: "Telling the referee what to write", explanation: "Never tell someone what to say in a reference letter — it's disrespectful and undermines their independence." },
      { id: "informal-signoff", label: "Informal sign-off ('Thx')", explanation: "Sign off with 'Kind regards,' followed by your full name, student number, and contact details." },
    ],
  },
];

type Phase = "idle" | "playing" | "result" | "done";

export default function EmailEtiquettePage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [pairIdx, setPairIdx] = useState(0);
  const [selectedErrors, setSelectedErrors] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(45);
  const [totalScore, setTotalScore] = useState(0);
  const [pairScores, setPairScores] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const pair = EMAIL_PAIRS[pairIdx];

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startTimer = () => {
    stopTimer();
    setTimeLeft(45);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          submitErrors();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const startPair = (idx: number) => {
    setPairIdx(idx);
    setSelectedErrors(new Set());
    setPhase("playing");
    startTimer();
  };

  const submitErrors = () => {
    stopTimer();
    const currentPair = EMAIL_PAIRS[pairIdx];
    const correctIds = new Set(currentPair.errors.map((e) => e.id));
    let score = 0;
    selectedErrors.forEach((id) => {
      if (correctIds.has(id)) score += 10;
      else score -= 5;
    });
    correctIds.forEach((id) => {
      if (!selectedErrors.has(id)) score -= 3;
    });
    score = Math.max(0, score);
    setPairScores((prev) => [...prev, score]);
    setTotalScore((prev) => prev + score);
    setPhase("result");
  };

  useEffect(() => {
    return () => stopTimer();
  }, []);

  const toggleError = (id: string) => {
    setSelectedErrors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const nextPair = async () => {
    const next = pairIdx + 1;
    if (next >= EMAIL_PAIRS.length) {
      setPhase("done");
      if (!submitted) {
        setSubmitted(true);
        await fetch("/api/games/scores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gameType: "email_etiquette", score: totalScore, metadata: { pairs: EMAIL_PAIRS.length } }),
        }).catch(() => {});
      }
    } else {
      startPair(next);
    }
  };

  if (phase === "idle") {
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.intro}>
            <Link className="button" href="/community/games">← Games</Link>
            <h1>Email Etiquette</h1>
            <p className="subtitle">Spot every error in the badly written email before time runs out. 5 email scenarios.</p>
            <div className={styles.howTo}>
              <h3>How to play</h3>
              <ul>
                <li>Read the bad email for a given professional context.</li>
                <li>Click every error you can find. 45 seconds per email.</li>
                <li>+10 for each correct error · −5 for false positives · −3 for missed errors.</li>
              </ul>
            </div>
            <button className="button" onClick={() => startPair(0)}>Start game</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    const errorOptions = [...pair.errors].sort(() => Math.random() - 0.5);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>{pairIdx + 1} / {EMAIL_PAIRS.length}</span>
            <div className={`${styles.timer} ${timeLeft <= 10 ? styles.timerUrgent : ""}`}>{timeLeft}s</div>
            <span className={styles.score}>{totalScore} pts</span>
          </div>

          <p className={styles.context}>{pair.context}</p>

          <div className={styles.emailPreview}>
            <div className={styles.emailField}>
              <span className={styles.emailFieldLabel}>Subject:</span>
              <span className={pair.badEmail.subject ? "" : styles.missing}>{pair.badEmail.subject || "(no subject)"}</span>
            </div>
            <div className={styles.emailField}>
              <span className={styles.emailFieldLabel}>Greeting:</span>
              <span>{pair.badEmail.greeting}</span>
            </div>
            <div className={styles.emailBody}>
              {pair.badEmail.body.map((line, i) => <p key={i}>{line}</p>)}
            </div>
            <div className={styles.emailField}>
              <span className={styles.emailFieldLabel}>Sign-off:</span>
              <span>{pair.badEmail.signOff}</span>
            </div>
          </div>

          <p className={styles.instruction}>Select all errors you can spot:</p>
          <div className={styles.errorOptions}>
            {pair.errors.map((err) => (
              <button
                key={err.id}
                className={`${styles.errorBtn} ${selectedErrors.has(err.id) ? styles.selected : ""}`}
                onClick={() => toggleError(err.id)}
              >
                {err.label}
              </button>
            ))}
            {/* Decoys */}
            <button className={styles.errorBtn} style={{ opacity: 0.5 }}>Too much detail in the body</button>
            <button className={styles.errorBtn} style={{ opacity: 0.5 }}>Email is too short</button>
          </div>

          <button className="button" onClick={() => submitErrors()}>Submit</button>
        </div>
      </div>
    );
  }

  if (phase === "result") {
    const roundScore = pairScores[pairScores.length - 1];
    const correctIds = new Set(pair.errors.map((e) => e.id));
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.header}>
            <span className={styles.progress}>{pairIdx + 1} / {EMAIL_PAIRS.length}</span>
            <span className={styles.score}>+{roundScore} pts · {totalScore} total</span>
          </div>
          <h2 className={styles.resultTitle}>{pair.context}</h2>
          <div className={styles.resultList}>
            {pair.errors.map((err) => {
              const found = selectedErrors.has(err.id);
              return (
                <div key={err.id} className={`${styles.resultRow} ${found ? styles.correct : styles.wrong}`}>
                  <span className={styles.tick}>{found ? "✓" : "✗"}</span>
                  <div>
                    <strong>{err.label}</strong>
                    <p className={styles.explanation}>{err.explanation}</p>
                  </div>
                </div>
              );
            })}
            {Array.from(selectedErrors).filter((id) => !correctIds.has(id)).map((id) => (
              <div key={id} className={`${styles.resultRow} ${styles.falsePositive}`}>
                <span className={styles.tick}>−</span>
                <div>
                  <strong>False positive: not actually an error</strong>
                </div>
              </div>
            ))}
          </div>
          <button className="button" onClick={nextPair}>
            {pairIdx + 1 < EMAIL_PAIRS.length ? "Next email →" : "See final score"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const maxScore = EMAIL_PAIRS.length * 50;
    const pct = Math.round((totalScore / maxScore) * 100);
    return (
      <div className="route-lock-dock">
        <div className="route-lock-frame glass card">
          <div className={styles.done}>
            <h1>{pct >= 80 ? "Corporate Ready" : pct >= 60 ? "Progressing Well" : "Keep Practising"}</h1>
            <p className={styles.finalScore}>{totalScore} pts · {pct}%</p>
            <p className="subtitle">Professional email skills are assessed in every job interview and workplace interaction.</p>
            <div className={styles.doneActions}>
              <button className="button" onClick={() => { setTotalScore(0); setPairScores([]); setSubmitted(false); startPair(0); }}>Play again</button>
              <Link className="button" href="/community/games">All games</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
