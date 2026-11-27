"use client";

import { Suspense } from "react";
import { FlagshipEntry } from "@/components/auth/FlagshipEntry";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <FlagshipEntry />
    </Suspense>
  );
}
