"use client";

import { useActionState } from "react";
import type { ConnectivityActionState } from "@/app/admin/diagnostics/past-papers/actions";

type RunnerProps = {
  action: (state: ConnectivityActionState) => Promise<ConnectivityActionState>;
  initialState: ConnectivityActionState;
};

export function PastPapersConnectivityRunner({ action, initialState }: RunnerProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="list-item" style={{ display: "grid", gap: "10px" }}>
      <form action={formAction}>
        <button className="button" type="submit" disabled={isPending}>
          {isPending ? "Checking connectivity..." : "Run connectivity check"}
        </button>
      </form>
      {state.ran ? (
        <div className="list">
          {state.error ? <div className="profile-notice profile-notice--error">{state.error}</div> : null}
          {state.result ? (
            <div className="list-item">
              <strong>DBE connectivity result</strong>
              <div className="badge">Status: {state.result.status}</div>
              <div className="badge">HTTP: {state.result.httpStatus ?? "n/a"}</div>
              <div className="badge">PDF links: {state.result.pdfLinkCount}</div>
              <div>{state.result.reason}</div>
              <div className="badge">Checked at: {state.result.checkedAtIso}</div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="badge">Run source connectivity check against official DBE endpoint.</div>
      )}
    </div>
  );
}
