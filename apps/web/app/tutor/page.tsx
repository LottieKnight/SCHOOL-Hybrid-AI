import type { Metadata } from "next";
import { Suspense } from "react";
import { TutorLoader } from "@/components/tutor/TutorLoader";

export const metadata: Metadata = {
  title: "Hybrid tutor",
  description: "On-device and cloud CAPS tutor for Grade 10-12. Hints prefer Gemini Nano. Long answers and PDFs use cloud Gemini.",
};

export default function TutorPage() {
  return (
    <Suspense fallback={<p className="card">Opening the tutor on this device…</p>}>
      <TutorLoader />
    </Suspense>
  );
}
