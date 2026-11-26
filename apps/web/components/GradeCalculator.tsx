"use client";

import { useState } from "react";
import { calculateRequiredMark } from "../utils/gradeCalculator";
export { calculateRequiredMark };
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function GradeCalculator() {
  const [currentMark, setCurrentMark] = useState("");
  const [weight, setWeight] = useState("");
  const [target, setTarget] = useState("50");
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const c = parseFloat(currentMark);
    const w = parseFloat(weight);
    const t = parseFloat(target);

    if (isNaN(c) || isNaN(w) || isNaN(t)) return;

    setResult(calculateRequiredMark(c, w, t));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pass Predictor</CardTitle>
      </CardHeader>
      <CardBody>
        <div style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <label style={{ fontSize: "12px" }}>
              Current Mark (%)
              <input 
                type="number" 
                value={currentMark} 
                onChange={(e) => setCurrentMark(e.target.value)}
                style={{ width: "100%", marginTop: "4px" }} 
              />
            </label>
            <label style={{ fontSize: "12px" }}>
              Weighting (%)
              <input 
                type="number" 
                value={weight} 
                onChange={(e) => setWeight(e.target.value)}
                style={{ width: "100%", marginTop: "4px" }} 
              />
            </label>
          </div>
          <label style={{ fontSize: "12px" }}>
            Target Mark (%)
            <input 
              type="number" 
              value={target} 
              onChange={(e) => setTarget(e.target.value)}
              style={{ width: "100%", marginTop: "4px" }} 
            />
          </label>
          <Button variant="gold" size="sm" onClick={calculate}>Calculate Required</Button>
          
          {result !== null && (
            <div style={{ marginTop: "10px", textAlign: "center", padding: "12px", background: "var(--surface-2)", borderRadius: "8px" }}>
              <div style={{ fontSize: "11px", color: "var(--text-3)" }}>You need at least</div>
              <div style={{ fontSize: "20px", fontWeight: "bold", color: result > 100 ? "var(--red)" : "var(--gold)" }}>
                {result}%
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-3)" }}>in your remaining assessments.</div>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
