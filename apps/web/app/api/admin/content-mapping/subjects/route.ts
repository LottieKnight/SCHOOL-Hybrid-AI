import { NextRequest, NextResponse } from "next/server";
import { loadCourseOutline } from "@saedu/shared";
import { isAdminSession } from "@/lib/admin";

async function isAdmin(request: NextRequest) {
  const apiBase =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:4000";
  const sessionUrl = `${apiBase}/auth/session`;
  try {
    const response = await fetch(sessionUrl, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      cache: "no-store",
    });
    if (!response.ok) return false;
    const data = await response.json();
    return isAdminSession(data);
  } catch {
    return false;
  }
}

function listSubjects(phaseKey: string, gradeKey: string) {
  const outline = loadCourseOutline();
  const grade = outline.phases[phaseKey]?.grades?.[gradeKey];
  if (!grade) return [];
  const subjectSet = new Set<string>();
  Object.values(grade.groups || {}).forEach((group: any) => {
    Object.keys(group.subjects || {}).forEach((subjectKey) => {
      subjectSet.add(subjectKey);
    });
  });
  return Array.from(subjectSet).sort();
}

export async function GET(request: NextRequest) {
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const phase = searchParams.get("phase");
  const grade = searchParams.get("grade");
  if (!phase || !grade) {
    return NextResponse.json({ error: "Missing phase or grade" }, { status: 400 });
  }
  const gradeKey = grade === "0" ? "R" : grade;
  const subjects = listSubjects(phase, gradeKey);
  return NextResponse.json({ subjects });
}

