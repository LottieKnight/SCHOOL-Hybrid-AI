"use client";

import { useEffect, useState } from "react";

type AdminCheck = { isAdmin: boolean };

const PHASES = ["foundation", "intermediate", "senior", "fet"];

export function AdminGenerateTermV1() {
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [phase, setPhase] = useState("foundation");
  const [grade, setGrade] = useState(1);
  const [subjectKey, setSubjectKey] = useState("");
  const [term, setTerm] = useState(1);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

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

  const handleGenerate = async () => {
    if (!subjectKey.trim()) {
      appendLog("Subject key is required.");
      return;
    }

    setRunning(true);
    appendLog(`Starting v1 batch for ${phase} grade ${grade} ${subjectKey}, term ${term}...`);

    try {
      const response = await fetch("/api/admin/generate-term-v1", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          grade,
          subject: subjectKey.trim(),
          term,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        appendLog(`Batch failed: ${data?.error || "Unknown error"}`);
      } else {
        (data?.results || []).forEach((entry: any) => {
          if (entry.error) {
            appendLog(`Week ${entry.week} failed: ${entry.error || "Unknown error"}`);
          } else if (entry.skipped) {
            appendLog(`Week ${entry.week} skipped (already generated).`);
          } else {
            appendLog(`Week ${entry.week} generated.`);
          }
        });
        appendLog("Batch generation complete.");
      }
    } catch (error: any) {
      appendLog(`Batch error: ${error?.message || "Unknown error"}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="card" style={{ marginTop: "1.5rem" }}>
      <h2 className="subtitle">Generate Full Term (v1)</h2>
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
      </div>

      <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button type="button" className="button" disabled={running} onClick={handleGenerate}>
          {running ? "Generating..." : "Generate term"}
        </button>
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
