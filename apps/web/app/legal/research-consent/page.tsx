"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./page.module.css";

export default function ResearchConsentPage() {
  const [section, setSection] = useState<"info" | "consent">("info");
  const [checkboxes, setCheckboxes] = useState({
    read: false,
    voluntary: false,
    withdraw: false,
    data: false,
    agree: false,
  });

  const allChecked = Object.values(checkboxes).every(Boolean);

  return (
    <div className={styles.wrap}>
      <Link href="/community/games" className={styles.back}>
        ← Back to Games
      </Link>

      <div className={styles.lockup}>
        <div className={styles.mark}>○ ◇ ○</div>
        <div className={styles.org}>The Observatory</div>
        <div className={styles.partner}>AURA Laboratory × SCHOOL Research</div>
        <div className={styles.divider}></div>
        <div className={styles.badge}>Research Participation</div>
      </div>

      <h1 className={styles.title}>Participant Information & Informed Consent</h1>

      <div className={styles.tabs}>
        <button
          className={styles.tab}
          data-active={section === "info"}
          onClick={() => setSection("info")}
        >
          Study Information
        </button>
        <button
          className={styles.tab}
          data-active={section === "consent"}
          onClick={() => setSection("consent")}
        >
          Consent Form
        </button>
      </div>

      {section === "info" && (
        <div className={styles.content}>
          <h2 className={styles.heading}>Research Study: Observational Silence</h2>

          <section className={styles.section}>
            <h3>1. Introduction</h3>
            <p>
              You are invited to participate in the <strong>Observational Silence</strong> research study, conducted
              by <strong>AURA AI Laboratory</strong> in partnership with <strong>Mondli Manzi</strong> (Department of
              Psychology, North-West University) and <strong>SCHOOL</strong>. This study is part of the SCHOOL Game
              Center, a platform designed to make learning engaging while contributing to real research.
            </p>
            <p>Please read the information below carefully. Ask questions if anything is unclear.</p>
          </section>

          <section className={styles.section}>
            <h3>2. Study Purpose</h3>
            <p>
              This research investigates <strong>selective attention</strong> — the ability to focus on one thing
              while ignoring others.
            </p>
            <p>Specifically:</p>
            <ul>
              <li>Can people miss unexpected events when their attention is focused elsewhere?</li>
              <li>How does attention affect what we perceive?</li>
              <li>Does the colour of an unexpected object affect whether we notice it?</li>
            </ul>
            <p>
              This study replicates a classic psychology paradigm (Simons & Chabris, 1999) in a modern, interactive
              format. It contributes to our understanding of human attention and perception.
            </p>
          </section>

          <section className={styles.section}>
            <h3>3. What Participation Involves</h3>
            <p>
              If you consent, you will participate in a <strong>~2-minute interactive animation task</strong>:
            </p>
            <ul>
              <li>
                <strong>Primary Task:</strong> Watch coloured circles pass tokens on screen and count how many times
                the teal (blue-green) circles pass their token to each other.
              </li>
              <li>
                <strong>Hidden Element:</strong> During the animation, unexpected events occur. Afterwards, you will
                answer questions about what you noticed.
              </li>
              <li>
                <strong>Questionnaire:</strong> A graded series of yes/no questions about your observations, plus
                recall probes (e.g., "What colour was the background at the end?").
              </li>
              <li>
                <strong>Confidence Rating:</strong> A simple 1–5 confidence scale.
              </li>
              <li>
                <strong>Debrief:</strong> Revelation of what you experienced and why, plus your opportunity to
                withdraw consent.
              </li>
            </ul>
            <p>
              <strong>Total time: approximately 2–3 minutes.</strong>
            </p>
          </section>

          <section className={styles.section}>
            <h3>4. How Your Data Will Be Used</h3>
            <p>
              The data you generate (responses, timing, device information, and framerate) will be stored securely
              and used only for:
            </p>
            <ul>
              <li>Academic analysis and publication in peer-reviewed journals.</li>
              <li>Presentation at academic conferences.</li>
              <li>Comparison of attention across demographic groups and device types.</li>
            </ul>
            <p>
              <strong>Your name will never appear in any publication.</strong> Your responses are linked to a
              pseudonymous participant ID, not your real identity.
            </p>
          </section>

          <section className={styles.section}>
            <h3>5. Voluntary Participation & Right to Withdraw</h3>
            <p>Your participation is entirely voluntary. You may:</p>
            <ul>
              <li>Refuse to participate before starting the study.</li>
              <li>Stop and withdraw at any point during the study without penalty.</li>
              <li>Withdraw consent after completion (within 30 days) via the debrief link.</li>
            </ul>
            <p>If you withdraw, your data will not be included in the analysis.</p>
          </section>

          <section className={styles.section}>
            <h3>6. Risks & Benefits</h3>
            <p>
              <strong>Risks:</strong> This study involves standard visual attention tasks with no known adverse
              effects. The animation is brief and non-violent. If you have epilepsy triggered by flashing lights,
              please contact us before participating.
            </p>
            <p>
              <strong>Benefits:</strong> You will contribute real data to a peer-reviewed psychological research
              project. You will also learn about selective attention in a debrief that explains the phenomenon and
              why it matters.
            </p>
            <p>
              <strong>Credit:</strong> Depending on your institution, you may receive course credit or Scholar
              Credits (within SCHOOL) for participation.
            </p>
          </section>

          <section className={styles.section}>
            <h3>7. Confidentiality & Data Protection</h3>
            <p>Your data is protected under South African POPIA (Protection of Personal Information Act, 2013).</p>
            <ul>
              <li>
                <strong>Pseudonymous storage:</strong> Your responses are linked to a participant ID, not your name
                or email.
              </li>
              <li>
                <strong>Secure transmission:</strong> All data is encrypted in transit and at rest.
              </li>
              <li>
                <strong>Limited access:</strong> Only the research team can access identifiable data.
              </li>
              <li>
                <strong>Retention:</strong> Data is retained for 7 years (standard research ethics), then securely
                deleted.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3>8. Special Protections for Minors</h3>
            <p>
              If you are under 18 years old, your parent or guardian must provide written consent for you to
              participate. This is a legal requirement in South Africa.
            </p>
          </section>

          <section className={styles.section}>
            <h3>9. Contact Information</h3>
            <p>
              <strong>Questions about this study?</strong>
              <br />
              Mondli Manzi (Researcher)
              <br />
              Department of Psychology
              <br />
              North-West University
              <br />
              Email:{" "}
              <a href="mailto:mondli.manzi@nwu.ac.za" target="_blank" rel="noopener noreferrer">
                mondli.manzi@nwu.ac.za
              </a>
            </p>
            <p>
              <strong>Questions about your rights as a research participant?</strong>
              <br />
              Research Ethics Committee
              <br />
              North-West University
              <br />
              Email:{" "}
              <a href="mailto:ethics@nwu.ac.za" target="_blank" rel="noopener noreferrer">
                ethics@nwu.ac.za
              </a>
            </p>
          </section>

          <div className={styles.cta}>
            <button
              className={styles.primaryBtn}
              onClick={() => setSection("consent")}
            >
              I Understand. Show Me the Consent Form →
            </button>
          </div>
        </div>
      )}

      {section === "consent" && (
        <div className={styles.content}>
          <h2 className={styles.heading}>Informed Consent Form</h2>
          <p className={styles.instruction}>
            By checking each box below, you confirm that you understand the information and agree to participate.
          </p>

          <div className={styles.checklistWrap}>
            <label className={styles.checkItem}>
              <input
                type="checkbox"
                checked={checkboxes.read}
                onChange={(e) => setCheckboxes({ ...checkboxes, read: e.target.checked })}
              />
              <span>
                I have read and understood the study information above.
              </span>
            </label>

            <label className={styles.checkItem}>
              <input
                type="checkbox"
                checked={checkboxes.voluntary}
                onChange={(e) => setCheckboxes({ ...checkboxes, voluntary: e.target.checked })}
              />
              <span>
                I understand that my participation is completely voluntary and I can refuse or stop at any time.
              </span>
            </label>

            <label className={styles.checkItem}>
              <input
                type="checkbox"
                checked={checkboxes.withdraw}
                onChange={(e) => setCheckboxes({ ...checkboxes, withdraw: e.target.checked })}
              />
              <span>
                I understand that I can withdraw my consent within 30 days of participation, and my data will not be
                used if I do.
              </span>
            </label>

            <label className={styles.checkItem}>
              <input
                type="checkbox"
                checked={checkboxes.data}
                onChange={(e) => setCheckboxes({ ...checkboxes, data: e.target.checked })}
              />
              <span>
                I understand that my responses will be stored pseudonymously and used only for academic research and
                publication.
              </span>
            </label>

            <label className={styles.checkItem}>
              <input
                type="checkbox"
                checked={checkboxes.agree}
                onChange={(e) => setCheckboxes({ ...checkboxes, agree: e.target.checked })}
              />
              <span>
                <strong>I agree to participate in the Observational Silence research study.</strong>
              </span>
            </label>
          </div>

          <div className={styles.ageGate}>
            <p>
              <strong>If you are under 18:</strong> By clicking "I Consent" below, you confirm that your parent or
              guardian has provided written consent on your behalf. SCHOOL's platform will verify this before
              proceeding.
            </p>
          </div>

          <div className={styles.cta}>
            <button
              className={styles.primaryBtn}
              disabled={!allChecked}
              onClick={() => {
                if (allChecked) {
                  window.location.href = "/community/games/observational-silence";
                }
              }}
            >
              {allChecked ? "I Consent — Begin Study →" : "Check all boxes to continue"}
            </button>
          </div>

          <div className={styles.footer}>
            <p className={styles.muted}>
              By proceeding, you agree to the terms above. This research has been approved by the North-West University
              Research Ethics Committee.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
