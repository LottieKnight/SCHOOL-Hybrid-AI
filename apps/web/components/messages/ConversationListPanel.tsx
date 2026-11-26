"use client";

import type { ReactNode } from "react";

type ConversationListPanelProps = {
  children: ReactNode;
};

export function ConversationListPanel({ children }: ConversationListPanelProps) {
  return <>{children}</>;
}
