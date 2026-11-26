"use client";

import { useState } from "react";
import styles from "./ApsCalculator.module.css";

type SubjectScore = {
  id: string;
  name: string;
  mark: number;
  isLo: boolean;
};

const DEFAULT_SUBJECTS: SubjectScore[] = [
  { id: "1", name: "Home Language (e.g. English / isiZulu)", mark: 72, isLo: false },
  { id: "2", name: "First Additional Language (e.g. Afrikaans / Sepedi)", mark: 68, isLo: false },
  { id: "3", name: "Mathematics / Mathematical Literacy", mark: 75, isLo: false },
  { id: "4", name: "Life Orientation", mark: 82, isLo: true },
  { id: "5", name: "Physical Sciences / Accounting", mark: 70, isLo: false },
  { id: "6", name: "Life Sciences / Economics", mark: 65, isLo: false },
  { id: "7", name: "Elective (e.g. History / Geography / IT)", mark: 74, isLo: false },
];

function markToApsPoints(mark: number): number {
  if (mark >= 80) return 7;
  if (mark >= 70) return 6;
  if (mark >= 60) return 5;
  if (mark >= 50) return 4;
  if (mark >= 40) return 3;
  if (mark >= 30) return 2;
  return 1;
}

type UniversityRequirement = {
  institution: string;
  faculty: string;
  minAps: number;
  notes: string;
};

const UNIVERSITY_REQUIREMENTS: UniversityRequirement[] = [
  { institution: "University of the Witwatersrand (Wits)", faculty: "Health Sciences (MBChB)", minAps: 45, notes: "Requires Math & Physical Sciences > 70%" },
  { institution: "University of the Witwatersrand (Wits)", faculty: "Engineering & Built Environment", minAps: 42, notes: "Requires Pure Math > 70%" },
  { institution: "University of the Witwatersrand (Wits)", faculty: "Commerce, Law & Management", minAps: 38, notes: "Math > 60% required" },
  { institution: "University of Cape Town (UCT)", faculty: "Engineering & Science", minAps: 40, notes: "FPS benchmark excludes LO" },
  { institution: "University of Pretoria (UP)", faculty: "Health Sciences", minAps: 38, notes: "High competition" },
  { institution: "University of Pretoria (UP)", faculty: "Engineering, Built Environment & IT", minAps: 35, notes: "Pure Math required" },
  { institution: "Stellenbosch University", faculty: "Science & AgriSciences", minAps: 34, notes: "Language 50%+, Math 60%+" },
  { institution: "North-West University (NWU)", faculty: "Health Sciences", minAps: 32, notes: "Selection process applies" },
  { institution: "North-West University (NWU)", faculty: "Law & Economic Sciences", minAps: 28, notes: "Math 50%+ or Math Lit 70%+" },
  { institution: "University of Johannesburg (UJ)", faculty: "Engineering & Science", minAps: 30, notes: "Excludes LO" },
  { institution: "University of KwaZulu-Natal (UKZN)", faculty: "Law & Management Studies", minAps: 32, notes: "NSC bachelor pass required" },
];

export function ApsCalculator() {
  const [subjects, setSubjects] = useState<SubjectScore[]>(DEFAULT_SUBJECTS);

  const updateMark = (id: string, newMark: number) => {
    const valid = Math.max(0, Math.min(100, isNaN(newMark) ? 0 : newMark));
    setSubjects((prev) => prev.map((s) => (s.id === id ? { ...s, mark: valid } : s)));
  };

  // Exclude Life Orientation for standard NSC APS calculation (6 main subjects)
  const mainSubjects = subjects.filter((s) => !s.isLo);
  const totalAps = mainSubjects.reduce((acc, s) => acc + markToApsPoints(s.mark), 0);
  const loAps = subjects.find((s) => s.isLo) ? markToApsPoints(subjects.find((s) => s.isLo)!.mark) : 0;
  const totalApsWithLo = totalAps + loAps;

  const qualifyingUnis = UNIVERSITY_REQUIREMENTS.filter((u) => totalAps >= u.minAps);

  return (
    <div id="aps-calculator" className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>🎓 South African APS Calculator & University Matcher</h2>
        <p className={styles.subtitle}>
          Enter your 7 NSC Grade 11/12 subject marks to calculate your Admission Point Score (APS) and view qualifying university faculties.
        </p>
      </div>

      <div className={styles.mainGrid}>
        {/* Subject Inputs */}
        <div className={styles.subjectCard}>
          <h3 className={styles.cardHeading}>1. Enter NSC Subject Percentage (%) Marks</h3>
          <div className={styles.subjectList}>
            {subjects.map((sub) => {
              const points = markToApsPoints(sub.mark);
              return (
                <div key={sub.id} className={styles.subjectRow}>
                  <div className={styles.subMeta}>
                    <span className={styles.subName}>{sub.name}</span>
                    {sub.isLo && <span className={styles.loBadge}>Life Orientation</span>}
                  </div>

                  <div className={styles.inputWrap}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={sub.mark}
                      onChange={(e) => updateMark(sub.id, parseInt(e.target.value, 10))}
                      className={styles.markInput}
                    />
                    <span className={styles.pointsTag}>Level {points} ({points} pts)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score & Matches */}
        <div className={styles.resultsCard}>
          <div className={styles.scoreHero}>
            <div className={styles.scoreNumber}>{totalAps}</div>
            <div className={styles.scoreLabel}>Total APS Score (Excl. LO)</div>
            <div className={styles.scoreSubtext}>
              With Life Orientation: <strong>{totalApsWithLo} APS</strong>
            </div>
          </div>

          <h3 className={styles.cardHeading}>2. Qualifying Faculties ({qualifyingUnis.length} Matches)</h3>

          <div className={styles.uniList}>
            {qualifyingUnis.map((uni, idx) => (
              <div key={idx} className={styles.uniItem}>
                <div className={styles.uniHead}>
                  <span className={styles.uniName}>{uni.institution}</span>
                  <span className={styles.uniMin}>Min: {uni.minAps} APS</span>
                </div>
                <div className={styles.uniFaculty}>{uni.faculty}</div>
                <div className={styles.uniNotes}>{uni.notes}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
