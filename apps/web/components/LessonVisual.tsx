"use client";

import { useState } from "react";
import type { LessonVisual } from "@saedu/shared";
import { DiagramVisual } from "@/components/DiagramVisual";

/**
 * Renders a single embedded visual aid (diagram / chart / image / widget) inside a
 * lesson. This is the "Google Notebook gap" renderer — keeps lessons from being 100%
 * text. Charts are drawn as inline SVG (no chart lib needed); diagrams render as a
 * styled code block until a Mermaid renderer is wired; images show a graceful
 * placeholder when no src has been generated yet; the slider widget is interactive.
 */

function BarChart({ data }: { data: { labels: string[]; values: number[] } }) {
  const max = Math.max(...data.values, 1);
  const width = 280;
  const height = 160;
  const barW = width / data.values.length;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="bar chart" style={{ maxWidth: 360 }}>
      {data.values.map((v, i) => {
        const h = (v / max) * (height - 30);
        return (
          <g key={i}>
            <rect x={i * barW + 4} y={height - 20 - h} width={barW - 8} height={h} rx={3} fill="var(--accent, #e8c15a)" />
            <text x={i * barW + barW / 2} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--text-3, #999)">
              {data.labels[i]?.slice(0, 6)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data }: { data: { labels: string[]; values: number[] } }) {
  const max = Math.max(...data.values, 1);
  const width = 280;
  const height = 160;
  const pts = data.values.map((v, i) => `${((i / Math.max(data.values.length - 1, 1)) * (width - 20) + 10).toFixed(1)},${(height - 20 - (v / max) * (height - 40)).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="line chart" style={{ maxWidth: 360 }}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent, #e8c15a)" strokeWidth={2} />
      {data.values.map((v, i) => {
        const x = (i / Math.max(data.values.length - 1, 1)) * (width - 20) + 10;
        const y = height - 20 - (v / max) * (height - 40);
        return <circle key={i} cx={x} cy={y} r={2.5} fill="var(--accent, #e8c15a)" />;
      })}
    </svg>
  );
}

function PieChart({ data }: { data: { labels: string[]; values: number[] } }) {
  const total = data.values.reduce((a, b) => a + b, 0) || 1;
  const colors = ["#e8c15a", "#f9a8d4", "#c9a24b", "#7ee787", "#ff8b6b", "#f0d27a"];
  return (
    <svg viewBox="0 0 120 120" width={160} height={160} role="img" aria-label="pie chart">
      {data.values.map((v, i) => {
        const startValue = data.values.slice(0, i).reduce((sum, value) => sum + value, 0);
        const endValue = startValue + v;
        const start = (startValue / total) * 2 * Math.PI - Math.PI / 2;
        const end = (endValue / total) * 2 * Math.PI - Math.PI / 2;
        const large = end - start > Math.PI ? 1 : 0;
        const x1 = 60 + 50 * Math.cos(start);
        const y1 = 60 + 50 * Math.sin(start);
        const x2 = 60 + 50 * Math.cos(end);
        const y2 = 60 + 50 * Math.sin(end);
        return <path key={i} d={`M60 60 L${x1} ${y1} A50 50 0 ${large} 1 ${x2} ${y2} Z`} fill={colors[i % colors.length]} />;
      })}
    </svg>
  );
}

function SliderWidget({ config }: { config: Record<string, unknown> }) {
  const min = typeof config.min === "number" ? config.min : 0;
  const max = typeof config.max === "number" ? config.max : 100;
  const [val, setVal] = useState(typeof config.default === "number" ? config.default : Math.round((min + max) / 2));
  const prompt = typeof config.prompt === "string" ? config.prompt : "Drag to explore.";
  return (
    <div style={{ padding: "10px 0" }}>
      <p style={{ fontSize: 13, color: "var(--text-3)" }}>{prompt}</p>
      <input type="range" min={min} max={max} value={val} onChange={(e) => setVal(Number(e.target.value))} style={{ width: "100%" }} />
      <p style={{ fontWeight: 700 }}>{val}</p>
    </div>
  );
}

export function LessonVisualView({ visual }: { visual: LessonVisual }) {
  return (
    <figure className="glass card" style={{ padding: "16px", margin: "14px 0" }}>
      <figcaption style={{ fontWeight: 700, marginBottom: 8 }}>{visual.title}</figcaption>
      {visual.kind === "chart" && (
        <div>
          {visual.chartType === "bar" && <BarChart data={visual.data} />}
          {visual.chartType === "line" && <LineChart data={visual.data} />}
          {visual.chartType === "pie" && <PieChart data={visual.data} />}
        </div>
      )}
      {visual.kind === "diagram" && (
        <DiagramVisual code={visual.diagramCode} caption={visual.caption} />
      )}
      {visual.kind === "image" && (
        visual.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={visual.src} alt={visual.alt} style={{ maxWidth: "100%", borderRadius: 10 }} />
        ) : (
          <div className="glass" style={{ padding: 16, color: "var(--text-3)", fontSize: 13 }}>
            🖼️ Illustration: {visual.alt} <em>(pending generation)</em>
          </div>
        )
      )}
      {visual.kind === "widget" && visual.widgetType === "slider" && <SliderWidget config={visual.config} />}
      {visual.kind === "widget" && visual.widgetType !== "slider" && (
        <div className="glass" style={{ padding: 16, color: "var(--text-3)", fontSize: 13 }}>
          🧩 Interactive: {visual.widgetType} <em>(configured)</em>
        </div>
      )}
      {visual.caption ? <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 8 }}>{visual.caption}</p> : null}
    </figure>
  );
}
