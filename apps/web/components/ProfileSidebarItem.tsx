"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "@/components/SessionProvider";
import { isAdminSession } from "@/lib/admin";

const ProfileSidebarPanel = dynamic(
  () => import("./ProfileSidebarPanel").then((mod) => mod.ProfileSidebarPanel),
  { ssr: false }
);

export function ProfileSidebarItem() {
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const isAdmin = isAdminSession(session);
  const isVerified = Boolean(session?.user?.isEmailVerified && session?.user?.isPhoneVerified);

  const handleOpenProfile = () => {
    const toggle = document.getElementById("sidebar-toggle") as HTMLInputElement | null;
    if (toggle) {
      toggle.checked = false;
    }
    setOpen(true);
  };

  return (
    <div className="profile-item">
      <button className="sidebar-item" type="button" onClick={handleOpenProfile}>
        <span className="side-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M12 4.6c2.1 0 3.8 1.7 3.8 3.8S14.1 12.2 12 12.2 8.2 10.5 8.2 8.4 9.9 4.6 12 4.6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M5.8 19.4c1.6-2.8 3.9-4.2 6.2-4.2s4.6 1.4 6.2 4.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Profile
        {isAdmin && isVerified ? <span className="badge">Admin</span> : null}
      </button>
      {open ? <ProfileSidebarPanel onClose={() => setOpen(false)} /> : null}
    </div>
  );
}
