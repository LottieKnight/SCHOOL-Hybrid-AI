"use client";

import { useEffect, useRef, useState } from "react";

type AdminCheck = { isAdmin: boolean };

const PHASES = ["foundation", "intermediate", "senior", "fet"];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AdminGenerateWeekRangeV1() {
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phase, setPhase] = useState("foundation");
  const [grade, setGrade] = useState(1);
  const [subjectKey, setSubjectKey] = useState("");
  const [term, setTerm] = useState(1);
  const [startWeek, setStartWeek] = useState(1);
  const [endWeek, setEndWeek] = useState(10);
  const [topic, setTopic] = useState("");
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const abortRef = useRef(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/admin/check", { credentials: "include", cache: "no-store" });
        if (!response.ok) {
          if (active) {
            setIsAdmin(false);
            setChecked(true);
          }
          return;
        }
        const data = (await response.json()) as AdminCheck;
        if (active) {
          setIsAdmin(Boolean(data.isAdmin));
          setChecked(true);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
          setChecked(true);
        }
      }
    };
    check();
    return () => {
      active = false;
    };
  }, []);

  if (!checked || !isAdmin) return null;

  const appendLog = (message: string) => {
    setLogs((prev) => [...prev, message].slice(-30));
  };

  const handleStop = () => {
    abortRef.current = true;
    setRunning(false);
    appendLog("Stopped batch generation.");
  };

  const handleGenerate = async () => {
    if (!subjectKey.trim()) {
      appendLog("Subject key is required.");
      return;
    }
    if (startWeek > endWeek) {
      appendLog("Start week must be <= end week.");
      return;
    }

    setRunning(true);
    abortRef.current = false;
    appendLog(`Starting v1 week-range generation for ${phase} grade ${grade} ${subjectKey}, term ${term}...`);

    for (let week = startWeek; week <= endWeek; week += 1) {
      if (abortRef.current) break;
      appendLog(`Generating week ${week}...`);
      try {
        const response = await fetch("/api/admin/generate-lesson-v1", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phase,
            grade,
            subject: subjectKey.trim(),
            term,
            week,
            topic: topic.trim() || undefined,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          appendLog(`Week ${week} failed: ${data?.error || "Unknown error"}`);
        } else if (data?.skipped) {
          appendLog(`Week ${week} skipped (already generated).`);
        } else {
          appendLog(`Week ${week} generated: ${data?.lessonPath || "ok"}`);
        }
      } catch (error: any) {
        appendLog(`Week ${week} error: ${error?.message || "Unknown error"}`);
      }
      await delay(600);
    }

    setRunning(false);
    if (!abortRef.current) {
      appendLog("Batch generation complete.");
    }
  };

  return (
    <div className="card" style={{ marginTop: "1.5rem" }}>
      <h2 className="subtitle">Generate Week Range (v1)</h2>
      <p className="badge">Runs week-by-week with a short delay to avoid overload.</p>

      <div className="grid" style={{ marginTop: "0.75rem" }}>
        <label className="list-item">
          <span>Phase</span>
          <select value={phase} onChange={(event) => setPhase(event.target.value)}>
            {PHASES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="list-item">
          <span>Grade</span>
          <input
            type="number"
            min={0}
            max={12}
            value={grade}
            onChange={(event) => setGrade(Number(event.target.value))}
          />
        </label>

        <label className="list-item">
          <span>Subject key</span>
          <input
            value={subjectKey}
            onChange={(event) => setSubjectKey(event.target.value)}
            placeholder="english-home-language"
          />
        </label>

        <label className="list-item">
          <span>Term</span>
          <input
            type="number"
            min={1}
            max={4}
            value={term}
            onChange={(event) => setTerm(Number(event.target.value))}
          />
        </label>

        <label className="list-item">
          <span>Start week</span>
          <input
            type="number"
            min={1}
            max={53}
            value={startWeek}
            onChange={(event) => setStartWeek(Number(event.target.value))}
          />
        </label>

        <label className="list-item">
          <span>End week</span>
          <input
            type="number"
            min={1}
            max={53}
            value={endWeek}
            onChange={(event) => setEndWeek(Number(event.target.value))}
          />
        </label>

        <label className="list-item">
          <span>Topic (optional)</span>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="fractions" />
        </label>
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" className="button" disabled={running} onClick={handleGenerate}>
          {running ? "Generating..." : "Generate term"}
        </button>
        {running ? (
          <button type="button" className="button" onClick={handleStop}>
            Stop
          </button>
        ) : null}
      </div>

      {logs.length ? (
        <div className="glass" style={{ marginTop: "0.75rem", padding: "0.75rem", maxHeight: "220px", overflow: "auto" }}>
          {logs.map((log, index) => (
            <div key={`${log}-${index}`} className="badge" style={{ display: "block", marginBottom: "0.35rem" }}>
              {log}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
