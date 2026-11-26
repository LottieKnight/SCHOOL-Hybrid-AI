import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getBackendSessionFromRequest } from "@/lib/server/backendSession";
import { queryPlannerDb } from "@/lib/server/plannerDb";
import { getUserAppPreferences, patchUserAppPreferences } from "@/lib/server/userProfileState";
import {
  getStudentUniversityProfile,
  listPlannerCampuses,
  listStudentEnrolledModules,
  replaceStudentEnrolledModules,
  saveStudentUniversityProfile,
  syncTier2PlannerEventsForStudent,
} from "@/lib/server/universityPlanner";

const moduleSchema = z.object({
  moduleCode: z.string(),
  moduleName: z.string().nullable().optional(),
  semester: z.union([z.literal(1), z.literal(2), z.literal("both"), z.null()]).optional(),
});

const patchSchema = z.object({
  campus_id: z.string().uuid().nullable().optional(),
  faculty: z.string().max(120).nullable().optional(),
  year_of_study: z.number().int().min(1).max(8).nullable().optional(),
  qualification: z.string().max(240).nullable().optional(),
  student_number: z.union([z.string(), z.null()]).optional(),
  modules: z.array(moduleSchema).max(24).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeModuleCode(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function mapModulesToAcademicPlan(
  yearOfStudy: number | null | undefined,
  modules: Array<{
    moduleCode: string;
    moduleName?: string | null;
    semester?: number | "both" | null;
    credits?: number | null;
  }>
) {
  const resolvedYear = Math.max(1, Math.round(yearOfStudy ?? 1));
  return modules
    .map((module) => {
      const code = normalizeModuleCode(module.moduleCode);
      if (!code) return null;
      const semester =
        module.semester === 1 || module.semester === 2 ? module.semester : null;
      return {
        code,
        name: module.moduleName?.trim() || code,
        semester,
        yearOfStudy: resolvedYear,
        credits: typeof module.credits === "number" ? module.credits : null,
        isCore: null,
        durationType: semester ? "semester" as const : "year" as const,
        durationLabel: semester ? `Semester ${semester}` : "Year module",
        assumed: false,
        source: "planner_sync",
      };
    })
    .filter((module): module is NonNullable<typeof module> => Boolean(module));
}

export async function GET(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const studentId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const currentYear = new Date().getUTCFullYear();
  const profile = await getStudentUniversityProfile(studentId).catch(() => null);
  if (!profile) {
    return NextResponse.json({ profile: null, campuses: [], modules: [] });
  }

  const [universityResult, campuses, modules] = await Promise.all([
    queryPlannerDb<{ id: string; name: string; short_code: string }>(
      `
        SELECT id::text AS id, name, short_code
        FROM universities
        WHERE id = $1
        LIMIT 1
      `,
      [profile.universityId]
    ),
    listPlannerCampuses(profile.universityId).catch(() => []),
    listStudentEnrolledModules(studentId).catch(() => []),
  ]);

  const university = universityResult.rows[0]
    ? {
        id: universityResult.rows[0].id,
        name: universityResult.rows[0].name,
        shortCode: universityResult.rows[0].short_code,
      }
    : null;

  return NextResponse.json({
    profile: {
      university,
      campusId: profile.campusId,
      faculty: profile.faculty,
      yearOfStudy: profile.yearOfStudy,
      qualification: profile.qualification,
      studentNumber: profile.studentNumber,
    },
    campuses,
    modules: modules.filter((module) => module.year === currentYear),
  });
}

export async function PATCH(request: NextRequest) {
  const session = await getBackendSessionFromRequest(request);
  const studentId = typeof session?.user?.id === "string" ? session.user.id : "";

  if (!studentId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid university profile payload." }, { status: 400 });
  }

  const currentYear = new Date().getUTCFullYear();
  const profile = await getStudentUniversityProfile(studentId).catch(() => null);
  if (!profile) {
    return NextResponse.json({ error: "University profile not found." }, { status: 400 });
  }

  const payload = parsed.data;
  const nextCampusId = payload.campus_id === undefined ? profile.campusId : payload.campus_id;

  if (nextCampusId) {
    const campusResult = await queryPlannerDb<{ id: string }>(
      `
        SELECT id::text AS id
        FROM university_campuses
        WHERE id = $1
          AND university_id = $2
        LIMIT 1
      `,
      [nextCampusId, profile.universityId]
    );

    if (campusResult.rowCount === 0) {
      return NextResponse.json({ error: "Campus does not belong to the current university." }, { status: 400 });
    }
  }

  try {
    const nextProfile = await saveStudentUniversityProfile({
      studentId,
      universityId: profile.universityId,
      campusId: nextCampusId,
      faculty: payload.faculty === undefined ? profile.faculty : payload.faculty,
      yearOfStudy: payload.year_of_study === undefined ? profile.yearOfStudy : payload.year_of_study,
      qualification: payload.qualification === undefined ? profile.qualification : payload.qualification,
      studentNumber: payload.student_number === undefined ? profile.studentNumber : payload.student_number,
      onboardingCompleted: profile.onboardingCompleted,
      tier2Activated: profile.tier2Activated,
      tier3Activated: profile.tier3Activated,
    });

    let syncedModules = await listStudentEnrolledModules(studentId).catch(() => []);
    if (payload.modules) {
      const modules = payload.modules
        .map((module) => ({
          moduleCode: normalizeModuleCode(module.moduleCode),
          moduleName: module.moduleName?.trim() || null,
          semester: module.semester ?? null,
        }))
        .filter((module) => module.moduleCode);

      syncedModules = await replaceStudentEnrolledModules({
        studentId,
        universityId: profile.universityId,
        campusId: nextCampusId,
        year: currentYear,
        modules,
      });

      await syncTier2PlannerEventsForStudent({
        studentId,
        universityId: profile.universityId,
        campusId: nextCampusId,
        year: currentYear,
      });
    }

    const [universityResult, campusResult, preferences] = await Promise.all([
      queryPlannerDb<{ name: string; short_code: string }>(
        `
          SELECT name, short_code
          FROM universities
          WHERE id = $1
          LIMIT 1
        `,
        [profile.universityId]
      ),
      nextCampusId
        ? queryPlannerDb<{ campus_name: string }>(
            `
              SELECT campus_name
              FROM university_campuses
              WHERE id = $1
              LIMIT 1
            `,
            [nextCampusId]
          )
        : Promise.resolve({ rows: [] as Array<{ campus_name: string }> }),
      getUserAppPreferences(studentId).catch(() => ({})),
    ]);

    const universityName = universityResult.rows[0]?.name ?? null;
    const currentAcademics = asRecord(asRecord(preferences).academics);
    const moduleSource = syncedModules
      .filter((module) => module.year === currentYear)
      .map((module) => ({
        moduleCode: module.moduleCode,
        moduleName: module.moduleName,
        semester: module.semester,
        credits: module.credits,
      }));

    await patchUserAppPreferences(studentId, {
      academics: {
        ...currentAcademics,
        studyType: "university",
        institutionId: nextProfile.universityId,
        institution: universityName,
        campus: campusResult.rows[0]?.campus_name ?? null,
        yearOfStudy: nextProfile.yearOfStudy ?? null,
        faculty: nextProfile.faculty ?? null,
        course: nextProfile.qualification ?? null,
        modulePlan: mapModulesToAcademicPlan(nextProfile.yearOfStudy, moduleSource),
        selectedSubjects: moduleSource.map((module) => module.moduleCode),
        selectedSubjectLabels: moduleSource.map((module) =>
          module.moduleName?.trim() ? `${module.moduleCode} · ${module.moduleName.trim()}` : module.moduleCode
        ),
        calendarFormat: "semester",
      },
      onboarding: {
        complete: true,
      },
      profileSettings: {
        preferenceOnboardingStatus: "completed",
      },
    });

    return NextResponse.json({ updated: true });
  } catch {
    return NextResponse.json({ error: "Unable to update university profile." }, { status: 400 });
  }
}
