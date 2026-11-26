import "dotenv/config";

import { Pool, type PoolClient } from "pg";

type AcademicCalendarSeed = {
  universityId: string | null;
  campusId: string | null;
  year: number;
  label: string;
  eventType:
    | "semester_start"
    | "semester_end"
    | "exam_opp1_start"
    | "exam_opp1_end"
    | "recess_start"
    | "recess_end"
    | "orientation"
    | "registration"
    | "public_holiday"
    | "special_holiday"
    | "campus_event";
  semester: 1 | 2 | null;
  startDate: string;
  endDate: string | null;
  isNoEventsPeriod: boolean;
  sourceUrl: string;
  sourceType: "pdf_parsed" | "manual";
  lastVerifiedAt: string | null;
};

type CampusSeed = {
  campusName: string;
  campusCode: string;
  city: string | null;
  province: string | null;
  isPrimary: boolean;
};

const DATABASE_URL =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured.");
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 2,
});

const NWU_UNIVERSITY = {
  name: "North-West University",
  shortCode: "NWU",
  country: "ZA",
  studentSystem: "campusnexus",
  calendarUrl: "https://www.nwu.ac.za/content/dates-home-page",
  examTimetableUrl: "https://studies.nwu.ac.za/studies/exam-timetables",
  classTimetableUrl: "https://studies.nwu.ac.za/studies/class-timetables",
  yearbookUrl: "https://studies.nwu.ac.za/studies/yearbooks",
  portalUrl: "https://sisportal-100997.campusnexus.cloud/cmcportal/",
  isActive: true,
} as const;

const NWU_CAMPUSES: readonly CampusSeed[] = [
  {
    campusName: "Vanderbijlpark Campus",
    campusCode: "VC",
    city: "Vanderbijlpark",
    province: "Gauteng",
    isPrimary: true,
  },
  {
    campusName: "Potchefstroom Campus",
    campusCode: "PC",
    city: "Potchefstroom",
    province: "North West",
    isPrimary: false,
  },
  {
    campusName: "Mahikeng Campus",
    campusCode: "MC",
    city: "Mahikeng",
    province: "North West",
    isPrimary: false,
  },
] as const;

const MULTI_INSTITUTION_STUBS = [
  { name: "University of Pretoria", shortCode: "UP", calendarUrl: null },
  { name: "University of the Witwatersrand", shortCode: "WITS", calendarUrl: null },
  { name: "University of Johannesburg", shortCode: "UJ", calendarUrl: null },
  { name: "University of Cape Town", shortCode: "UCT", calendarUrl: null },
  { name: "Stellenbosch University", shortCode: "SU", calendarUrl: null },
  { name: "University of the Free State", shortCode: "UFS", calendarUrl: null },
  { name: "University of KwaZulu-Natal", shortCode: "UKZN", calendarUrl: null },
  { name: "University of the Western Cape", shortCode: "UWC", calendarUrl: null },
  { name: "University of Limpopo", shortCode: "UL", calendarUrl: null },
  { name: "University of South Africa", shortCode: "UNISA", calendarUrl: null },
] as const;

