import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { CalendarFormat } from "@/lib/academicPeriod";
import { planSchoolLessonGeneration, planUniversityLessonGeneration } from "@/lib/lessonGenerationPlan";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { materializeLessonGenerationQueue } from "@/lib/server/lessonGenerationQueue";
import {
  populateTier1PlannerEvents,
  replaceStudentEnrolledModules,
  saveStudentUniversityProfile,
  syncTier2PlannerEventsForStudent,
} from "@/lib/server/universityPlanner";
import { getUserAppPreferences, patchUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";
import { withPlannerDbClient } from "@/lib/server/plannerDb";

const examSchema = z.object({
  subject: z.string().trim().min(1).max(120),
  date: z.string().trim().min(4).max(32),
});

const modulePlanEntrySchema = z.object({
  code: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(240),
  semester: z.union([z.number().int().min(1).max(2), z.literal("both")]).nullable().optional(),
  yearOfStudy: z.number().int().min(1).max(8),
  credits: z.number().int().min(0).max(256).nullable().optional(),
  isCore: z.boolean().nullable().optional(),
  durationType: z.enum(["semester", "year"]).nullable().optional(),
  durationLabel: z.string().trim().min(1).max(60).nullable().optional(),
  assumed: z.boolean().default(false),
  source: z.string().trim().min(1).max(40).default("manual"),
});

const onboardingBodySchema = z.object({
  studyType: z.enum(["school", "university"]),
  grade: z.number().int().min(0).max(12).nullable().optional(),
  phase: z.string().trim().min(2).max(40).nullable().optional(),
  institutionId: z.string().trim().min(1).max(160).nullable().optional(),
  plannerUniversityId: z.string().uuid().nullable().optional(),
  institution: z.string().trim().min(2).max(160).nullable().optional(),
  campus: z.string().trim().min(2).max(120).nullable().optional(),
  campusId: z.string().uuid().nullable().optional(),
  academicPeriodType: z.enum(["term", "semester", "trimester", "quarter"]).nullable().optional(),
  yearOfStudy: z.number().int().min(1).max(8).nullable().optional(),
  faculty: z.string().trim().min(1).max(120).nullable().optional(),
  course: z.string().trim().min(1).max(240).nullable().optional(),
  qualification: z.string().trim().min(1).max(240).nullable().optional(),
  courseId: z.string().trim().min(1).max(160).nullable().optional(),
  courseCode: z.string().trim().min(1).max(120).nullable().optional(),
  studentNumber: z.string().trim().min(1).max(64).nullable().optional(),
  subjects: z.array(z.string().trim().min(1).max(120)).max(32).default([]),
  selectedSubjectLabels: z.array(z.string().trim().min(1).max(240)).max(32).optional(),
  subjectKeys: z.array(z.string().trim().min(1).max(160)).max(32).optional(),
  modulePlan: z.array(modulePlanEntrySchema).max(32).default([]),
  examDates: z.array(examSchema).max(3).default([]),
  personalisation: z.object({
    studyStyle: z.enum(["visual", "text", "mixed", ""]).optional(),
    bestStudyTime: z.enum(["morning", "afternoon", "evening", "night", ""]).optional(),
  }).optional(),
});

type PendingTimetableSync = {
  universityId: string;
  campusId: string | null;
  year: number;
  modules: Array<{
    moduleCode: string;
    moduleName: string | null;
    semester: 1 | 2;
  }>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function isUuidLike(value: string | null | undefined) {
  return Boolean(value && UUID_PATTERN.test(value));
}

async function tableExists(tableName: string) {
  return withPlannerDbClient(async (client) => {
    const result = await client.query<{ regclass: string | null }>(`SELECT to_regclass($1) AS regclass`, [tableName]);
    return Boolean(result.rows[0]?.regclass);
  });
}

async function columnExists(tableName: string, columnName: string) {
  return withPlannerDbClient(async (client) => {
    const result = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS exists
      `,
      [tableName, columnName]
    );
    return Boolean(result.rows[0]?.exists);
  });
}

async function resolvePlannerUniversityId(candidateId: string | null | undefined) {
  if (!isUuidLike(candidateId)) return null;

  return withPlannerDbClient(async (client) => {
    const result = await client.query<{ id: string }>(
      `
        SELECT id::text AS id
        FROM universities
        WHERE id = $1
        LIMIT 1
      `,
      [candidateId]
    );

    return result.rows[0]?.id ?? null;
  });
}

async function resetDerivedPlannerEvents(studentId: string) {
  await withPlannerDbClient(async (client) => {
    await client.query(
      `
        DELETE FROM student_planner_events
        WHERE student_id = $1
          AND is_manual = FALSE
          AND tier IN ('tier1', 'tier2')
      `,
      [studentId]
    );
  });
}

function inferShortName(name: string) {
  const tokens = name
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 4);

  if (tokens.length === 0) return null;

  const acronym = tokens.map((token) => token[0]?.toUpperCase() ?? "").join("");
  return acronym.length >= 2 ? acronym : null;
}

function resolveCalendarFormat(
  studyType: "school" | "university",
  academicPeriodType: CalendarFormat | null | undefined
): CalendarFormat {
  if (studyType === "school") {
    return "term";
  }
  return academicPeriodType ?? "semester";
}

function toOptionalPreferenceValue<T extends string>(value: T | "" | null | undefined) {
  return value ? value : undefined;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const userId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = onboardingBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  const selectedSubjectLabels = dedupeStrings(payload.selectedSubjectLabels ?? []).slice(0, 32);
  const subjectKeys = dedupeStrings(payload.subjectKeys ?? []).slice(0, 32);
  const normalizedQualification = payload.qualification?.trim() || payload.course?.trim() || null;
  const modulePlan = payload.modulePlan
    .map((entry) => ({
      code: entry.code.trim(),
      name: entry.name.trim(),
      semester: entry.semester ?? null,
      yearOfStudy: entry.yearOfStudy,
      credits: entry.credits ?? null,
      isCore: typeof entry.isCore === "boolean" ? entry.isCore : null,
      durationType: entry.durationType ?? null,
      durationLabel: entry.durationLabel?.trim() ?? null,
      assumed: entry.assumed,
      source: entry.source.trim(),
    }))
    .filter((entry) => entry.code && entry.name)
    .slice(0, 32);
  const fallbackUniversitySubjectCodes =
    payload.studyType === "university" ? modulePlan.map((entry) => entry.code) : [];
  const normalizedSubjects = dedupeStrings(
    payload.subjects.length > 0 ? payload.subjects : fallbackUniversitySubjectCodes
  )
    .filter(Boolean)
    .slice(0, 32);
  const normalizedSelectedSubjectLabels =
    payload.studyType === "university" && selectedSubjectLabels.length === 0
      ? modulePlan.map((entry) => `${entry.code} · ${entry.name}`)
      : selectedSubjectLabels;
  const examDates = payload.examDates
    .map((entry) => ({
      subject: entry.subject.trim(),
      date: entry.date.trim(),
    }))
    .filter((entry) => entry.subject && entry.date)
    .slice(0, 3);
  const completedAt = new Date().toISOString();
  const calendarFormat = resolveCalendarFormat(payload.studyType, payload.academicPeriodType);
  const lessonGenerationPlan =
    payload.studyType === "school"
      ? planSchoolLessonGeneration({
          grade: payload.grade ?? 0,
          phase: payload.phase ?? null,
          subjects: (payload.selectedSubjectLabels ?? normalizedSubjects).map((name, index) => ({
            key: payload.subjectKeys?.[index] ?? null,
            name,
          })),
        })
      : planUniversityLessonGeneration({
          institution: payload.institution?.trim() || "University",
          faculty: payload.faculty?.trim() || "General",
          course: normalizedQualification || "Unspecified course",
          yearOfStudy: payload.yearOfStudy ?? 1,
          modules: modulePlan,
        });
  const existingPreferences = await getUserAppPreferences(userId).catch(() => ({}));
  const existingAcademicState = readAcademicState(existingPreferences);
  const lessonGenerationQueue = materializeLessonGenerationQueue(
    lessonGenerationPlan,
    existingAcademicState.lessonGenerationQueue
  );

  if (payload.studyType === "school" && payload.grade == null) {
    return NextResponse.json({ error: "School onboarding requires a grade." }, { status: 400 });
  }

  if (payload.studyType === "university" && !(payload.institutionId || payload.institution)) {
    return NextResponse.json({ error: "University onboarding requires an institution." }, { status: 400 });
  }

  const appPreferencesPatch = {
    academics: {
      studyType: payload.studyType,
      grade: payload.studyType === "school" ? payload.grade ?? null : null,
      phase: payload.studyType === "school" ? payload.phase ?? null : null,
      institutionId: payload.studyType === "university" ? payload.institutionId ?? null : null,
      institution: payload.studyType === "university" ? payload.institution ?? null : null,
      campus: payload.studyType === "university" ? payload.campus ?? null : null,
      yearOfStudy: payload.studyType === "university" ? payload.yearOfStudy ?? null : null,
      faculty: payload.studyType === "university" ? payload.faculty ?? null : null,
      course: payload.studyType === "university" ? normalizedQualification : null,
      courseId: payload.studyType === "university" ? payload.courseId ?? null : null,
      courseCode: payload.studyType === "university" ? payload.courseCode ?? null : null,
      calendarFormat,
      selectedSubjects: normalizedSubjects,
      selectedSubjectLabels: normalizedSelectedSubjectLabels,
      modulePlan,
      lessonGenerationPlan,
      lessonGenerationQueue,
      examDates,
      schoolGrade: payload.studyType === "school" ? payload.grade ?? null : null,
      schoolPhase: payload.studyType === "school" ? payload.phase ?? null : null,
      schoolSubjectKeys: payload.studyType === "school" ? subjectKeys : [],
    },
    onboarding: {
      complete: true,
      completedAt,
    },
    profileSettings: {
      preferenceOnboardingStatus: "completed",
      completedAt,
    },
    personalisation: {
      studyStyle: payload.personalisation?.studyStyle || null,
      bestStudyTime: payload.personalisation?.bestStudyTime || null,
      weakestSubjects: [],
    },
  };
  const apiFallbackAppPreferencesPatch = {
    ...appPreferencesPatch,
    personalisation: {
      ...appPreferencesPatch.personalisation,
      studyStyle: toOptionalPreferenceValue(payload.personalisation?.studyStyle),
      bestStudyTime: toOptionalPreferenceValue(payload.personalisation?.bestStudyTime),
    },
  };

  try {
    try {
      await patchUserAppPreferences(userId, appPreferencesPatch);
    } catch (dbErr) {
      console.warn("[onboarding/complete] Direct DB patch failed, trying API fallback...", dbErr instanceof Error ? dbErr.message : dbErr);
      const profileFallbackUrl = new URL("/api/profile/me", request.url);
      const apiResponse = await fetch(profileFallbackUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ appPreferences: apiFallbackAppPreferencesPatch }),
      });
      if (!apiResponse.ok) {
        const apiBody = (await apiResponse.json().catch(() => ({}))) as { error?: string };
        console.error(`[onboarding/complete] API fallback failed (${profileFallbackUrl.toString()}):`, apiBody.error);
        throw new Error(apiBody.error ?? `Unable to save onboarding preferences via API fallback (${apiResponse.status}).`);
      }
    }

    let pendingTimetableSync: PendingTimetableSync | null = null;

    try {
      const hasProfilesTable = await tableExists("public.profiles");
      if (hasProfilesTable) {
        const hasGradeColumn = await columnExists("profiles", "grade");

        await withPlannerDbClient(async (client) => {
          if (hasGradeColumn) {
            await client.query(
              `
                UPDATE profiles
                SET selected_subjects = $2::jsonb,
                    exam_dates = $3::jsonb,
                    onboarding_complete = TRUE,
                    grade = $4
                WHERE user_id = $1
              `,
              [
                userId,
                JSON.stringify(normalizedSubjects),
                JSON.stringify(examDates),
                payload.studyType === "school" ? payload.grade ?? null : null,
              ]
            );
          } else {
            await client.query(
              `
                UPDATE profiles
                SET selected_subjects = $2::jsonb,
                    exam_dates = $3::jsonb,
                    onboarding_complete = TRUE
                WHERE user_id = $1
              `,
              [userId, JSON.stringify(normalizedSubjects), JSON.stringify(examDates)]
            );
          }
        });
      }

      if (payload.studyType === "university") {
        const hasUniversitiesTable = await tableExists("public.universities");
        const hasUniversityProfilesTable = await tableExists("public.student_university_profiles");
        const hasEnrolledModulesTable = await tableExists("public.enrolled_modules");
        const hasPlannerEventsTable = await tableExists("public.student_planner_events");
        const resolvedUniversityId =
          hasUniversitiesTable && hasUniversityProfilesTable
            ? await resolvePlannerUniversityId(payload.plannerUniversityId ?? payload.institutionId)
            : null;

        if (resolvedUniversityId) {
          const plannerYear = new Date().getFullYear();

          await saveStudentUniversityProfile({
            studentId: userId,
            universityId: resolvedUniversityId,
            campusId: payload.campusId ?? null,
            faculty: payload.faculty ?? null,
            yearOfStudy: payload.yearOfStudy ?? null,
            qualification: normalizedQualification,
            studentNumber: payload.studentNumber?.trim() ?? null,
            onboardingCompleted: true,
            tier2Activated: false,
            tier3Activated: false,
          });

          const savedModules = hasEnrolledModulesTable
            ? await replaceStudentEnrolledModules({
                studentId: userId,
                universityId: resolvedUniversityId,
                campusId: payload.campusId ?? null,
                year: plannerYear,
                modules: modulePlan.map((entry) => ({
                  moduleCode: entry.code,
                  moduleName: entry.name,
                  semester:
                    entry.semester === 1 || entry.semester === 2 || entry.semester === "both"
                      ? entry.semester
                      : null,
                  credits: entry.credits,
                })),
              })
            : [];

          if (hasPlannerEventsTable) {
            await resetDerivedPlannerEvents(userId);
            await populateTier1PlannerEvents(userId, resolvedUniversityId);
            if (savedModules.length > 0) {
              await syncTier2PlannerEventsForStudent({
                studentId: userId,
                universityId: resolvedUniversityId,
                campusId: payload.campusId ?? null,
                year: plannerYear,
              });
            }
          }

          pendingTimetableSync = {
            universityId: resolvedUniversityId,
            campusId: payload.campusId ?? null,
            year: plannerYear,
            modules: savedModules.flatMap((entry) =>
              entry.semester === 1 || entry.semester === 2
                ? [
                    {
                      moduleCode: entry.moduleCode,
                      moduleName: entry.moduleName,
                      semester: entry.semester,
                    },
                  ]
                : []
            ),
          };
        }

        const hasInstitutionsTable = await tableExists("public.institutions");
        const hasInstitutionColumn = await columnExists("users", "institution_id");

        if (hasInstitutionsTable && hasInstitutionColumn) {
          await withPlannerDbClient(async (client) => {
            let institutionId = "";
            if (isUuidLike(payload.institutionId)) {
              const existingById = await client.query<{ id: string }>(
                `
                  SELECT id::text AS id
                  FROM institutions
                  WHERE id = $1
                  LIMIT 1
                `,
                [payload.institutionId]
              );
              institutionId = existingById.rows[0]?.id ?? "";
            }

            if (!institutionId && payload.institution) {
              const existingByName = await client.query<{ id: string }>(
                `
                  SELECT id::text AS id
                  FROM institutions
                  WHERE LOWER(name) = LOWER($1)
                  LIMIT 1
                `,
                [payload.institution]
              );
              institutionId = existingByName.rows[0]?.id ?? "";
            }

            if (!institutionId && payload.institution) {
              const created = await client.query<{ id: string }>(
                `
                  INSERT INTO institutions (name, short_name, type, country, is_active)
                  VALUES ($1, $2, 'university', 'ZA', TRUE)
                  RETURNING id::text AS id
                `,
                [payload.institution, inferShortName(payload.institution)]
              );
              institutionId = created.rows[0]?.id ?? "";
            }

            if (institutionId) {
              await client.query(`UPDATE users SET institution_id = $2 WHERE id = $1`, [userId, institutionId]);
            }
          });
        }
      }
    } catch {
      // App preferences were already saved through the backend profile path.
      // If the web runtime has no direct DB access, keep onboarding successful.
    }
    const response = NextResponse.json({ success: true, pendingTimetableSync, lessonGenerationPlan, lessonGenerationQueue });
    response.cookies.set("school_onboarding_complete", userId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (err) {
    console.error("[onboarding/complete] Fatal error:", err);
    return NextResponse.json({ error: "Unable to complete onboarding." }, { status: 500 });
  }
}
