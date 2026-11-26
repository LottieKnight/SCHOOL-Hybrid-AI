"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LegacyLearnNotice() {
  const pathname = usePathname();
  if (!pathname || !pathname.startsWith("/phase")) return null;

  return (
    <div className="list-item" style={{ marginBottom: "1rem" }}>
      <strong>Legacy route</strong>
      <p className="subtitle">
        You are viewing the legacy learning path. Try the new Lesson v2 flow for the canonical curriculum tree.
      </p>
      <Link className="button" href="/learn">
        New Learn Path (v2)
      </Link>
    </div>
  );
}