const CAMPUSES_BY_UNIVERSITY_SHORT_CODE: Record<string, readonly CampusSeed[]> = {
  NWU: NWU_CAMPUSES,
  UP: [
    { campusName: "Hatfield Campus", campusCode: "HATFIELD", city: "Pretoria", province: "Gauteng", isPrimary: true },
    { campusName: "Groenkloof Campus", campusCode: "GROENKLOOF", city: "Pretoria", province: "Gauteng", isPrimary: false },
    { campusName: "Prinshof Campus", campusCode: "PRINSHOF", city: "Pretoria", province: "Gauteng", isPrimary: false },
    { campusName: "Onderstepoort Campus", campusCode: "ONDERSTEPOORT", city: "Pretoria", province: "Gauteng", isPrimary: false },
    { campusName: "Mamelodi Campus", campusCode: "MAMELODI", city: "Pretoria", province: "Gauteng", isPrimary: false },
  ],
  UJ: [
    { campusName: "Auckland Park Kingsway Campus", campusCode: "APK", city: "Johannesburg", province: "Gauteng", isPrimary: true },
    { campusName: "Auckland Park Arts Campus", campusCode: "APA", city: "Johannesburg", province: "Gauteng", isPrimary: false },
    { campusName: "Doornfontein Campus", campusCode: "DFC", city: "Johannesburg", province: "Gauteng", isPrimary: false },
    { campusName: "Soweto Campus", campusCode: "SWC", city: "Soweto", province: "Gauteng", isPrimary: false },
  ],
  WITS: [
    { campusName: "East Campus", campusCode: "EAST", city: "Johannesburg", province: "Gauteng", isPrimary: true },
    { campusName: "West Campus", campusCode: "WEST", city: "Johannesburg", province: "Gauteng", isPrimary: false },
    { campusName: "Education Campus", campusCode: "EDU", city: "Johannesburg", province: "Gauteng", isPrimary: false },
    { campusName: "Health Sciences Campus", campusCode: "HEALTH", city: "Johannesburg", province: "Gauteng", isPrimary: false },
    { campusName: "Parktown Campus", campusCode: "PARKTOWN", city: "Johannesburg", province: "Gauteng", isPrimary: false },
  ],
  UCT: [
    { campusName: "Upper Campus", campusCode: "UPPER", city: "Cape Town", province: "Western Cape", isPrimary: true },
    { campusName: "Middle Campus", campusCode: "MIDDLE", city: "Cape Town", province: "Western Cape", isPrimary: false },
    { campusName: "Lower Campus", campusCode: "LOWER", city: "Cape Town", province: "Western Cape", isPrimary: false },
    { campusName: "Health Sciences Campus", campusCode: "HEALTH", city: "Cape Town", province: "Western Cape", isPrimary: false },
    { campusName: "Hiddingh Campus", campusCode: "HIDDINGH", city: "Cape Town", province: "Western Cape", isPrimary: false },
  ],
  SU: [
    { campusName: "Stellenbosch Campus", campusCode: "MAIN", city: "Stellenbosch", province: "Western Cape", isPrimary: true },
    { campusName: "Tygerberg Campus", campusCode: "TYGERBERG", city: "Cape Town", province: "Western Cape", isPrimary: false },
    { campusName: "Saldanha Campus (Military Science)", campusCode: "SALDANHA", city: "Saldanha", province: "Western Cape", isPrimary: false },
  ],
  UFS: [
    { campusName: "Bloemfontein Campus", campusCode: "BFN", city: "Bloemfontein", province: "Free State", isPrimary: true },
    { campusName: "South Campus", campusCode: "SOUTH", city: "Bloemfontein", province: "Free State", isPrimary: false },
    { campusName: "Qwaqwa Campus", campusCode: "QWAQWA", city: "Phuthaditjhaba", province: "Free State", isPrimary: false },
  ],
  UKZN: [
    { campusName: "Howard College Campus", campusCode: "HOWARD", city: "Durban", province: "KwaZulu-Natal", isPrimary: true },
    { campusName: "Westville Campus", campusCode: "WESTVILLE", city: "Durban", province: "KwaZulu-Natal", isPrimary: false },
    { campusName: "Pietermaritzburg Campus", campusCode: "PMB", city: "Pietermaritzburg", province: "KwaZulu-Natal", isPrimary: false },
    { campusName: "Edgewood Campus", campusCode: "EDGEWOOD", city: "Durban", province: "KwaZulu-Natal", isPrimary: false },
    { campusName: "Nelson R. Mandela School of Medicine", campusCode: "MEDICINE", city: "Durban", province: "KwaZulu-Natal", isPrimary: false },
  ],
  UWC: [{ campusName: "Bellville Campus", campusCode: "BELLVILLE", city: "Bellville", province: "Western Cape", isPrimary: true }],
  UL: [
    { campusName: "Turfloop Campus", campusCode: "TURFLOOP", city: "Sovenga", province: "Limpopo", isPrimary: true },
    { campusName: "Medunsa Campus", campusCode: "MEDUNSA", city: "Pretoria", province: "Gauteng", isPrimary: false },
  ],
  UNISA: [
    { campusName: "Muckleneuk Campus (Main)", campusCode: "MUCKLENEUK", city: "Pretoria", province: "Gauteng", isPrimary: true },
    { campusName: "Johannesburg Regional Campus", campusCode: "JHB", city: "Johannesburg", province: "Gauteng", isPrimary: false },
    { campusName: "Cape Town Regional Campus", campusCode: "CPT", city: "Cape Town", province: "Western Cape", isPrimary: false },
    { campusName: "Durban Regional Campus", campusCode: "DBN", city: "Durban", province: "KwaZulu-Natal", isPrimary: false },
    { campusName: "East London Regional Campus", campusCode: "EL", city: "East London", province: "Eastern Cape", isPrimary: false },
    { campusName: "Mbombela Regional Campus", campusCode: "MBM", city: "Mbombela", province: "Mpumalanga", isPrimary: false },
    { campusName: "Parow Regional Campus", campusCode: "PAROW", city: "Parow", province: "Western Cape", isPrimary: false },
    { campusName: "Polokwane Regional Campus", campusCode: "POL", city: "Polokwane", province: "Limpopo", isPrimary: false },
  ],
};

