"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import { getAdminFeatureItems } from "@/lib/featureCatalog";

type AdminCheck = { isAdmin: boolean };

export function AdminSidebarSection() {
  const { session, loading: sessionLoading } = useSession();
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const sessionKey = session
    ? `${session.user?.email ?? ""}|${session.user?.isEmailVerified ? "1" : "0"}|${
        session.user?.isPhoneVerified ? "1" : "0"
      }`
    : "";

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/admin/check", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          if (active) {
            setIsAdmin(false);
            setChecked(true);
          }
          return;
        }
        const data = (await response.json()) as AdminCheck;
        if (active) {
          setIsAdmin(Boolean(data.isAdmin));
          setChecked(true);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
          setChecked(true);
        }
      }
    };
    if (!sessionLoading) {
      if (!session) {
        setIsAdmin(false);
        setChecked(true);
        return;
      }
      const isVerified = Boolean(session.user?.isEmailVerified && session.user?.isPhoneVerified);
      if (!isVerified) {
        setIsAdmin(false);
        setChecked(true);
        return;
      }
      check();
    }
    return () => {
      active = false;
    };
  }, [session, sessionLoading, sessionKey]);

  if (!checked || !isAdmin) return null;

  const adminFeatures = getAdminFeatureItems();

  return (
    <details className="sidebar-store" open>
      <summary className="sidebar-item">
        <span className="side-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M12 3.8 20 7.2v4.5c0 4.1-2.8 7.8-8 8.5-5.2-.7-8-4.4-8-8.5V7.2l8-3.4Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            <path
              d="M9.2 12.2l2 2.2 3.9-4.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        Admin
      </summary>
      <div className="store-menu">
        <div className="sidebar-group-copy">
          <strong>Admin</strong>
          <span>Generation, diagnostics, moderation, analytics, and operations controls.</span>
        </div>
        {adminFeatures.map((feature) => (
          <Link key={feature.href} className="button store-link" href={feature.href} prefetch={false}>
            <span className="store-link-copy">
              <strong>{feature.label}</strong>
              <span>
                {feature.badge ? `${feature.badge}: ${feature.description}` : feature.description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
