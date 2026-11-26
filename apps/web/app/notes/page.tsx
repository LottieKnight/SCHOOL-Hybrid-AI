"use client";

import { Suspense } from "react";
import { FeatureGate } from "@/components/FeatureGate";

export default function NotesPage() {
  return (
    <div className="route-lock-dock">
      <div className="route-lock-frame glass card card-with-back" style={{ display: "grid", gap: "18px" }}>
        <div>
          <span className="eyebrow">My Notes</span>
          <h1 className="title" style={{ marginTop: "0.2rem" }}>Notes stay attached to your study flow.</h1>
          <p className="subtitle">Guests can browse the platform, but saving and syncing notes requires a free account.</p>
        </div>
        <Suspense fallback={null}>
          <FeatureGate
            tier="free"
            title="Create a free account to save notes"
            description="Free accounts unlock note saving, session history, and persistent study context."
          >
            <div className="glass card" style={{ padding: "18px" }}>
              Your saved-notes workspace will live here for signed-in users.
            </div>
          </FeatureGate>
        </Suspense>
      </div>
    </div>
  );
}