const SA_PUBLIC_HOLIDAYS_2026: Array<Omit<AcademicCalendarSeed, "year" | "sourceType" | "sourceUrl" | "lastVerifiedAt" | "isNoEventsPeriod" | "universityId" | "campusId" | "semester" | "endDate">> = [
  { label: "New Year's Day", eventType: "public_holiday", startDate: "2026-01-01" },
  { label: "Human Rights Day", eventType: "public_holiday", startDate: "2026-03-21" },
  { label: "Good Friday", eventType: "public_holiday", startDate: "2026-04-03" },
  { label: "Family Day", eventType: "public_holiday", startDate: "2026-04-06" },
  { label: "Freedom Day", eventType: "public_holiday", startDate: "2026-04-27" },
  { label: "Workers' Day", eventType: "public_holiday", startDate: "2026-05-01" },
  { label: "Special School Holiday (Youth Day Eve)", eventType: "special_holiday", startDate: "2026-06-15" },
  { label: "Youth Day", eventType: "public_holiday", startDate: "2026-06-16" },
  { label: "National Women's Day", eventType: "public_holiday", startDate: "2026-08-10" },
  { label: "Heritage Day", eventType: "public_holiday", startDate: "2026-09-24" },
  { label: "Day of Reconciliation", eventType: "public_holiday", startDate: "2026-12-16" },
  { label: "Christmas Day", eventType: "public_holiday", startDate: "2026-12-25" },
  { label: "Day of Goodwill", eventType: "public_holiday", startDate: "2026-12-26" },
];

async function upsertUniversity(client: PoolClient, input: {
  name: string;
  shortCode: string;
  country: string;
  studentSystem: "campusnexus" | "peoplesoft" | "moodle" | "its" | "other";
  calendarUrl: string | null;
  examTimetableUrl: string | null;
  classTimetableUrl: string | null;
  yearbookUrl: string | null;
  portalUrl: string | null;
  isActive: boolean;
}) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO universities (
        name,
        short_code,
        country,
        student_system,
        calendar_url,
        exam_timetable_url,
        class_timetable_url,
        yearbook_url,
        portal_url,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (short_code) DO UPDATE
      SET name = EXCLUDED.name,
          country = EXCLUDED.country,
          student_system = EXCLUDED.student_system,
          calendar_url = EXCLUDED.calendar_url,
          exam_timetable_url = EXCLUDED.exam_timetable_url,
          class_timetable_url = EXCLUDED.class_timetable_url,
          yearbook_url = EXCLUDED.yearbook_url,
          portal_url = EXCLUDED.portal_url,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      RETURNING id::text AS id
    `,
    [
      input.name,
      input.shortCode,
      input.country,
      input.studentSystem,
      input.calendarUrl,
      input.examTimetableUrl,
      input.classTimetableUrl,
      input.yearbookUrl,
      input.portalUrl,
      input.isActive,
    ]
  );

  return result.rows[0].id;
}

async function upsertCampus(client: PoolClient, input: {
  universityId: string;
  campusName: string;
  campusCode: string;
  city: string | null;
  province: string | null;
  isPrimary: boolean;
}) {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO university_campuses (
        university_id,
        campus_name,
        campus_code,
        city,
        province,
        is_primary
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (university_id, campus_code) DO UPDATE
      SET campus_name = EXCLUDED.campus_name,
          city = EXCLUDED.city,
          province = EXCLUDED.province,
          is_primary = EXCLUDED.is_primary,
          updated_at = NOW()
      RETURNING id::text AS id
    `,
    [input.universityId, input.campusName, input.campusCode, input.city, input.province, input.isPrimary]
  );

  return result.rows[0].id;
}

