import type { Metadata } from "next";
import { headers } from "next/headers";
import "./protoShell.css";
import { ProtoShell } from "@/components/prototype/ProtoShell";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";

export const metadata: Metadata = {
  title: "UI Prototype | SCHOOL",
};

export default async function PrototypeLayout({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "").catch(() => null);
  const user = (session?.user ?? null) as Record<string, unknown> | null;
  const rawFirstName = typeof user?.firstName === "string" ? user.firstName : null;
  const rawEmail = typeof user?.email === "string" ? user.email : null;
  const firstName = rawFirstName && rawFirstName.trim()
    ? rawFirstName.trim()
    : rawEmail
      ? (rawEmail.split("@")[0] || "Scholar")
      : "Scholar";
  const studyPath =
    user && user.studyType === "university"
      ? (typeof user?.course === "string" && user.course ? user.course : "University student")
      : (typeof user?.grade === "string" ? user.grade : "Learner");

  return <ProtoShell firstName={firstName} studyPath={studyPath}>{children}</ProtoShell>;
}