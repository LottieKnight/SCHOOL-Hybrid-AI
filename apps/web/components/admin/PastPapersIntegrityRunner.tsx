"use client";

import { useActionState } from "react";

type IntegrityCheck = {
  name: string;
  ok: boolean;
  detail: string;
  data?: Record<string, unknown>;
};

type IntegrityRunnerState = {
  ran: boolean;
  ok: boolean | null;
  ranAtIso: string | null;
  checks: IntegrityCheck[];
  error: string | null;
};

type RunnerProps = {
  action: (state: IntegrityRunnerState) => Promise<IntegrityRunnerState>;
  initialState: IntegrityRunnerState;
};

export function PastPapersIntegrityRunner({ action, initialState }: RunnerProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="list-item" style={{ display: "grid", gap: "10px" }}>
      <form action={formAction}>
        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Running checks..." : "Run DB Integrity Checks"}
        </button>
      </form>

      {state.ran ? (
        <div className="list">
          <div className="badge">
            Result: {state.ok ? "PASS" : "FAIL"} {state.ranAtIso ? `(${state.ranAtIso})` : ""}
          </div>
          {state.error ? <div className="profile-notice profile-notice--error">{state.error}</div> : null}
          {state.checks.map((check) => (
            <div key={check.name} className="list-item">
              <strong>{check.name}</strong>
              <div className="badge">{check.ok ? "OK" : "FAIL"}</div>
              <div>{check.detail}</div>
              {check.data ? (
                <pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
                  {JSON.stringify(check.data, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="badge">Run the integrity checks to validate DB + storage state.</div>
      )}
    </div>
  );
}
