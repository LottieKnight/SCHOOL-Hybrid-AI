import "server-only";

import type { CalendarFormat } from "@/lib/academicPeriod";
import {
  INSTITUTION_PROFILE_SEEDS,
  SOUTH_AFRICAN_UNIVERSITY_SEEDS,
  UNIVERSITY_ARCHIVE_NOTES,
} from "@/lib/institutionSeedData";
import {
  getUniversityAcademicProfile,
  type UniversityAcademicUnitLabel,
} from "@/lib/universityAcademicCatalog";
import { listPlannerCampuses, listPlannerUniversities } from "@/lib/server/universityPlanner";
import { queryPlannerDb, withPlannerDbClient } from "@/lib/server/plannerDb";
import { getUserAppPreferences, readAcademicState } from "@/lib/server/userProfileState";

export type InstitutionListItem = {
  id: string;
  name: string;
  shortName: string | null;
  domain: string | null;
  type: "university" | "school" | null;
  province: string | null;
  country: string;
  academicPeriodType: CalendarFormat | null;
  faculties: string[];
  region: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  note: string | null;
  academicUnitLabel: UniversityAcademicUnitLabel | null;
};

export type InstitutionUserContext = InstitutionListItem & {
  faculty: string | null;
  currentModules: string[];
};

export type PublicInstitutionCampus = {
  id: string;
  name: string;
  isPrimary: boolean;
};

export type PublicInstitutionListItem = InstitutionListItem & {
  plannerUniversityId: string | null;
  campuses: PublicInstitutionCampus[];
};

type InstitutionCampusData = {
  plannerUniversityId: string | null;
  campuses: PublicInstitutionCampus[];
};

type InstitutionRow = {
  id: string;
  name: string;
  short_name: string | null;
  domain: string | null;
  type: string | null;
  province: string | null;
  country: string | null;
  academic_period_type: string | null;
  faculties: unknown;
  region: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
};

