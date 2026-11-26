"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarPastPapersMenu() {
  const pathname = usePathname() || "";
  const isActive = pathname.startsWith("/past-papers");

  return (
    <div className="sidebar-grade">
      <div className="sidebar-item" role="button" tabIndex={0}>
        <span className="side-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M6 4h8.5c1.7 0 3 1.3 3 3v12.5c0 .4-.3.7-.7.7H7.5c-1.4 0-2.5-1.1-2.5-2.5V5.5c0-.8.7-1.5 1.5-1.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8.2 7.8h6.4M8.2 10.6h6.4M8.2 13.4h4.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Past Papers
      </div>
      <div className="grade-menu">
        <div className="phase-list">
          <div className="phase-item">
            <Link
              className={`phase-link${isActive ? " active" : ""}`}
              href="/past-papers"
              prefetch={false}
            >
              Browse Past Papers
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
