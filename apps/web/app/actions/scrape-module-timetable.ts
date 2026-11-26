"use server";

import "server-only";

import { headers } from "next/headers";
import { z } from "zod";
import { getBackendSessionFromCookieHeader } from "@/lib/server/backendSession";
import { queryPlannerDb, withPlannerDbClient } from "@/lib/server/plannerDb";
import { syncTier2PlannerEventsForStudent } from "@/lib/server/universityPlanner";

const scrapeModuleTimetableSchema = z.object({
  universityId: z.string().uuid(),
  campusId: z.string().uuid().nullable().optional(),
  moduleCode: z.string().trim().min(3).max(32),
  semester: z.number().int().min(1).max(2),
  year: z.number().int().min(2025).max(2100),
});

type CelcatResourceResult = {
  id: string;
  text: string;
  dept?: string | null;
};

type CelcatSearchResponse = {
  total?: number;
  results?: CelcatResourceResult[];
};

type CelcatCalendarEvent = {
  id: string;
  start: string;
  end: string;
  description?: string | null;
  modules?: string[] | null;
};

type CelcatCalendarResponse = {
  value?: CelcatCalendarEvent[];
  Count?: number;
};

type ModuleTimetableWriteRow = {
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  startTime: string;
  endTime: string;
  venue: string | null;
  groupCode: string;
  moduleName: string | null;
  sourceUrl: string;
};

type ActionResult =
  | {
      ok: true;
      rows: Array<{
        moduleCode: string;
        moduleName: string | null;
        semester: number;
        year: number;
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        venue: string | null;
        groupCode: string | null;
      }>;
      insertedCount: number;
    }
  | {
      ok: false;
      error: string;
      status?: number;
    };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const NWU_CELCAT_BASE_BY_CAMPUS: Record<string, string> = {
  VC: "https://celcat-tst.nwu.ac.za:8445",
  PC: "https://celcat-tst.nwu.ac.za:8444",
  MC: "https://celcat-tst.nwu.ac.za:8446",
};

function cleanModuleCode(value: string) {
  return value.trim().toUpperCase();
}

function decodeDescription(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseModuleName(resourceLabel: string, moduleCode: string) {
  const match = resourceLabel.match(/\(([^)]+)\)/);
  if (match?.[1]) {
    return match[1].trim();
  }

  const cleaned = resourceLabel.replace(new RegExp(`^${moduleCode}\\S*\\s*`, "i"), "").trim();
  return cleaned || null;
}

function parseVenue(description: string | null | undefined, moduleCode: string) {
  const lines = decodeDescription(description).filter((line) => !line.toUpperCase().startsWith(moduleCode));
  return lines.length > 0 ? lines[lines.length - 1] : null;
}

function toTimeFragment(dateTime: string) {
  return dateTime.slice(11, 19);
}

function toDayOfWeek(dateTime: string) {
  const day = DAY_NAMES[new Date(`${dateTime.slice(0, 10)}T00:00:00Z`).getUTCDay()];
  return day === "Sunday" ? null : day;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; status?: number }> {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        "user-agent": "SCHOOL Planner/1.0",
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `NWU timetable endpoint returned ${response.status}.`,
      };
    }

    return {
      ok: true,
      data: (await response.json()) as T,
    };
  } catch {
    return {
      ok: false,
      error: "Unable to reach the NWU timetable endpoint.",
    };
  }
}

async function getCurrentUserId() {
  const headerStore = await headers();
  const session = await getBackendSessionFromCookieHeader(headerStore.get("cookie") || "");
  return typeof session?.user?.id === "string" ? session.user.id : "";
}

async function getUniversityMetadata(universityId: string) {
  const result = await queryPlannerDb<{
    short_code: string;
  }>(
    `
      SELECT short_code
      FROM universities
      WHERE id = $1
      LIMIT 1
    `,
    [universityId]
  );

  return result.rows[0] ?? null;
}

async function getCampusMetadata(campusId: string | null | undefined) {
  if (!campusId) return null;

  const result = await queryPlannerDb<{
    campus_code: string;
    campus_name: string;
  }>(
    `
      SELECT campus_code, campus_name
      FROM university_campuses
      WHERE id = $1
      LIMIT 1
    `,
    [campusId]
  );

  return result.rows[0] ?? null;
}