function canonicalInstitutionName(value: string | null | undefined) {
  const name = (value ?? "").trim();
  if (/^North-West University(?:\s+(?:Vanderbijlpark|Potchefstroom|Mahikeng|Mafikeng))?$/i.test(name)) {
    return "North-West University";
  }
  return name;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function normalizePeriodType(value: string | null | undefined): CalendarFormat | null {
  return value === "term" || value === "semester" || value === "trimester" || value === "quarter"
    ? value
    : null;
}

async function tableExists(tableName: string) {
  const result = await queryPlannerDb<{ regclass: string | null }>(`SELECT to_regclass($1) AS regclass`, [tableName]);
  return Boolean(result.rows[0]?.regclass);
}

async function columnExists(tableName: string, columnName: string) {
  const result = await queryPlannerDb<{ exists: boolean }>(
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
}

function seedToListItem(seedName: string): InstitutionListItem {
  const canonicalName = canonicalInstitutionName(seedName);
  const base =
    SOUTH_AFRICAN_UNIVERSITY_SEEDS.find((entry) => canonicalInstitutionName(entry.name) === canonicalName) ?? null;
  const profile =
    INSTITUTION_PROFILE_SEEDS.find((entry) => canonicalInstitutionName(entry.institutionName) === canonicalName) ?? null;
  const academicProfile = getUniversityAcademicProfile(canonicalName);

  return {
    id: seedName,
    name: canonicalName,
    shortName: base?.shortName ?? null,
    domain: base?.domain ?? null,
    type: base?.type ?? "university",
    province: base?.province ?? null,
    country: base?.country ?? "ZA",
    academicPeriodType: academicProfile?.academicPeriodType ?? profile?.academicPeriodType ?? null,
    faculties: academicProfile?.faculties ?? profile?.faculties ?? [],
    region: profile?.region ?? null,
    logoUrl: profile?.logoUrl ?? null,
    primaryColor: profile?.primaryColor ?? null,
    secondaryColor: profile?.secondaryColor ?? null,
    note: academicProfile?.note ?? UNIVERSITY_ARCHIVE_NOTES[canonicalName] ?? null,
    academicUnitLabel: academicProfile?.academicUnitLabel ?? null,
  };
}

function mapInstitutionRow(row: InstitutionRow): InstitutionListItem {
  const canonicalName = canonicalInstitutionName(row.name);
  const academicProfile = getUniversityAcademicProfile(canonicalName);
  return {
    id: row.id,
    name: canonicalName,
    shortName: row.short_name,
    domain: row.domain,
    type: row.type === "school" || row.type === "university" ? row.type : null,
    province: row.province,
    country: row.country || "ZA",
    academicPeriodType: academicProfile?.academicPeriodType ?? normalizePeriodType(row.academic_period_type),
    faculties: academicProfile?.faculties ?? asStringArray(row.faculties),
    region: row.region,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    note: academicProfile?.note ?? UNIVERSITY_ARCHIVE_NOTES[canonicalName] ?? null,
    academicUnitLabel: academicProfile?.academicUnitLabel ?? null,
  };
}

function mergeInstitutionListItems(current: InstitutionListItem | undefined, next: InstitutionListItem) {
  if (!current) return next;
  return {
    ...current,
    ...next,
    id: current.id || next.id,
    name: current.name || next.name,
    shortName: current.shortName ?? next.shortName ?? null,
    domain: current.domain ?? next.domain ?? null,
    type: current.type ?? next.type ?? null,
    province: current.province ?? next.province ?? null,
    country: current.country || next.country,
    academicPeriodType: current.academicPeriodType ?? next.academicPeriodType ?? null,
    faculties: current.faculties.length > 0 ? current.faculties : next.faculties,
    region: current.region ?? next.region ?? null,
    logoUrl: current.logoUrl ?? next.logoUrl ?? null,
    primaryColor: current.primaryColor ?? next.primaryColor ?? null,
    secondaryColor: current.secondaryColor ?? next.secondaryColor ?? null,
    note: current.note ?? next.note ?? null,
    academicUnitLabel: current.academicUnitLabel ?? next.academicUnitLabel ?? null,
  };
}

function deriveCurrentModules(academicState: ReturnType<typeof readAcademicState>) {
  return academicState.studyType === "university"
    ? academicState.modulePlan.map((module) => module.code)
    : academicState.selectedSubjects;
}

export async function getInstitutionList() {
  try {
    const hasInstitutionsTable = await tableExists("public.institutions");
    if (!hasInstitutionsTable) {
      return SOUTH_AFRICAN_UNIVERSITY_SEEDS.map((entry) => seedToListItem(entry.name)).sort((a, b) => a.name.localeCompare(b.name));
    }

    const hasProfilesTable = await tableExists("public.institution_profiles");
    const result = await queryPlannerDb<InstitutionRow>(
      `
        SELECT
          i.id::text AS id,
          i.name,
          i.short_name,
          i.domain,
          i.type,
          i.province,
          i.country,
          ${hasProfilesTable ? "ip.academic_period_type::text" : "NULL::text"} AS academic_period_type,
          ${hasProfilesTable ? "ip.faculties" : "'[]'::jsonb"} AS faculties,
          ${hasProfilesTable ? "ip.region" : "NULL::text"} AS region,
          ${hasProfilesTable ? "ip.logo_url" : "NULL::text"} AS logo_url,
          ${hasProfilesTable ? "ip.primary_color" : "NULL::text"} AS primary_color,
          ${hasProfilesTable ? "ip.secondary_color" : "NULL::text"} AS secondary_color
        FROM institutions i
        ${hasProfilesTable ? "LEFT JOIN institution_profiles ip ON ip.institution_id = i.id" : ""}
        ORDER BY i.name ASC
      `
    );

    if (result.rowCount === 0) {
      return SOUTH_AFRICAN_UNIVERSITY_SEEDS.map((entry) => seedToListItem(entry.name)).sort((a, b) => a.name.localeCompare(b.name));
    }

    const rows = result.rows.map(mapInstitutionRow);
    const existingNames = new Set(rows.map((row) => canonicalInstitutionName(row.name)));
    const existingDomains = new Set(rows.map((row) => row.domain?.trim().toLowerCase()).filter(Boolean));
    const missingSeeds = SOUTH_AFRICAN_UNIVERSITY_SEEDS
      .filter((entry) => {
        const canonicalName = canonicalInstitutionName(entry.name);
        const normalizedDomain = entry.domain?.trim().toLowerCase() ?? null;
        if (existingNames.has(canonicalName)) return false;
        if (normalizedDomain && existingDomains.has(normalizedDomain)) return false;
        return true;
      })
      .map((entry) => seedToListItem(entry.name));
    const deduped = [...rows, ...missingSeeds].reduce<Map<string, InstitutionListItem>>((map, item) => {
      const key = canonicalInstitutionName(item.name);
      map.set(key, mergeInstitutionListItems(map.get(key), item));
      return map;
    }, new Map());

    return Array.from(deduped.values()).sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return SOUTH_AFRICAN_UNIVERSITY_SEEDS.map((entry) => seedToListItem(entry.name)).sort((a, b) => a.name.localeCompare(b.name));
  }
}

export async function getPublicInstitutionList(): Promise<PublicInstitutionListItem[]> {
  const [institutions, plannerUniversities] = await Promise.all([
    getInstitutionList(),
    listPlannerUniversities().catch(() => []),
  ]);

  const plannerUniversityMap = new Map(
    plannerUniversities.map((university) => [university.shortCode || canonicalInstitutionName(university.name), university]),
  );
  const plannerUniversityByName = new Map(
    plannerUniversities.map((university) => [canonicalInstitutionName(university.name), university]),
  );

  const campusEntries = await Promise.all(
    institutions.map(async (institution) => {
      const plannerUniversity =
        (institution.shortName ? plannerUniversityMap.get(institution.shortName) : null) ??
        plannerUniversityByName.get(canonicalInstitutionName(institution.name)) ??
        null;

      if (!plannerUniversity) {
        return [
          institution.id,
          {
            plannerUniversityId: null,
            campuses: [] as PublicInstitutionCampus[],
          } satisfies InstitutionCampusData,
        ] as const;
      }

      const campuses = await listPlannerCampuses(plannerUniversity.id).catch(() => []);
      return [
        institution.id,
        {
          plannerUniversityId: plannerUniversity.id,
          campuses: campuses.map((campus) => ({
            id: campus.id,
            name: campus.campusName,
            isPrimary: campus.isPrimary,
          })),
        } satisfies InstitutionCampusData,
      ] as const;
    }),
  );

  const campusesByInstitutionId = new Map<string, InstitutionCampusData>(campusEntries);

  return institutions.map((institution) => {
    const campusData = campusesByInstitutionId.get(institution.id);
    return {
      ...institution,
      plannerUniversityId: campusData?.plannerUniversityId ?? null,
      campuses: [...(campusData?.campuses ?? [])].sort((left, right) => {
        if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
        return left.name.localeCompare(right.name);
      }),
    };
  });
}

export async function getInstitutionById(institutionId: string) {
  const institutions = await getInstitutionList();
  return institutions.find((item) => item.id === institutionId) ?? null;
}

export async function getInstitutionContextForUser(userId: string): Promise<InstitutionUserContext | null> {
  if (!userId) return null;

  const preferences = await getUserAppPreferences(userId).catch(() => ({}));
  const academicState = readAcademicState(preferences);
  const fallbackById = academicState.institutionId ? await getInstitutionById(academicState.institutionId) : null;
  const fallbackName = academicState.institution;
  const fallbackInstitution = fallbackById ?? (fallbackName ? seedToListItem(fallbackName) : null);

  try {
    const hasInstitutionsTable = await tableExists("public.institutions");
    const hasInstitutionProfilesTable = await tableExists("public.institution_profiles");
    const hasUsersInstitutionId = hasInstitutionsTable && (await columnExists("users", "institution_id"));

    if (!hasUsersInstitutionId) {
      if (!fallbackInstitution) return null;
      return {
        ...fallbackInstitution,
        academicPeriodType: academicState.calendarFormat ?? fallbackInstitution.academicPeriodType,
        faculty: academicState.faculty,
        currentModules: deriveCurrentModules(academicState),
      };
    }

    const result = await queryPlannerDb<InstitutionRow>(
      `
        SELECT
          i.id::text AS id,
          i.name,
          i.short_name,
          i.domain,
          i.type,
          i.province,
          i.country,
          ${hasInstitutionProfilesTable ? "ip.academic_period_type::text" : "NULL::text"} AS academic_period_type,
          ${hasInstitutionProfilesTable ? "ip.faculties" : "'[]'::jsonb"} AS faculties,
          ${hasInstitutionProfilesTable ? "ip.region" : "NULL::text"} AS region,
          ${hasInstitutionProfilesTable ? "ip.logo_url" : "NULL::text"} AS logo_url,
          ${hasInstitutionProfilesTable ? "ip.primary_color" : "NULL::text"} AS primary_color,
          ${hasInstitutionProfilesTable ? "ip.secondary_color" : "NULL::text"} AS secondary_color
        FROM users u
        LEFT JOIN institutions i ON i.id = u.institution_id
        ${hasInstitutionProfilesTable ? "LEFT JOIN institution_profiles ip ON ip.institution_id = i.id" : ""}
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId]
    );

    const row = result.rows[0];
    if (!row?.id && !fallbackInstitution) {
      return null;
    }

    const base = row?.id ? mapInstitutionRow(row) : fallbackInstitution;
    if (!base) {
      return null;
    }
    return {
      ...base,
      academicPeriodType: base.academicPeriodType ?? academicState.calendarFormat,
      faculty: academicState.faculty,
      currentModules: deriveCurrentModules(academicState),
    };
  } catch {
    if (!fallbackInstitution) {
      return null;
    }
    return {
      ...fallbackInstitution,
      academicPeriodType: academicState.calendarFormat ?? fallbackInstitution.academicPeriodType,
      faculty: academicState.faculty,
      currentModules: deriveCurrentModules(academicState),
    };
  }
}

export async function upsertInstitutionSeedData() {
  const hasInstitutionsTable = await tableExists("public.institutions");
  const hasProfilesTable = await tableExists("public.institution_profiles");
  if (!hasInstitutionsTable) {
    throw new Error("institutions table does not exist. Apply migration 049 first.");
  }

  return withPlannerDbClient(async (client) => {
    for (const seed of SOUTH_AFRICAN_UNIVERSITY_SEEDS) {
      const result = await client.query<{ id: string }>(
        `
          INSERT INTO institutions (name, short_name, domain, type, province, country, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, TRUE)
          ON CONFLICT (domain) DO UPDATE
          SET name = EXCLUDED.name,
              short_name = COALESCE(EXCLUDED.short_name, institutions.short_name),
              province = COALESCE(EXCLUDED.province, institutions.province),
              country = COALESCE(EXCLUDED.country, institutions.country),
              updated_at = NOW()
          RETURNING id::text AS id
        `,
        [seed.name, seed.shortName ?? null, seed.domain ?? null, seed.type, seed.province ?? null, seed.country]
      );

      const institutionId = result.rows[0]?.id;
      if (!institutionId || !hasProfilesTable) continue;

      const profile = INSTITUTION_PROFILE_SEEDS.find((entry) => entry.institutionName === seed.name);
      if (!profile) continue;

      await client.query(
        `
          INSERT INTO institution_profiles (
            institution_id,
            academic_period_type,
            faculties,
            country,
            region,
            logo_url,
            primary_color,
            secondary_color
          )
          VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
          ON CONFLICT (institution_id) DO UPDATE
          SET academic_period_type = EXCLUDED.academic_period_type,
              faculties = EXCLUDED.faculties,
              country = EXCLUDED.country,
              region = EXCLUDED.region,
              logo_url = EXCLUDED.logo_url,
              primary_color = EXCLUDED.primary_color,
              secondary_color = EXCLUDED.secondary_color,
              updated_at = NOW()
        `,
        [
          institutionId,
          profile.academicPeriodType,
          JSON.stringify(profile.faculties),
          profile.country ?? "ZA",
          profile.region ?? null,
          profile.logoUrl ?? null,
          profile.primaryColor ?? null,
          profile.secondaryColor ?? null,
        ]
      );
    }
  });
}
