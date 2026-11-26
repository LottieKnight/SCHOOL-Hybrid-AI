"use client";

import dynamic from "next/dynamic";

const HybridTutor = dynamic(() => import("@/components/tutor/HybridTutor").then((mod) => mod.HybridTutor), {
  ssr: false,
  loading: () => <p className="card">Opening the tutor on this device…</p>,
});

export function TutorLoader() {
  return <HybridTutor />;
}
