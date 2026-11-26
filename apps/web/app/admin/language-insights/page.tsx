"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";

type LanguageInsightsPayload = {
  ok: boolean;
  totals: {
    searchEvents: number;
    rewriteEvents: number;
    feedbackEvents: number;
  };
  topQueries: Array<{ query: string; count: number }>;
  topRewriteModes: Array<{ mode: string; count: number }>;
  topModules: Array<{ moduleCode: string; count: number }>;
  topSurfaces: Array<{ surface: string; count: number }>;
  topModuleQueries: Array<{ moduleCode: string; query: string; count: number }>;
};

export default function AdminLanguageInsightsPage() {
  const [data, setData] = useState<LanguageInsightsPayload | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/language/insights", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as LanguageInsightsPayload | null;
      if (!response.ok || !payload) {
        throw new Error("Unable to load language insights.");
      }
      setData(payload);
      setNotice(null);
    } catch (error) {
      setData(null);
      setNotice(error instanceof Error ? error.message : "Unable to load language insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moduleOptions = useMemo(() => ["ALL", ...(data?.topModules.map((item) => item.moduleCode) ?? [])], [data?.topModules]);
  const filteredModuleQueries = useMemo(
    () => (selectedModule === "ALL" ? data?.topModuleQueries ?? [] : (data?.topModuleQueries ?? []).filter((item) => item.moduleCode === selectedModule)),
    [data?.topModuleQueries, selectedModule]
  );

  return (
    <div className="glass card card-with-back">
      <h1 className="title">Language insights</h1>
      <p className="subtitle">Inspect language-layer usage, recurring queries, and rewrite behavior without leaving the admin surface.</p>
      <AdminQuickLinks />
      <div className="outline-actions">
        <button type="button" className="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {notice ? <div className="badge">{notice}</div> : null}

      <div className="spacer" />
      <h3>Module drilldown</h3>
      <div className="outline-actions" style={{ gap: 8, flexWrap: "wrap" }}>
        {moduleOptions.map((item) => (
          <button
            key={item}
            type="button"
            className="button"
            onClick={() => setSelectedModule(item)}
            aria-pressed={selectedModule === item}
            style={{ opacity: selectedModule === item ? 1 : 0.7 }}
          >
            {item}
          </button>
        ))}
      </div>

      <h3>Totals</h3>
      {loading ? (
        <p className="subtitle">Loading totals...</p>
      ) : !data ? (
        <p className="subtitle">Language insights unavailable.</p>
      ) : (
        <div className="grid">
          <div className="list-item">
            <strong>Search events</strong>
            <p className="subtitle">{data.totals.searchEvents}</p>
          </div>
          <div className="list-item">
            <strong>Rewrite events</strong>
            <p className="subtitle">{data.totals.rewriteEvents}</p>
          </div>
          <div className="list-item">
            <strong>Feedback events</strong>
            <p className="subtitle">{data.totals.feedbackEvents}</p>
          </div>
        </div>
      )}

      <div className="spacer" />
      <h3>Top queries</h3>
      {loading ? (
        <p className="subtitle">Loading top queries...</p>
      ) : !data || data.topQueries.length === 0 ? (
        <p className="subtitle">No search events captured yet.</p>
      ) : (
        <div className="list">
          {data.topQueries.map((item) => (
            <div key={item.query} className="list-item">
              <strong>{item.query}</strong>
              <p className="subtitle">{item.count} search events</p>
            </div>
          ))}
        </div>
      )}

      <div className="spacer" />
      <h3>Top rewrite modes</h3>
      {loading ? (
        <p className="subtitle">Loading rewrite modes...</p>
      ) : !data || data.topRewriteModes.length === 0 ? (
        <p className="subtitle">No rewrite events captured yet.</p>
      ) : (
        <div className="list">
          {data.topRewriteModes.map((item) => (
            <div key={item.mode} className="list-item">
              <strong>{item.mode}</strong>
              <p className="subtitle">{item.count} rewrite events</p>
            </div>
          ))}
        </div>
      )}

      <div className="spacer" />
      <h3>Top modules</h3>
      {loading ? (
        <p className="subtitle">Loading module activity...</p>
      ) : !data || data.topModules.length === 0 ? (
        <p className="subtitle">No module-tagged search events yet.</p>
      ) : (
        <div className="list">
          {data.topModules.map((item) => (
            <div key={item.moduleCode} className="list-item">
              <strong>{item.moduleCode}</strong>
              <p className="subtitle">{item.count} search events</p>
            </div>
          ))}
        </div>
      )}

      <div className="spacer" />
      <h3>Top surfaces</h3>
      {loading ? (
        <p className="subtitle">Loading surface activity...</p>
      ) : !data || data.topSurfaces.length === 0 ? (
        <p className="subtitle">No surface-tagged search events yet.</p>
      ) : (
        <div className="list">
          {data.topSurfaces.map((item) => (
            <div key={item.surface} className="list-item">
              <strong>{item.surface}</strong>
              <p className="subtitle">{item.count} search events</p>
            </div>
          ))}
        </div>
      )}

      <div className="spacer" />
      <h3>{selectedModule === "ALL" ? "Top module queries" : `${selectedModule} query patterns`}</h3>
      {loading ? (
        <p className="subtitle">Loading module queries...</p>
      ) : !data || filteredModuleQueries.length === 0 ? (
        <p className="subtitle">No module query patterns captured yet.</p>
      ) : (
        <div className="list">
          {filteredModuleQueries.map((item) => (
            <div key={`${item.moduleCode}-${item.query}`} className="list-item">
              <strong>{item.moduleCode}</strong>
              <p className="subtitle">{item.query}</p>
              <p className="subtitle">{item.count} matching search events</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
