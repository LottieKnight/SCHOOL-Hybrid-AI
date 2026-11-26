import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { AdminQuickLinks } from "@/components/AdminQuickLinks";
import { PastPapersConnectivityRunner } from "@/components/admin/PastPapersConnectivityRunner";
import { PastPapersIntegrityRunner } from "@/components/admin/PastPapersIntegrityRunner";
import { getPastPapersDiagnosticData } from "@/lib/pastPapers/diagnostics";
import type { ConnectivityActionState, IntegrityActionState } from "./actions";
import { runPastPapersConnectivityAction, runPastPapersIntegrityAction } from "./actions";

export const runtime = "nodejs";

const initialIntegrityActionState: IntegrityActionState = {
  ran: false,
  ok: null,
  ranAtIso: null,
  checks: [],
  error: null,
};

const initialConnectivityActionState: ConnectivityActionState = {
  ran: false,
  result: null,
  error: null,
};

function formatGrade(grade: number | null) {
  if (grade === null) return "Unknown";
  return grade === 0 ? "R" : String(grade);
}

function hoursSince(iso: string | null) {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  return (Date.now() - ts) / (1000 * 60 * 60);
}

export default async function PastPapersDiagnosticsPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { counts, samples, ingestStatus, sourceConnectivity, coverageSnapshot, coverageSlo, envValidation } =
    await getPastPapersDiagnosticData(5);
  const stalenessHours = hoursSince(ingestStatus.ranAtIso);
  const stale = stalenessHours !== null ? stalenessHours > 48 : true;
  const stalenessLabel =
    stalenessHours === null ? "Unknown" : `${stalenessHours.toFixed(1)} hours since last ingest`;

  return (
    <div className="glass card card-with-back">
      <BackLink href="/admin" />
      <Breadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Diagnostics", href: "/admin" },
          { label: "Past Papers" },
        ]}
      />

      <h1 className="title">Past Papers Diagnostics</h1>
      <p className="subtitle">Development-only diagnostics for ingestion, DB integrity, and file serving.</p>
      <AdminQuickLinks />

      <div className="spacer" />
      <h2 className="subtitle">Environment Validation</h2>
      <div className="list">
        <div className="list-item">
          <strong>Status</strong>
          <div className="badge">Result: {envValidation.ok ? "OK" : "FAIL"}</div>
          <div className="badge">Checked at: {envValidation.checkedAtIso}</div>
          {envValidation.issues.length ? (
            <div className="list">
              {envValidation.issues.map((issue) => (
                <div key={issue.key + issue.message} className="list-item">
                  <span className="badge">{issue.severity.toUpperCase()}</span>
                  <strong>{issue.key}</strong>
                  <div>{issue.message}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>No missing required environment variables detected.</div>
          )}
        </div>
      </div>

      <div className="spacer" />
      <h2 className="subtitle">Source Status</h2>
      <div className="list">
        <div className="list-item">
          <strong>DBE Connectivity</strong>
          <div className="badge">Status: {sourceConnectivity.status}</div>
          <div className="badge">HTTP: {sourceConnectivity.httpStatus ?? "n/a"}</div>
          <div className="badge">Direct PDF links found: {sourceConnectivity.pdfLinkCount}</div>
          <div>{sourceConnectivity.reason}</div>
          <div className="badge">Checked at: {sourceConnectivity.checkedAtIso}</div>
        </div>
        <div className="list-item">
          <strong>Last Ingest Run</strong>
          <div className="badge">Ran at: {ingestStatus.ranAtIso || "Never"}</div>
          <div className="badge">Result: {ingestStatus.ok == null ? "Unknown" : ingestStatus.ok ? "OK" : "FAIL"}</div>
          <div className="badge">Source: {ingestStatus.sourceName || "n/a"}</div>
          <div className="badge">Staleness: {stale ? "WARN" : "OK"} ({stalenessLabel})</div>
          <div className="badge">Last error: {ingestStatus.errorSummary || "None"}</div>
          <div className="badge">linksExtracted: {ingestStatus.stats?.linksExtracted ?? "n/a"}</div>
          <div className="badge">linksSelected: {ingestStatus.stats?.linksSelected ?? "n/a"}</div>
          <div className="badge">uiReadyCount: {ingestStatus.stats?.uiReadyCount ?? "n/a"}</div>
          <div className="badge">linksSkippedByProvince: {ingestStatus.stats?.linksSkippedByProvince ?? "n/a"}</div>
          <div className="badge">both/paperOnly/memoOnly: {ingestStatus.stats ? `${ingestStatus.stats.bothCount}/${ingestStatus.stats.paperOnlyCount}/${ingestStatus.stats.memoOnlyCount}` : "n/a"}</div>
          <div className="badge">repair attempted/succeeded: {ingestStatus.stats ? `${ingestStatus.stats.repairAttemptedCount}/${ingestStatus.stats.repairSucceededCount}` : "n/a"}</div>
          <div className="badge">
            bounded selection groups total/paired/single:{" "}
            {ingestStatus.stats
              ? `${ingestStatus.stats.selectionGroupsTotal}/${ingestStatus.stats.selectionGroupsWithBoth}/${ingestStatus.stats.selectionGroupsSingleOnly}`
              : "n/a"}
          </div>
          <div className="badge">
            links from paired groups: {ingestStatus.stats?.selectionLinksFromPairedGroups ?? "n/a"}
          </div>
          <div className="badge">
            repair sample IDs:{" "}
            {ingestStatus.repairSummary?.repairedIds?.length
              ? ingestStatus.repairSummary.repairedIds.join(", ")
              : "none"}
          </div>
          <div className="badge">
            drift candidates: {ingestStatus.driftReport?.candidateMatches ?? "n/a"}
          </div>
        </div>
      </div>

      <div className="spacer" />
      <h2 className="subtitle">Connectivity Check</h2>
      <PastPapersConnectivityRunner action={runPastPapersConnectivityAction} initialState={initialConnectivityActionState} />

      <div className="spacer" />
      <h2 className="subtitle">Coverage Matrix</h2>
      <div className="list">
        <div className="list-item">
          <strong>Coverage Snapshot</strong>
          <div className="badge">Generated: {coverageSnapshot.generatedAtIso}</div>
          <div className="badge">Province count: {coverageSnapshot.provinceCount}</div>
          <div className="badge">Province-grade pairs: {coverageSnapshot.pairCount}</div>
          <div className="badge">Rows with paper files: {coverageSnapshot.totalWithPaper}</div>
          <div className="badge">UI-ready rows: {coverageSnapshot.totalUiReady}</div>
        </div>
        <div className="list-item">
          <strong>Coverage SLO</strong>
          <div className="badge">Result: {coverageSlo.ok ? "PASS" : "FAIL"}</div>
          <div className="badge">Violations: {coverageSlo.violationCount}</div>
          <div className="badge">
            Config: observedMin={coverageSlo.config.minUiReadyPerObservedPair}, requiredMin=
            {coverageSlo.config.minUiReadyPerRequiredPair}
          </div>
          <div className="badge">
            Required provinces: {coverageSlo.config.requiredProvinces.length ? coverageSlo.config.requiredProvinces.join(", ") : "none"}
          </div>
          <div className="badge">Required grades: {coverageSlo.config.requiredGrades.join(", ")}</div>
          {coverageSlo.violations.length ? (
            <div className="list">
              {coverageSlo.violations.slice(0, 20).map((violation, index) => (
                <div key={`${violation.type}:${violation.province}:${violation.grade}:${index}`} className="list-item">
                  <span className="badge">{violation.type}</span>
                  <strong>
                    {violation.province} / Grade {violation.grade}
                  </strong>
                  <div>
                    uiReady={violation.uiReadyCount}, minRequired={violation.minRequired}
                  </div>
                  <div>{violation.detail}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>No SLO violations detected.</div>
          )}
        </div>
        <div className="list-item">
          <strong>Top Coverage Rows</strong>
          <div className="list">
            {coverageSnapshot.rows.slice(0, 30).map((row) => (
              <div key={`${row.province}:${row.grade}`} className="list-item">
                <strong>
                  {row.province} / Grade {row.grade}
                </strong>
                <div className="badge">
                  uiReady={row.uiReadyCount}, totalWithPaper={row.totalWithPaper}, subjects={row.subjectCount}, years=
                  {row.yearCount}, sessions={row.sessionCount}
                </div>
                <div className="badge">
                  sampleSubjects: {row.sampleSubjects.length ? row.sampleSubjects.join(", ") : "none"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="spacer" />
      <h2 className="subtitle">Counts</h2>
      <div className="grid">
        <div className="list-item">Total papers: {counts.totalPapers}</div>
        <div className="list-item">UI-ready papers: {counts.uiReadyPapers}</div>
        <div className="list-item">With paper storage key: {counts.papersWithPaperStorageKey}</div>
        <div className="list-item">With memo storage key: {counts.papersWithMemoStorageKey}</div>
        <div className="list-item">Missing paper storage key: {counts.papersMissingPaperStorageKey}</div>
        <div className="list-item">Missing memo storage key: {counts.papersMissingMemoStorageKey}</div>
        <div className="list-item">Missing original paper URL: {counts.papersMissingOriginalPaperUrl}</div>
        <div className="list-item">Missing original memo URL: {counts.papersMissingOriginalMemoUrl}</div>
        <div className="list-item">Total questions: {counts.totalQuestions}</div>
        <div className="list-item">Total attempts: {counts.totalAttempts}</div>
      </div>

      <div className="spacer" />
      <h2 className="subtitle">Run Integrity Checks</h2>
      <PastPapersIntegrityRunner action={runPastPapersIntegrityAction} initialState={initialIntegrityActionState} />

      <div className="spacer" />
      <h2 className="subtitle">Sample UI-ready Papers</h2>
      <div className="list">
        {samples.length ? (
          samples.map((sample) => (
            <div key={sample.id} className="list-item">
              <strong>{sample.title}</strong>
              <div className="badge">
                {sample.province} - Grade {formatGrade(sample.grade)} - {sample.subject} - {sample.year ?? "Unknown"} -{" "}
                {sample.session}
              </div>
              <div className="badge">ID: {sample.id}</div>
              <div className="badge">sourcePageUrl: {sample.sourcePageUrl || "null"}</div>
              <div className="badge">paperStorageKey: {sample.paperStorageKey || "null"}</div>
              <div className="badge">memoStorageKey: {sample.memoStorageKey || "null"}</div>
              <div className="badge">paperFileExists: {String(sample.paperFileExists)}</div>
              <div className="badge">memoFileExists: {String(sample.memoFileExists)}</div>
              <div className="outline-actions">
                {sample.openPaperUrl ? (
                  <a className="button" href={sample.openPaperUrl} target="_blank" rel="noreferrer">
                    Open paper file
                  </a>
                ) : (
                  <span className="badge">No paper file URL</span>
                )}
                {sample.openMemoUrl ? (
                  <a className="button" href={sample.openMemoUrl} target="_blank" rel="noreferrer">
                    Open memo file
                  </a>
                ) : (
                  <span className="badge">No memo file URL</span>
                )}
                {sample.grade !== null && sample.year !== null ? (
                  <Link
                    className="button"
                    href={
                      "/classes/demo-class/past-papers/" +
                      encodeURIComponent(sample.province) +
                      "/" +
                      sample.grade +
                      "/" +
                      encodeURIComponent(sample.subject) +
                      "/" +
                      sample.year +
                      "/" +
                      encodeURIComponent(sample.session) +
                      "/" +
                      sample.id
                    }
                  >
                    Open paper page
                  </Link>
                ) : (
                  <span className="badge">Missing grade/year for direct page link</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="list-item">No UI-ready past paper rows available yet.</div>
        )}
      </div>
    </div>
  );
}
