import { NextRequest, NextResponse } from "next/server";
import { readLessonJson } from "@saedu/shared";

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const grade = searchParams.get("grade");
  const subject = searchParams.get("subject");
  const term = searchParams.get("term");
  const week = searchParams.get("week");

  if (!grade || !subject || !term || !week) {
    return NextResponse.json({ error: "Missing query params" }, { status: 400 });
  }

  const weekNumber = Number(week);
  if (!Number.isFinite(weekNumber) || weekNumber < 1) {
    return NextResponse.json({ error: "Invalid week" }, { status: 400 });
  }

  const lesson = readLessonJson({
    gradeKey: grade,
    subjectKey: subject,
    termKey: term,
    weekNumber,
  });

  if (!lesson) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const response = NextResponse.json(lesson);
  response.headers.set("Cache-Control", "public, max-age=3600");
  return response;
}
