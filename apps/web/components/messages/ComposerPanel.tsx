"use client";

import type { ReactNode } from "react";

type ComposerPanelProps = {
  children: ReactNode;
};

export function ComposerPanel({ children }: ComposerPanelProps) {
  return <>{children}</>;
}
