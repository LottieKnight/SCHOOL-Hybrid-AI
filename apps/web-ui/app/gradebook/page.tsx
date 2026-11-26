"use client";
import { useEffect, useState } from "react";

type Grade = {
  id: number;
  studentName: string;
  subject: string;
  score: number;
};

export default function GradebookPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/grades")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: Grade[]) => {
        setGrades(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading grades…</p>;
  if (error) return <p>Failed to load grades: {error}</p>;

  return (
    <div className="glass-card" style={{ padding: "2rem", minWidth: "300px" }}>
      <h2 style={{ color: "var(--color-primary)", marginBottom: "1rem" }}>Real‑time Gradebook</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid var(--color-bg-light)" }}>Student</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid var(--color-bg-light)" }}>Subject</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid var(--color-bg-light)" }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {grades.map((g) => (
            <tr key={g.id}>
              <td>{g.studentName}</td>
              <td>{g.subject}</td>
              <td>{g.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