async function insertAcademicCalendar(client: PoolClient, input: AcademicCalendarSeed) {
  await client.query(
    `
      INSERT INTO academic_calendars (
        university_id,
        campus_id,
        year,
        label,
        event_type,
        semester,
        start_date,
        end_date,
        is_no_events_period,
        source_url,
        source_type,
        last_verified_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT DO NOTHING
    `,
    [
      input.universityId,
      input.campusId,
      input.year,
      input.label,
      input.eventType,
      input.semester,
      input.startDate,
      input.endDate,
      input.isNoEventsPeriod,
      input.sourceUrl,
      input.sourceType,
      input.lastVerifiedAt,
    ]
  );
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const universityIdsByShortCode = new Map<string, string>();

    const nwuUniversityId = await upsertUniversity(client, {
      name: NWU_UNIVERSITY.name,
      shortCode: NWU_UNIVERSITY.shortCode,
      country: NWU_UNIVERSITY.country,
      studentSystem: NWU_UNIVERSITY.studentSystem,
      calendarUrl: NWU_UNIVERSITY.calendarUrl,
      examTimetableUrl: NWU_UNIVERSITY.examTimetableUrl,
      classTimetableUrl: NWU_UNIVERSITY.classTimetableUrl,
      yearbookUrl: NWU_UNIVERSITY.yearbookUrl,
      portalUrl: NWU_UNIVERSITY.portalUrl,
      isActive: NWU_UNIVERSITY.isActive,
    });
    universityIdsByShortCode.set(NWU_UNIVERSITY.shortCode, nwuUniversityId);

    for (const stub of MULTI_INSTITUTION_STUBS) {
      const universityId = await upsertUniversity(client, {
        name: stub.name,
        shortCode: stub.shortCode,
        country: "ZA",
        studentSystem: "other",
        calendarUrl: stub.calendarUrl,
        examTimetableUrl: null,
        classTimetableUrl: null,
        yearbookUrl: null,
        portalUrl: null,
        isActive: true,
      });
      universityIdsByShortCode.set(stub.shortCode, universityId);
    }

    const campusIds = new Map<string, string>();
    for (const [shortCode, campuses] of Object.entries(CAMPUSES_BY_UNIVERSITY_SHORT_CODE)) {
      const universityId = universityIdsByShortCode.get(shortCode);
      if (!universityId) {
        throw new Error(`Unable to resolve the university id for ${shortCode}.`);
      }

      for (const campus of campuses) {
        const campusId = await upsertCampus(client, {
          universityId,
          campusName: campus.campusName,
          campusCode: campus.campusCode,
          city: campus.city,
          province: campus.province,
          isPrimary: campus.isPrimary,
        });

        if (shortCode === "NWU") {
          campusIds.set(campus.campusCode, campusId);
        }
      }
    }

    const vanderbijlparkCampusId = campusIds.get("VC");
    if (!vanderbijlparkCampusId) {
      throw new Error("Unable to resolve the NWU Vanderbijlpark campus id.");
    }

    const nwuAcademicCalendarSeeds: AcademicCalendarSeed[] = [
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Online Registration Opens (First Years)",
        eventType: "registration",
        semester: null,
        startDate: "2026-01-19",
        endDate: "2026-01-25",
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Online Registration Opens (Senior Students)",
        eventType: "registration",
        semester: null,
        startDate: "2026-01-26",
        endDate: "2026-02-08",
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Orientation Programme (First Year Students)",
        eventType: "orientation",
        semester: null,
        startDate: "2026-01-31",
        endDate: "2026-02-08",
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "NWU Official Opening 2026",
        eventType: "campus_event",
        semester: null,
        startDate: "2026-02-13",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Semester 1 - Classes Begin",
        eventType: "semester_start",
        semester: 1,
        startDate: "2026-02-09",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Semester 1 - Classes End",
        eventType: "semester_end",
        semester: 1,
        startDate: "2026-05-08",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Exam Period - Opportunity 1 (Sem 1)",
        eventType: "exam_opp1_start",
        semester: 1,
        startDate: "2026-05-12",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Exam Period - Opportunity 1 End (Sem 1)",
        eventType: "exam_opp1_end",
        semester: 1,
        startDate: "2026-06-19",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Winter Recess Begins",
        eventType: "recess_start",
        semester: null,
        startDate: "2026-06-20",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Winter Recess Ends",
        eventType: "recess_end",
        semester: null,
        startDate: "2026-07-19",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Semester 2 - Classes Begin",
        eventType: "semester_start",
        semester: 2,
        startDate: "2026-07-20",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Semester 2 - Classes End",
        eventType: "semester_end",
        semester: 2,
        startDate: "2026-10-09",
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Exam Period - Opportunity 1 (Sem 2)",
        eventType: "exam_opp1_start",
        semester: 2,
        startDate: "2026-10-14",
        endDate: null,
        isNoEventsPeriod: true,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
      {
        universityId: nwuUniversityId,
        campusId: vanderbijlparkCampusId,
        year: 2026,
        label: "Exam Period - Opportunity 1 End (Sem 2)",
        eventType: "exam_opp1_end",
        semester: 2,
        startDate: "2026-11-20",
        endDate: null,
        isNoEventsPeriod: true,
        sourceUrl: NWU_UNIVERSITY.calendarUrl,
        sourceType: "pdf_parsed",
        lastVerifiedAt: "2026-02-04T00:00:00Z",
      },
    ];

    for (const event of nwuAcademicCalendarSeeds) {
      await insertAcademicCalendar(client, event);
    }

    for (const holiday of SA_PUBLIC_HOLIDAYS_2026) {
      await insertAcademicCalendar(client, {
        universityId: null,
        campusId: null,
        year: 2026,
        label: holiday.label,
        eventType: holiday.eventType,
        semester: null,
        startDate: holiday.startDate,
        endDate: null,
        isNoEventsPeriod: false,
        sourceUrl: "https://www.gov.za/about-sa/public-holidays",
        sourceType: "manual",
        lastVerifiedAt: null,
      });
    }

    await client.query("COMMIT");
    console.log("University calendar seed completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void seed().catch((error) => {
  console.error("University calendar seed failed:", error);
  process.exitCode = 1;
});
