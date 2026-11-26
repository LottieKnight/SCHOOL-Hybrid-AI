"use client";

import type { ReactNode } from "react";

type ThreadViewPanelProps = {
  children: ReactNode;
};

export function ThreadViewPanel({ children }: ThreadViewPanelProps) {
  return <>{children}</>;
}