async function getSemesterWindow(input: { universityId: string; campusId?: string | null; semester: number; year: number }) {
  const result = await queryPlannerDb<{
    start_date: string;
    end_date: string;
  }>(
    `
      SELECT
        start_rows.start_date::text AS start_date,
        end_rows.start_date::text AS end_date
      FROM academic_calendars start_rows
      JOIN academic_calendars end_rows
        ON end_rows.university_id IS NOT DISTINCT FROM start_rows.university_id
       AND end_rows.campus_id IS NOT DISTINCT FROM start_rows.campus_id
       AND end_rows.year = start_rows.year
       AND end_rows.semester = start_rows.semester
       AND end_rows.event_type = 'semester_end'
      WHERE start_rows.university_id = $1
        AND start_rows.year = $2
        AND start_rows.semester = $3
        AND start_rows.event_type = 'semester_start'
        AND ($4::uuid IS NULL OR start_rows.campus_id IS NULL OR start_rows.campus_id = $4::uuid)
      ORDER BY start_rows.campus_id NULLS LAST
      LIMIT 1
    `,
    [input.universityId, input.year, input.semester, input.campusId ?? null]
  );

  if (result.rowCount === 0) {
    return {
      startDate: `${input.year}-01-01`,
      endDate: `${input.year}-12-31`,
    };
  }

  return {
    startDate: result.rows[0].start_date,
    endDate: result.rows[0].end_date,
  };
}

function buildWriteRows(input: {
  moduleCode: string;
  semester: number;
  resources: CelcatResourceResult[];
  eventsByResource: Map<string, CelcatCalendarEvent[]>;
}) {
  const rows = new Map<string, ModuleTimetableWriteRow>();

  for (const resource of input.resources) {
    const resourceEvents = input.eventsByResource.get(resource.id) ?? [];
    const moduleName = parseModuleName(resource.text, input.moduleCode);

    for (const event of resourceEvents) {
      const dayOfWeek = toDayOfWeek(event.start);
      if (!dayOfWeek) continue;

      const venue = parseVenue(event.description, input.moduleCode);
      const row: ModuleTimetableWriteRow = {
        dayOfWeek,
        startTime: toTimeFragment(event.start),
        endTime: toTimeFragment(event.end),
        venue,
        groupCode: resource.id,
        moduleName,
        sourceUrl: `${NWU_CELCAT_BASE_BY_CAMPUS.VC}/Home/GetCalendarData`,
      };

      const key = [row.dayOfWeek, row.startTime, row.endTime, row.venue ?? "", row.groupCode].join("|");
      rows.set(key, row);
    }
  }

  return Array.from(rows.values()).sort((left, right) => {
    if (left.dayOfWeek !== right.dayOfWeek) return left.dayOfWeek.localeCompare(right.dayOfWeek);
    if (left.startTime !== right.startTime) return left.startTime.localeCompare(right.startTime);
    return left.groupCode.localeCompare(right.groupCode);
  });
}

export async function scrapeModuleTimetable(input: z.infer<typeof scrapeModuleTimetableSchema>): Promise<ActionResult> {
  const parsed = scrapeModuleTimetableSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid timetable scrape request.",
    };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      ok: false,
      error: "Unauthorized.",
      status: 401,
    };
  }

  const normalized = {
    ...parsed.data,
    moduleCode: cleanModuleCode(parsed.data.moduleCode),
  };

  const university = await getUniversityMetadata(normalized.universityId);
  if (!university) {
    return {
      ok: false,
      error: "Unknown university.",
    };
  }

  if (university.short_code !== "NWU") {
    return {
      ok: false,
      error: "Only NWU timetable scraping is supported in this release.",
    };
  }

  const campus = await getCampusMetadata(normalized.campusId);
  const celcatBase = campus?.campus_code ? NWU_CELCAT_BASE_BY_CAMPUS[campus.campus_code] : null;
  if (!celcatBase) {
    return {
      ok: false,
      error: "This campus does not have a configured NWU timetable source.",
    };
  }

  const searchParams = new URLSearchParams({
    searchTerm: normalized.moduleCode,
    pageSize: "25",
    pageNumber: "1",
    resType: "100",
  });

  const searchResponse = await fetchJson<CelcatSearchResponse>(`${celcatBase}/Home/ReadResourceListItems?${searchParams}`);
  if (!searchResponse.ok) {
    return searchResponse;
  }

  const matchingResources = (searchResponse.data.results ?? []).filter((resource) =>
    resource.id.toUpperCase().startsWith(normalized.moduleCode)
  );

  if (matchingResources.length === 0) {
    return {
      ok: false,
      error: `No NWU timetable entries were found for ${normalized.moduleCode}.`,
      status: 404,
    };
  }

  const semesterWindow = await getSemesterWindow({
    universityId: normalized.universityId,
    campusId: normalized.campusId ?? null,
    semester: normalized.semester,
    year: normalized.year,
  });

  const eventsByResource = new Map<string, CelcatCalendarEvent[]>();
  for (const resource of matchingResources) {
    const calendarBody = new URLSearchParams({
      start: semesterWindow.startDate,
      end: semesterWindow.endDate,
      resType: "100",
      calView: "month",
      colourScheme: "3",
      federationIds: resource.id,
    });

    const calendarResponse = await fetchJson<CelcatCalendarResponse>(`${celcatBase}/Home/GetCalendarData`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: calendarBody.toString(),
    });

    if (!calendarResponse.ok) {
      return calendarResponse;
    }

    eventsByResource.set(resource.id, calendarResponse.data.value ?? []);
  }

  const writeRows = buildWriteRows({
    moduleCode: normalized.moduleCode,
    semester: normalized.semester,
    resources: matchingResources,
    eventsByResource,
  });

  if (writeRows.length === 0) {
    return {
      ok: false,
      error: `No class slots were returned for ${normalized.moduleCode}.`,
      status: 404,
    };
  }

  const insertedRows = await withPlannerDbClient(async (client) => {
    await client.query("BEGIN");
    try {
      await client.query(
        `
          DELETE FROM module_timetables
          WHERE university_id = $1
            AND year = $2
            AND semester = $3
            AND module_code = $4
            AND campus_id IS NOT DISTINCT FROM $5::uuid
        `,
        [
          normalized.universityId,
          normalized.year,
          normalized.semester,
          normalized.moduleCode,
          normalized.campusId ?? null,
        ]
      );

      const inserted: Array<{
        moduleCode: string;
        moduleName: string | null;
        semester: number;
        year: number;
        dayOfWeek: string;
        startTime: string;
        endTime: string;
        venue: string | null;
        groupCode: string | null;
      }> = [];

      for (const row of writeRows) {
        const result = await client.query<{
          module_code: string;
          module_name: string | null;
          semester: number;
          year: number;
          day_of_week: string;
          start_time: string;
          end_time: string;
          venue: string | null;
          group_code: string | null;
        }>(
          `
            INSERT INTO module_timetables (
              university_id,
              campus_id,
              module_code,
              module_name,
              semester,
              year,
              day_of_week,
              start_time,
              end_time,
              venue,
              group_code,
              lecturer,
              source_url,
              source_type,
              last_verified_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12, 'html_scraped', NOW())
            RETURNING
              module_code,
              module_name,
              semester,
              year,
              day_of_week,
              start_time::text AS start_time,
              end_time::text AS end_time,
              venue,
              group_code
          `,
          [
            normalized.universityId,
            normalized.campusId ?? null,
            normalized.moduleCode,
            row.moduleName,
            normalized.semester,
            normalized.year,
            row.dayOfWeek,
            row.startTime,
            row.endTime,
            row.venue,
            row.groupCode,
            `${celcatBase}/Home/GetCalendarData`,
          ]
        );

        inserted.push({
          moduleCode: result.rows[0].module_code,
          moduleName: result.rows[0].module_name,
          semester: result.rows[0].semester,
          year: result.rows[0].year,
          dayOfWeek: result.rows[0].day_of_week,
          startTime: result.rows[0].start_time,
          endTime: result.rows[0].end_time,
          venue: result.rows[0].venue,
          groupCode: result.rows[0].group_code,
        });
      }

      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  await syncTier2PlannerEventsForStudent({
    studentId: userId,
    universityId: normalized.universityId,
    campusId: normalized.campusId ?? null,
    year: normalized.year,
  });

  return {
    ok: true,
    rows: insertedRows,
    insertedCount: insertedRows.length,
  };
}
