import "server-only";

import type { CalendarFormat } from "@/lib/academicPeriod";
import type {
  UniversityAcademicProfile,
  UniversityCourseCatalog,
  UniversityCourseModule,
} from "@/lib/universityAcademicCatalog";
import { getCatalogCourses, getUniversityAcademicProfile } from "@/lib/universityAcademicCatalog";
import rawNwuCatalog from "@/lib/generated/nwuAcademicCatalog.generated.json";
import rawNwuProgramOverrides from "@/lib/generated/nwuProgramOverrides.generated.json";
import rawUjCatalog from "@/lib/generated/ujCbeAcademicCatalog.generated.json";
import rawUnizuluCatalog from "@/lib/generated/unizuluFcalAcademicCatalog.generated.json";
import rawUnizuluFhssCatalog from "@/lib/generated/unizuluFhssAcademicCatalog.generated.json";

export type YearbookCourseModule = UniversityCourseModule;
export type YearbookCourseCatalog = UniversityCourseCatalog;

export type UniversityCatalogPayload = {
  institutionName: string;
  academicPeriodType: CalendarFormat;
  academicUnitLabel: UniversityAcademicProfile["academicUnitLabel"] | null;
  campuses: string[];
  faculties: string[];
  courses: YearbookCourseCatalog[];
  note: string | null;
};

export function getYearOfStudyModulePlan(
  course: Pick<YearbookCourseCatalog, "modules"> | null | undefined,
  yearOfStudy: number,
) {
  return (course?.modules ?? []).filter((module) => module.yearOfStudy === yearOfStudy);
}

type RawNwuModule = {
  code?: string | null;
  name?: string | null;
  credits?: number | null;
  yearOfStudy?: number | null;
  semester?: number | null;
  isCore?: boolean | null;
  durationType?: string | null;
  durationLabel?: string | null;
};

type RawNwuCourse = {
  id?: string | null;
  name?: string | null;
  qualificationCode?: string | null;
  faculty?: string | null;
  campuses?: string[] | null;
  deliveryMode?: string | null;
  durationYears?: number | null;
  source?: string | null;
  sourceLabel?: string | null;
  sourceDocument?: string | null;
  modules?: RawNwuModule[] | null;
};

type RawNwuCatalog = {
  institutionName?: string | null;
  academicPeriodType?: CalendarFormat | null;
  academicUnitLabel?: UniversityAcademicProfile["academicUnitLabel"];
  campuses?: string[] | null;
  faculties?: string[] | null;
  courses?: RawNwuCourse[] | null;
  notes?: { source?: string | null } | null;
};

type RawNwuProgramOverride = {
  faculty?: string | null;
  programmeTitle?: string | null;
  qualificationName?: string | null;
  qualificationCode?: string | null;
  campuses?: string[] | null;
  sourceDocument?: string | null;
  sourcePage?: number | null;
};

const NWU_LOOKUP_NAMES = new Set([
  "North-West University",
  "North-West University Vanderbijlpark",
  "North-West University Potchefstroom",
  "North-West University Mahikeng",
  "North-West University Mafikeng",
]);

const GENERIC_EXCLUDED_COURSE_PATTERNS = [
  /^compilation of programme/i,
  /^compilation of the /i,
  /^rules for/i,
  /^major modules for/i,
  /^programme$/i,
  /^3bb\s+h04/i,
  /^8[a-z0-9]/i,
];

const QUALIFICATION_CODE_PATTERN = /\b\d[A-Z]{1,4}-[A-Z]\d{2}-[A-Z]\d{3}[A-Z](?:-[A-Z]{2})?\b/i;
const TRAILING_QUALIFIER_PATTERN = /\s+\d[A-Z]{1,3}\s+[A-Z0-9\-\/ ]+$/i;
const TRAILING_CREDITS_PATTERN = /\s+(\d{1,3})$/;
const LEADING_RULE_PREFIX_PATTERN = /^(?:THE|HSC|NAS|EMS|HUM|FLAW|FENG|FEDU|FNAS)\.\d+(?:\.\d+)*\s+/i;
const LEADING_SAQA_PATTERN = /^SAQA\s+ID\s+\d+(?:\/\d+)?\s*/i;
const TRAILING_TRANSLATION_PATTERN = /\s*\/\s*Baccalaureus.+$/i;
const TRAILING_CODE_BLOCK_PATTERN = /\s+[0-9A-Z]{1,4}\s*[A-Z0-9\-\/ ]+$/i;
const PROGRAMME_TITLE_CODE_SUFFIX_PATTERN = /\s+\d[A-Z]{1,4}\s+[A-Z0-9\-\/]+$/i;
const LEADING_PROGRAMME_CODE_PATTERN = /^\d[A-Z]{1,4}\s+[A-Z0-9\-\/]+\s+/i;
const LEADING_DOTTED_CODE_PATTERN = /^[A-Z]{2,5}\.\d+(?:\.\d+)*\s+/i;
const INVALID_DISPLAY_NAME_PATTERNS = [
  /^first bachelor/i,
  /^rules for/i,
  /^the duration of/i,
  /^list of /i,
  /^compilation of programme$/i,
  /^programme$/i,
  /^major modules for/i,
];

const NWU_MODULE_NAME_OVERRIDES: Record<string, string> = {
  STTF122: "Foundation Statistics II",
  MTHS123: "Mathematical Techniques",
  MTHS119: "Foundation Mathematics 1",
  MTHS129: "Foundation Mathematics 2",
  STTN111: "Descriptive Statistics",
  STTN122: "Introductory Statistics",
  STTN124: "Practical Statistics",
};

const NWU_CURATED_OVERRIDES: YearbookCourseCatalog[] = [
  {
    id: "nwu-bcom-accounting-general",
    name: "Bachelor of Commerce in Accounting (General)",
    qualificationCode: "5FH-H01-E302V-FT",
    faculty: "Economic and Management Sciences",
    campuses: ["Vanderbijlpark"],
    durationYears: 3,
    source: "curated",
    sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
    sourceDocument:
      "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
    modules: [
      { code: "ACCF111", name: "Accounting 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN111", name: "Business Management 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON112", name: "Economics 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "MTHS112", name: "Mathematics 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "GEAR111", name: "Governance, Ethics, Assurance and Risk 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACCF121", name: "Accounting 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ALDA/E122", name: "Academic Literacy 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN121", name: "Business Management 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON122", name: "Economics 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "STTN122", name: "Statistics 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "WVET222", name: "Understanding the World 2B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ACCF211", name: "Accounting 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAR213", name: "Marketing Management 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "TAXF211", name: "Taxation 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACCF221", name: "Accounting 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN221", name: "Business Management 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "TAXF221", name: "Taxation 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "FINM272", name: "Financial Management 2AB", credits: null, semester: null, yearOfStudy: 2, isCore: true, durationType: "year", durationLabel: "Year module" },
      { code: "MACC272", name: "Management Accounting 2AB", credits: null, semester: null, yearOfStudy: 2, isCore: true, durationType: "year", durationLabel: "Year module" },
      { code: "BMAN311", name: "Business Management 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "WVES312", name: "Understanding the World 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN321", name: "Business Management 3B", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ACCF372", name: "Accounting 3AB", credits: null, semester: null, yearOfStudy: 3, isCore: true, durationType: "year", durationLabel: "Year module" },
      { code: "FINM372", name: "Financial Management 3AB", credits: null, semester: null, yearOfStudy: 3, isCore: true, durationType: "year", durationLabel: "Year module" },
      { code: "MACC372", name: "Management Accounting 3AB", credits: null, semester: null, yearOfStudy: 3, isCore: true, durationType: "year", durationLabel: "Year module" },
      { code: "TAXF372", name: "Taxation 3AB", credits: null, semester: null, yearOfStudy: 3, isCore: true, durationType: "year", durationLabel: "Year module" },
    ],
  },
  {
    id: "nwu-bcom-economics-risk-management",
    name: "Bachelor of Commerce in Economic Sciences with Economics and Risk Management",
    qualificationCode: "5FK-H05-E301P-FT / 5FK-H05-E301V-FT",
    faculty: "Economic and Management Sciences",
    campuses: ["Potchefstroom", "Vanderbijlpark"],
    durationYears: 3,
    source: "curated",
    sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
    sourceDocument:
      "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
    modules: [
      { code: "ACCS/ACCF111", name: "Accounting 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN111", name: "Business Management 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON112", name: "Economics 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "MTHS112", name: "Mathematics 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "CMPG112", name: "Computing 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACCS/F121", name: "Accounting 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ALDA/E122", name: "Academic Literacy 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN121", name: "Business Management 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON122", name: "Economics 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "STTN122", name: "Statistics 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ACCF211", name: "Accounting 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON211", name: "Economics 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP212", name: "Macroeconomics 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKRP211", name: "Risk Management 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACCF221", name: "Accounting 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON221", name: "Economics 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP222", name: "Macroeconomics 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKRP221", name: "Risk Management 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "CMPG222", name: "Computing 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON313", name: "Economics 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON314", name: "Economics 3A Advanced", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP312", name: "Macroeconomics 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKRP311", name: "Risk Management 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "WVES312", name: "Understanding the World 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON322", name: "Economics 3B", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON325", name: "Economics 3B Applied", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP322", name: "Macroeconomics 3B", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKRP321", name: "Risk Management 3B", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
    ],
  },
  {
    id: "nwu-bcom-economics-international-trade",
    name: "Bachelor of Commerce in Economic Sciences with Economics and International Trade",
    qualificationCode: "5FK-H01-E301P-FT / 5FK-H01-E301V-FT",
    faculty: "Economic and Management Sciences",
    campuses: ["Potchefstroom", "Vanderbijlpark"],
    durationYears: 3,
    source: "curated",
    sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
    sourceDocument:
      "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
    modules: [
      { code: "ACCS111/ACCF111", name: "Accounting 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN111", name: "Business Management 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "CMPG112", name: "Computing 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON112", name: "Economics 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "MTHS112", name: "Mathematics 1A", credits: null, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACCS121/ACCF121", name: "Accounting 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ALDA/E122", name: "Academic Literacy 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN121", name: "Business Management 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON122", name: "Economics 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "STTN122", name: "Statistics 1B", credits: null, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAR213", name: "Marketing Management 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON211", name: "Economics 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP212", name: "Macroeconomics 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKRP211", name: "International Trade 2A", credits: null, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN221", name: "Business Management 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON221", name: "Economics 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP222", name: "Macroeconomics 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKRP221", name: "International Trade 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "CMPG222", name: "Computing 2B", credits: null, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN311", name: "Business Management 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON313", name: "Economics 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON314", name: "Economics 3A Advanced", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP312", name: "Macroeconomics 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "WVES312", name: "Understanding the World 3A", credits: null, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN321", name: "Business Management 3B", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON322", name: "Economics 3B", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON325", name: "Economics 3B Applied", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP322", name: "Macroeconomics 3B", credits: null, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
    ],
  },
  {
    id: "nwu-bcom-economics-international-trade-extended",
    name: "Bachelor of Commerce in Economic Sciences with Economics and International Trade (Extended Programme)",
    qualificationCode: "5XK-H01-E301V-EX",
    faculty: "Economic and Management Sciences",
    campuses: ["Vanderbijlpark"],
    durationYears: 4,
    source: "curated",
    sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
    sourceDocument:
      "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
    modules: [
      { code: "ACFS111", name: "Financial Accounting (Special): Basic Concepts, Accounting Cycle and Accounting Systems", credits: 16, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ALDA/E111", name: "Academic Literacy Development", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN111", name: "Introduction to Business Management", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON112", name: "Basic Micro-economics", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "MTHS119", name: "Foundation Mathematics 1", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACFS121", name: "Financial Accounting (Special): Bank Reconciliation, Elementary Financial Reporting and Analysis and Interpretation", credits: 16, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ALDA/E122", name: "Academic Literacy Development", credits: 12, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN121", name: "Business Management 1B", credits: 12, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON122", name: "Basic Macro-economics", credits: 12, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "MTHS129", name: "Foundation Mathematics 2", credits: 12, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAR213", name: "Introduction to Marketing Management", credits: 16, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "CMPG112", name: "Introduction to End User Computing", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ICOM111", name: "Introduction to Communication", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ICAT111", name: "Introduction to Critical and Analytical Thinking", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "STTF112", name: "Foundation Statistics I", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN221", name: "Purchasing Management and Supply Chain", credits: 16, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECAT121", name: "Extension of Critical and Analytical Thinking", credits: 12, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "CMPG222", name: "Data Analysis", credits: 8, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "STTF122", name: "STTF122", credits: 12, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "MTHS123", name: "MTHS123", credits: 12, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON211", name: "Macro-economics", credits: 16, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP212", name: "International Trade Relations", credits: 16, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKRP211", name: "Introduction to Risk Management", credits: 16, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "WVES312", name: "Understanding the World of Business Ethics", credits: 12, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON221", name: "Micro-economics", credits: 16, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP222", name: "International Trade Practice", credits: 16, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKRP221", name: "Investment Management", credits: 16, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "WVES222", name: "Understanding the World of Economic and Management Science", credits: 12, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN311", name: "Financial Management", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON313", name: "Monetary Economics", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON314", name: "Public Economics", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP312", name: "International Cargo Movement", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN321", name: "Strategic Management", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON322", name: "Development Economics", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON325", name: "Econometrics", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP322", name: "International Trade Analysis", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
    ],
  },
  {
    id: "nwu-bcom-economics-risk-management-extended",
    name: "Bachelor of Commerce in Economic Sciences with Economics and Risk Management (Extended Programme)",
    qualificationCode: "5XK-H05-E301V-EX",
    faculty: "Economic and Management Sciences",
    campuses: ["Vanderbijlpark"],
    durationYears: 4,
    source: "curated",
    sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
    sourceDocument:
      "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
    modules: [
      { code: "ACFS111", name: "Financial Accounting (Special): Basic Concepts, Accounting Cycle and Accounting Systems", credits: 16, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ALDA/E111", name: "Academic Literacy Development", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "BMAN111", name: "Introduction to Business Management", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON112", name: "Basic Micro-economics", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ICOM111", name: "Introduction to Communication", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "MTHS119", name: "Foundation Mathematics 1", credits: 12, semester: 1, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACFS121", name: "Financial Accounting (Special): Bank Reconciliation, Elementary Financial Reporting and Analysis and Interpretation", credits: 16, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ALDA/E122", name: "Academic Literacy Development", credits: 12, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON122", name: "Basic Macro-economics", credits: 12, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "MTHS129", name: "Foundation Mathematics 2", credits: 12, semester: 2, yearOfStudy: 1, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ACCF111", name: "Accounting 1A", credits: 16, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ICAT111", name: "Introduction to Critical and Analytical Thinking", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "CMPG112", name: "Introduction to End User Computing", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "MTHS112", name: "Mathematics 1A", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "STTF112", name: "Foundation Statistics I", credits: 12, semester: 1, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACCF121", name: "Accounting 1B", credits: 16, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "BMAN121", name: "Business Management 1B", credits: 12, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECAT121", name: "Extension of Critical and Analytical Thinking", credits: 12, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "STTF122", name: "STTF122", credits: 12, semester: 2, yearOfStudy: 2, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ACCF211", name: "Financial Accounting: Financial Reporting", credits: 16, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON211", name: "Macro-economics", credits: 16, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP212", name: "International Trade Relations", credits: 16, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKRP211", name: "Introduction to Risk Management", credits: 16, semester: 1, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ACCF221", name: "Financial Accounting: Special Topics and Elementary Group Statements", credits: 16, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP222", name: "International Trade Practice", credits: 16, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKRP221", name: "Investment Management", credits: 16, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON221", name: "Micro-economics", credits: 16, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "CMPG222", name: "Data Analysis", credits: 8, semester: 2, yearOfStudy: 3, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON313", name: "Monetary Economics", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON314", name: "Public Economics", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKIP312", name: "International Cargo Movement", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "EKRP311", name: "Bank Risk Management", credits: 16, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "WVES312", name: "Understanding the World of Business Ethics", credits: 12, semester: 1, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 1" },
      { code: "ECON322", name: "Development Economics", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "ECON325", name: "Econometrics", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKIP322", name: "International Trade Analysis", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
      { code: "EKRP321", name: "Financial Markets", credits: 16, semester: 2, yearOfStudy: 4, isCore: true, durationType: "semester", durationLabel: "Semester 2" },
    ],
  },
];

function dedupeStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean)));
}

function normalizeInstitutionName(value: string | null | undefined) {
  const name = (value ?? "").trim();
  return NWU_LOOKUP_NAMES.has(name) ? "North-West University" : name;
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function sanitizeQualificationCode(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function cleanCourseName(value: string | null | undefined) {
  let name = normalizeWhitespace(value);
  if (!name) return "";
  name = name.replace(/^Programme\s*-\s*/i, "");
  name = name.replace(/^Compilation Of Curriculum:\s*/i, "");
  name = name.replace(/^Compilation Of The\s+/i, "");
  name = name.replace(/^Compilation Of Programme\s*/i, "");
  name = name.replace(/^Compilation Of Programmes\s*/i, "");
  name = name.replace(LEADING_DOTTED_CODE_PATTERN, "").trim();
  name = stripLeadingCodeTokens(name);
  name = name.replace(TRAILING_TRANSLATION_PATTERN, "");
  name = name.replace(/\s+Baccalaureus.+$/i, "");
  name = name.replace(/\(This programme.+$/i, "").trim();
  name = name.replace(/\(This qualification.+$/i, "").trim();
  name = name.replace(/\((?:Hierdie|This) programme.+$/i, "").trim();
  name = name.replace(/\(([0-9A-Z][^)]+)\)$/i, "").trim();
  name = name.replace(/\s+Rules For The Compilation Of Programme.*$/i, "").trim();
  name = name.replace(/\s+Rules For The Compilation Of Programmes.*$/i, "").trim();
  name = name.replace(TRAILING_QUALIFIER_PATTERN, "").trim();
  name = name.replace(/\s*\/\s*$/, "").trim();
  name = name.replace(/\s{2,}/g, " ");
  return name;
}

function normalizeCourseKey(value: string | null | undefined) {
  return cleanCourseName(value).toLowerCase();
}

function titleCasePreservingAcronyms(value: string) {
  return value
    .split(/\s+/)
    .map((token) => {
      if (!token) return token;
      if (token === token.toUpperCase() && token.length <= 5) return token;
      return token[0]?.toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
}

function tokenizeWords(value: string | null | undefined) {
  return normalizeWhitespace(value)
    .split(/\s+/)
    .map((token) => token.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, ""))
    .filter(Boolean);
}

function isCodeLikeToken(value: string) {
  const token = value.replace(/^[^A-Za-z0-9.]+|[^A-Za-z0-9.]+$/g, "");
  if (!token) return false;
  if (/^[A-Z]{2,5}\.\d+(?:\.\d+)*$/i.test(token)) return true;
  if (!/\d/.test(token)) return false;
  if (/^[A-Z0-9\-\/]+$/i.test(token)) return true;
  return /^[0-9][A-Z0-9]{1,6}$/i.test(token) || /^[A-Z]{1,4}\d{2,4}[A-Z]?$/i.test(token);
}

function stripLeadingCodeTokens(value: string) {
  const tokens = tokenizeWords(value);
  if (tokens.length === 0) return "";
  let index = 0;
  while (index < tokens.length && isCodeLikeToken(tokens[index] ?? "")) {
    index += 1;
  }
  return tokens.slice(index).join(" ");
}

function hasQualificationPrefix(value: string | null | undefined) {
  const lowered = normalizeWhitespace(value).toLowerCase();
  return /^(bachelor|diploma|higher certificate|advanced diploma|certificate|llb|pgce|bed|beng)\b/.test(lowered);
}

function isIncompleteQualificationName(value: string | null | undefined) {
  const words = tokenizeWords(value);
  if (words.length === 0) return true;
  const lastWord = words[words.length - 1]?.toLowerCase() ?? "";
  if (["and", "with", "in", "of", "for", "local", "organisational", "public"].includes(lastWord)) {
    return true;
  }
  return /\b(with|and|in|of|for)\s+[A-Za-z]+$/i.test(normalizeWhitespace(value));
}

function mergeQualificationWithProgrammeTitle(
  qualificationName: string | null | undefined,
  programmeTitle: string | null | undefined,
) {
  const base = tokenizeWords(qualificationName);
  const detail = tokenizeWords(programmeTitle);
  if (base.length === 0 || detail.length === 0) return sanitizeQualificationDisplayName(qualificationName);
  if (base.join(" ").toLowerCase().includes(detail.join(" ").toLowerCase())) {
    return titleCasePreservingAcronyms(base.join(" "));
  }

  let overlap = 0;
  const maxOverlap = Math.min(base.length, detail.length);
  for (let size = maxOverlap; size >= 1; size -= 1) {
    const left = base.slice(base.length - size).map((token) => token.toLowerCase());
    const right = detail.slice(0, size).map((token) => token.toLowerCase());
    if (left.join(" ") === right.join(" ")) {
      overlap = size;
      break;
    }
  }

  const merged = [...base, ...detail.slice(overlap)].join(" ");
  return titleCasePreservingAcronyms(merged);
}

function scoreDisplayName(candidate: string | null | undefined, references: Array<string | null | undefined>) {
  const normalizedCandidate = sanitizeQualificationDisplayName(candidate);
  if (!normalizedCandidate) return -999;
  if (INVALID_DISPLAY_NAME_PATTERNS.some((pattern) => pattern.test(normalizedCandidate))) return -999;
  const candidateWords = new Set(tokenizeWords(normalizedCandidate).map((token) => token.toLowerCase()));
  const referenceWords = new Set(
    references.flatMap((reference) => tokenizeWords(reference).map((token) => token.toLowerCase()))
  );
  let overlap = 0;
  for (const word of candidateWords) {
    if (referenceWords.has(word)) overlap += 1;
  }
  return (
    overlap * 3 +
    (hasQualificationPrefix(normalizedCandidate) ? 6 : 0) +
    (isIncompleteQualificationName(normalizedCandidate) ? -5 : 0) +
    Math.min(candidateWords.size, 8)
  );
}

function pickBestDisplayName(
  course: Pick<YearbookCourseCatalog, "name">,
  override?: RawNwuProgramOverride,
) {
  const normalizedOverrideName = sanitizeQualificationDisplayName(override?.qualificationName);
  const mergedOverrideName =
    normalizedOverrideName && isIncompleteQualificationName(normalizedOverrideName)
      ? mergeQualificationWithProgrammeTitle(normalizedOverrideName, override?.programmeTitle)
      : normalizedOverrideName;
  const normalizedRawName = sanitizeQualificationDisplayName(course.name);
  const derivedOverrideName = deriveQualificationNameFromProgrammeTitle(override?.programmeTitle);
  const derivedRawName = deriveQualificationNameFromProgrammeTitle(course.name);

  const candidates = [
    mergedOverrideName,
    normalizedOverrideName,
    normalizedRawName,
    derivedOverrideName,
    derivedRawName,
  ]
    .map((candidate) => sanitizeQualificationDisplayName(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  if (candidates.length === 0) return null;

  const references = [override?.programmeTitle ?? null, course.name];
  return candidates
    .map((candidate) => ({ candidate, score: scoreDisplayName(candidate, references) }))
    .sort((left, right) => right.score - left.score || right.candidate.length - left.candidate.length)[0]?.candidate ?? null;
}

function sanitizeQualificationDisplayName(value: string | null | undefined) {
  let name = normalizeWhitespace(value);
  if (!name) return null;
  name = name.replace(LEADING_DOTTED_CODE_PATTERN, "").trim();
  name = stripLeadingCodeTokens(name);
  name = name.replace(LEADING_RULE_PREFIX_PATTERN, "").trim();
  name = name.replace(LEADING_SAQA_PATTERN, "").trim();
  name = name.replace(/^Rules For The Degree\s+/i, "");
  name = name.replace(/^Rules For The\s+/i, "");
  name = name.replace(TRAILING_TRANSLATION_PATTERN, "");
  name = name.replace(/\s+Baccalaureus.+$/i, "");
  name = name.replace(/\(This programme.+$/i, "").trim();
  name = name.replace(/\((?:Hierdie|This) programme.+$/i, "").trim();
  name = name.replace(/\(Phasing out\)/i, "").trim();
  name = name.replace(/\(Extended Programme\)/i, "(Extended Programme)").trim();
  name = name.replace(/\s{2,}/g, " ").trim();
  if (!name) return null;
  if (INVALID_DISPLAY_NAME_PATTERNS.some((pattern) => pattern.test(name))) return null;
  return titleCasePreservingAcronyms(name);
}

function deriveQualificationNameFromProgrammeTitle(value: string | null | undefined) {
  let name = normalizeWhitespace(value);
  if (!name) return null;
  name = name.replace(/^Programme\s*-\s*/i, "");
  name = name.replace(/^Compilation Of The\s+/i, "");
  name = name.replace(/^Compilation Of Programme\s*/i, "");
  name = name.replace(/^Compilation Of Programmes\s*/i, "");
  name = name.replace(LEADING_DOTTED_CODE_PATTERN, "").trim();
  name = name.replace(LEADING_PROGRAMME_CODE_PATTERN, "").trim();
  name = stripLeadingCodeTokens(name);
  name = name.replace(PROGRAMME_TITLE_CODE_SUFFIX_PATTERN, "").trim();
  name = name.replace(TRAILING_CODE_BLOCK_PATTERN, "").trim();
  name = name.replace(TRAILING_TRANSLATION_PATTERN, "").trim();
  name = name.replace(/\s+Baccalaureus.+$/i, "").trim();
  name = name.replace(/\((?:This|Hierdie).+$/i, "").trim();
  name = name.replace(/\s{2,}/g, " ").trim();
  if (!name || INVALID_DISPLAY_NAME_PATTERNS.some((pattern) => pattern.test(name))) return null;
  if (/^[A-Z0-9-]+$/i.test(name)) return null;
  if (name.split(/\s+/).length === 1 && /\d/.test(name)) return null;
  return titleCasePreservingAcronyms(name);
}

function mergeQualificationCode(primary: string | null, fallback: string | null) {
  const first = sanitizeQualificationCode(primary);
  const second = sanitizeQualificationCode(fallback);
  return first || second;
}

function buildOverrideScore(entry: RawNwuProgramOverride) {
  return (
    (entry.qualificationName ? 3 : 0) +
    (entry.qualificationCode ? 2 : 0) +
    ((entry.campuses?.length ?? 0) > 0 ? 1 : 0)
  );
}

function pickBetterOverride(current: RawNwuProgramOverride | undefined, next: RawNwuProgramOverride) {
  if (!current) return next;
  return buildOverrideScore(next) > buildOverrideScore(current) ? next : current;
}

function buildCourseIdentity(course: Pick<YearbookCourseCatalog, "faculty" | "name" | "qualificationCode">) {
  const faculty = normalizeWhitespace(course.faculty).toLowerCase();
  const programmeKey = baseProgrammeKey(course.name);
  if (faculty && programmeKey) {
    return `${faculty}|${programmeKey}|${isExtendedProgrammeName(course.name) ? "extended" : "standard"}`;
  }
  const tokens = qualificationCodeTokens(course.qualificationCode);
  if (tokens.length > 0) {
    return `${faculty}|${tokens.sort().join("|")}`;
  }
  return `${faculty}|${normalizeCourseKey(course.name)}`.toLowerCase();
}

function qualificationCodeTokens(value: string | null | undefined) {
  const normalized = sanitizeQualificationCode(value);
  if (!normalized) return [];
  const tokens = normalized.match(new RegExp(QUALIFICATION_CODE_PATTERN.source, "gi")) ?? [];
  return Array.from(new Set(tokens.map((token) => token.toUpperCase())));
}

function qualificationCodesOverlap(left: string | null | undefined, right: string | null | undefined) {
  const leftTokens = qualificationCodeTokens(left);
  const rightTokens = new Set(qualificationCodeTokens(right));
  if (leftTokens.length === 0 || rightTokens.size === 0) return false;
  return leftTokens.some((token) => rightTokens.has(token));
}

function isExtendedProgrammeName(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value);
  return /\bextended programme\b/i.test(normalized) || /\b-EX\b/i.test(normalized);
}

function baseProgrammeKey(value: string | null | undefined) {
  return normalizeCourseKey(
    normalizeWhitespace(value)
      .replace(/\(extended programme\)/gi, "")
      .replace(/\bextended programme\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function isExcludedCourseName(name: string) {
  const original = normalizeWhitespace(name);
  const normalized = cleanCourseName(name);
  if (GENERIC_EXCLUDED_COURSE_PATTERNS.some((pattern) => pattern.test(original))) return true;
  if (!normalized) return true;
  if (GENERIC_EXCLUDED_COURSE_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (/^[0-9A-Z/ .()-]+$/.test(normalized)) return true;
  return false;
}

function normalizeDurationType(
  semester: number | null | undefined,
  durationType: string | null | undefined,
  durationLabel: string | null | undefined,
  code: string,
  name: string,
) {
  const loweredType = (durationType ?? "").toLowerCase();
  const loweredLabel = (durationLabel ?? "").toLowerCase();
  if (loweredType === "year") return { durationType: "year" as const, durationLabel: "Year module", semester: null };
  if (loweredLabel.includes("year")) return { durationType: "year" as const, durationLabel: "Year module", semester: null };
  if (semester === 1 || semester === 2) {
    return { durationType: "semester" as const, durationLabel: `Semester ${semester}`, semester };
  }
  if (loweredLabel.includes("semester 1")) {
    return { durationType: "semester" as const, durationLabel: "Semester 1", semester: 1 };
  }
  if (loweredLabel.includes("semester 2")) {
    return { durationType: "semester" as const, durationLabel: "Semester 2", semester: 2 };
  }
  if (/\b(?:AB|YR|J)\b/i.test(name) || /\d7[2-9][A-Z]?$/i.test(code)) {
    return { durationType: "year" as const, durationLabel: "Year module", semester: null };
  }
  return { durationType: null, durationLabel: null, semester: semester ?? null };
}

function cleanModuleName(value: string | null | undefined, code: string, credits: number | null) {
  let name = normalizeWhitespace(value) || code;
  name = name.replace(/\s*\/\s*Baccalaureus.+$/i, "");
  name = name.replace(TRAILING_QUALIFIER_PATTERN, "").trim();
  name = name.replace(/\bPASS\s*\/\s*SLAAG:?\s*$/i, "").trim();
  name = name.replace(/\bNQF\s+Level:?\s*\d+\b/gi, "").trim();
  name = name.replace(/^\(Degree\)\s*/i, "").trim();
  if (credits !== null) {
    const match = name.match(TRAILING_CREDITS_PATTERN);
    if (match && Number(match[1]) === credits) {
      name = name.replace(TRAILING_CREDITS_PATTERN, "").trim();
    }
  }
  const trailingNumberMatch = name.match(/\s+(\d{1,3})$/);
  if (trailingNumberMatch) {
    const trailingValue = Number.parseInt(trailingNumberMatch[1] ?? "", 10);
    if (Number.isFinite(trailingValue) && trailingValue >= 8) {
      name = name.replace(/\s+\d{1,3}$/, "").trim();
    }
  }
  name = name.replace(/\s{2,}/g, " ").trim();
  return name || code;
}

function isWeakModuleName(value: string | null | undefined, code: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return true;
  if (normalized === "/" || normalized === "-") return true;
  if (normalized.toUpperCase() === code.toUpperCase()) return true;
  if (/^semester\s+[12]\b/i.test(normalized)) return true;
  if (/^year module$/i.test(normalized)) return true;
  if (/nqf\s+level/i.test(normalized)) return true;
  if (/pass\s*\/\s*slaag/i.test(normalized)) return true;
  if (/te neem,\s*laasgenoemde/i.test(normalized)) return true;
  if (/^\(degree\)/i.test(normalized)) return true;
  return false;
}

function scoreModuleName(value: string, code: string) {
  const cleaned = cleanModuleName(value, code, null);
  if (isWeakModuleName(cleaned, code)) return -1000;
  let score = cleaned.length;
  if (cleaned !== code) score += 25;
  if (!/\bsemester\b/i.test(cleaned)) score += 10;
  if (!/\bmodule\b/i.test(cleaned)) score += 5;
  if (!/\bpass\b|\bslaag\b/i.test(cleaned)) score += 10;
  return score;
}

function normalizeCredits(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 64) return null;
  return Math.round(value);
}

function normalizeCampuses(values: Array<string | null | undefined>) {
  return dedupeStrings(
    values.flatMap((value) => {
      const lowered = (value ?? "").toLowerCase();
      if (!lowered) return [];
      if (lowered.includes("mafikeng") || lowered.includes("mahikeng")) return ["Mahikeng"];
      if (lowered.includes("potchefstroom")) return ["Potchefstroom"];
      if (lowered.includes("vanderbijlpark")) return ["Vanderbijlpark"];
      return [normalizeWhitespace(value)];
    })
  );
}

function inferYearAndSemesterFromCode(code: string) {
  const match = code.match(/(\d)(\d)(\d)[A-Z]?$/i);
  if (!match) return { yearOfStudy: null, semester: null, durationType: null as "semester" | "year" | null };
  const yearOfStudy = Number(match[1]);
  const periodMarker = match[2];
  if (![1, 2, 3, 4].includes(yearOfStudy)) {
    return { yearOfStudy: null, semester: null, durationType: null as "semester" | "year" | null };
  }
  if (periodMarker === "1") return { yearOfStudy, semester: 1, durationType: "semester" as const };
  if (periodMarker === "2") return { yearOfStudy, semester: 2, durationType: "semester" as const };
  if (periodMarker === "7" || periodMarker === "8" || periodMarker === "9") {
    return { yearOfStudy, semester: null, durationType: "year" as const };
  }
  return { yearOfStudy, semester: null, durationType: null as "semester" | "year" | null };
}

function normalizeModule(rawModule: RawNwuModule): YearbookCourseModule | null {
  const code = normalizeWhitespace(rawModule.code)?.toUpperCase() ?? "";
  if (!code) return null;
  const credits = normalizeCredits(rawModule.credits);
  const inferred = inferYearAndSemesterFromCode(code);
  const explicitYearOfStudy = typeof rawModule.yearOfStudy === "number" && rawModule.yearOfStudy > 0 ? Math.round(rawModule.yearOfStudy) : null;
  const yearOfStudy = inferred.yearOfStudy ?? explicitYearOfStudy;
  if (!yearOfStudy) return null;

  const duration = normalizeDurationType(
    inferred.semester ?? (typeof rawModule.semester === "number" ? Math.round(rawModule.semester) : null),
    rawModule.durationType ?? null,
    rawModule.durationLabel ?? null,
    code,
    normalizeWhitespace(rawModule.name) || code,
  );

  return {
    code,
    name: cleanModuleName(rawModule.name, code, credits),
    credits,
    semester: duration.semester,
    yearOfStudy,
    isCore: typeof rawModule.isCore === "boolean" ? rawModule.isCore : null,
    durationType: duration.durationType,
    durationLabel: duration.durationLabel,
  };
}

function dedupeModules(modules: YearbookCourseModule[]) {
  const seen = new Map<string, YearbookCourseModule>();
  for (const mod of modules) {
    const key = `${mod.code}|${mod.yearOfStudy}|${mod.semester ?? "x"}`;
    const current = seen.get(key);
    if (!current) {
      seen.set(key, mod);
      continue;
    }
    seen.set(key, {
      ...current,
      name: current.name.length >= mod.name.length ? current.name : mod.name,
      credits: current.credits ?? mod.credits ?? null,
      isCore: current.isCore ?? mod.isCore ?? null,
      durationType: current.durationType ?? mod.durationType ?? null,
      durationLabel: current.durationLabel ?? mod.durationLabel ?? null,
    });
  }
  return Array.from(seen.values()).sort((left, right) => {
    if (left.yearOfStudy !== right.yearOfStudy) return left.yearOfStudy - right.yearOfStudy;
    if ((left.semester ?? 9) !== (right.semester ?? 9)) return (left.semester ?? 9) - (right.semester ?? 9);
    return left.code.localeCompare(right.code);
  });
}

type ModuleMetadataIndexEntry = {
  bestName: string | null;
  bestNameScore: number;
  creditValues: Set<number>;
  isCoreValues: Set<boolean>;
  durationTypes: Set<"semester" | "year">;
  durationLabels: Set<string>;
  semesterValues: Set<1 | 2>;
};

function createModuleMetadataIndex(courses: YearbookCourseCatalog[]) {
  const index = new Map<string, ModuleMetadataIndexEntry>();

  for (const course of courses) {
    for (const mod of course.modules ?? []) {
      const cleanedName = cleanModuleName(mod.name, mod.code, mod.credits ?? null);
      const nameScore = scoreModuleName(cleanedName, mod.code);
      for (const token of moduleCodeTokens(mod.code)) {
        const current = index.get(token) ?? {
          bestName: null,
          bestNameScore: -1000,
          creditValues: new Set<number>(),
          isCoreValues: new Set<boolean>(),
          durationTypes: new Set<"semester" | "year">(),
          durationLabels: new Set<string>(),
          semesterValues: new Set<1 | 2>(),
        };

        if (nameScore > current.bestNameScore) {
          current.bestName = cleanedName;
          current.bestNameScore = nameScore;
        }
        if (typeof mod.credits === "number") current.creditValues.add(mod.credits);
        if (typeof mod.isCore === "boolean") current.isCoreValues.add(mod.isCore);
        if (mod.durationType === "semester" || mod.durationType === "year") current.durationTypes.add(mod.durationType);
        if (mod.durationLabel) current.durationLabels.add(mod.durationLabel);
        if (mod.semester === 1 || mod.semester === 2) current.semesterValues.add(mod.semester);

        index.set(token, current);
      }
    }
  }

  return index;
}

function resolveSingleValue<T>(values: Set<T>) {
  if (values.size !== 1) return null;
  return Array.from(values)[0] ?? null;
}

function resolveModuleMetadata(
  code: string,
  index: Map<string, ModuleMetadataIndexEntry>,
) {
  const entries = moduleCodeTokens(code)
    .map((token) => index.get(token))
    .filter((entry): entry is ModuleMetadataIndexEntry => Boolean(entry));

  if (entries.length === 0) {
    return {
      name: null as string | null,
      credits: null as number | null,
      isCore: null as boolean | null,
      durationType: null as "semester" | "year" | null,
      durationLabel: null as string | null,
      semester: null as 1 | 2 | null,
    };
  }

  let bestName: string | null = null;
  let bestNameScore = -1000;
  const creditValues = new Set<number>();
  const isCoreValues = new Set<boolean>();
  const durationTypes = new Set<"semester" | "year">();
  const durationLabels = new Set<string>();
  const semesterValues = new Set<1 | 2>();

  for (const entry of entries) {
    if (entry.bestName && entry.bestNameScore > bestNameScore) {
      bestName = entry.bestName;
      bestNameScore = entry.bestNameScore;
    }
    for (const value of entry.creditValues) creditValues.add(value);
    for (const value of entry.isCoreValues) isCoreValues.add(value);
    for (const value of entry.durationTypes) durationTypes.add(value);
    for (const value of entry.durationLabels) durationLabels.add(value);
    for (const value of entry.semesterValues) semesterValues.add(value);
  }

  return {
    name: NWU_MODULE_NAME_OVERRIDES[normalizeWhitespace(code).toUpperCase()] ?? bestName,
    credits: resolveSingleValue(creditValues),
    isCore: resolveSingleValue(isCoreValues),
    durationType: resolveSingleValue(durationTypes),
    durationLabel: resolveSingleValue(durationLabels),
    semester: resolveSingleValue(semesterValues),
  };
}

function enrichCourseCatalogModules(courses: YearbookCourseCatalog[]) {
  const metadataIndex = createModuleMetadataIndex(courses);
  return courses.map((course) => ({
    ...course,
    modules: dedupeModules(
      course.modules.map((module) => {
        const metadata = resolveModuleMetadata(module.code, metadataIndex);
        const cleanedName = cleanModuleName(module.name, module.code, module.credits ?? null);
        return {
          ...module,
          name:
            isWeakModuleName(cleanedName, module.code) && metadata.name
              ? metadata.name
              : cleanedName || metadata.name || module.code,
          credits: module.credits ?? metadata.credits ?? null,
          isCore: module.isCore ?? metadata.isCore ?? null,
          durationType: module.durationType ?? metadata.durationType ?? null,
          durationLabel: module.durationLabel ?? metadata.durationLabel ?? null,
          semester: module.semester ?? metadata.semester ?? null,
        };
      })
    ),
  }));
}

function moduleCodeTokens(code: string | null | undefined) {
  return Array.from(
    new Set(
      normalizeWhitespace(code)
        .toUpperCase()
        .split(/[\/,]/)
        .map((token) => token.trim())
        .filter(Boolean)
    )
  );
}

function modulesMatch(left: Pick<YearbookCourseModule, "code" | "yearOfStudy" | "semester">, right: Pick<YearbookCourseModule, "code" | "yearOfStudy" | "semester">) {
  if (left.yearOfStudy !== right.yearOfStudy) return false;
  if ((left.semester ?? null) !== (right.semester ?? null)) return false;
  const rightTokens = new Set(moduleCodeTokens(right.code));
  return moduleCodeTokens(left.code).some((token) => rightTokens.has(token));
}

function enrichModules(authoritativeModules: YearbookCourseModule[], fallbackModules: YearbookCourseModule[]) {
  return dedupeModules(
    authoritativeModules.map((module) => {
      const match = fallbackModules.find((candidate) => modulesMatch(module, candidate));
      if (!match) return module;
      return {
        ...module,
        name: module.name === module.code && match.name !== match.code ? match.name : module.name,
        credits: module.credits ?? match.credits ?? null,
        isCore: module.isCore ?? match.isCore ?? null,
        durationType: module.durationType ?? match.durationType ?? null,
        durationLabel: module.durationLabel ?? match.durationLabel ?? null,
      };
    })
  );
}

function normalizeGeneratedCourse(rawCourse: RawNwuCourse): YearbookCourseCatalog | null {
  let faculty = normalizeWhitespace(rawCourse.faculty);
  const originalName = normalizeWhitespace(rawCourse.name);
  const rawName = cleanCourseName(rawCourse.name);
  const qualificationCode = sanitizeQualificationCode(rawCourse.qualificationCode);
  if (!faculty || isExcludedCourseName(originalName || rawName)) return null;
  if (!qualificationCode && !hasQualificationPrefix(rawName)) return null;

  // NWU qualification codes starting with "1[A-Z]" (e.g. 1GG, 1GR) belong to
  // Humanities. The PDF extractor occasionally misattributes these to Health Sciences.
  if (faculty === "Health Sciences" && /^1[A-Z]/i.test(qualificationCode ?? "")) {
    faculty = "Humanities";
  }

  const modules = dedupeModules((rawCourse.modules ?? []).map(normalizeModule).filter(Boolean) as YearbookCourseModule[]);
  if (modules.length < 4) return null;

  const campuses = normalizeCampuses(rawCourse.campuses ?? []);
  const durationYears = typeof rawCourse.durationYears === "number" && rawCourse.durationYears > 0
    ? Math.round(rawCourse.durationYears)
    : Math.max(...modules.map((module) => module.yearOfStudy), 1);
  const displayName = sanitizeQualificationDisplayName(originalName) ?? titleCasePreservingAcronyms(rawName);

  return {
    id: normalizeWhitespace(rawCourse.id) || `${faculty.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: displayName,
    qualificationCode,
    faculty,
    campuses,
    durationYears,
    source: "yearbook",
    sourceLabel: normalizeWhitespace(rawCourse.sourceLabel) || "NWU Undergraduate Yearbooks 2026",
    sourceDocument: normalizeWhitespace(rawCourse.sourceDocument) || null,
    modules,
  };
}

const NWU_PROGRAM_OVERRIDE_MAP = (rawNwuProgramOverrides as RawNwuProgramOverride[]).reduce<Map<string, RawNwuProgramOverride>>(
  (map, entry) => {
    const faculty = normalizeWhitespace(entry.faculty);
    const programmeTitle = normalizeCourseKey(entry.programmeTitle);
    if (!faculty || !programmeTitle) return map;
    const key = `${faculty.toLowerCase()}|${programmeTitle}`;
    map.set(key, pickBetterOverride(map.get(key), entry));
    return map;
  },
  new Map()
);

const NWU_PROGRAM_OVERRIDES_BY_FACULTY = (rawNwuProgramOverrides as RawNwuProgramOverride[]).reduce<Map<string, RawNwuProgramOverride[]>>(
  (map, entry) => {
    const faculty = normalizeWhitespace(entry.faculty);
    if (!faculty) return map;
    const current = map.get(faculty.toLowerCase()) ?? [];
    current.push(entry);
    map.set(faculty.toLowerCase(), current);
    return map;
  },
  new Map()
);

function scoreOverrideCandidate(course: YearbookCourseCatalog, entry: RawNwuProgramOverride) {
  const courseKey = normalizeCourseKey(course.name);
  const titles = [
    normalizeCourseKey(entry.programmeTitle),
    normalizeCourseKey(entry.qualificationName),
    normalizeCourseKey(deriveQualificationNameFromProgrammeTitle(entry.programmeTitle)),
  ].filter(Boolean);

  let bestScore = -1;
  for (const title of titles) {
    if (!title) continue;
    const titleTokens = new Set(tokenizeWords(title).map((token) => token.toLowerCase()));
    const courseTokens = new Set(tokenizeWords(courseKey).map((token) => token.toLowerCase()));
    const sharedTokens = Array.from(titleTokens).filter((token) => courseTokens.has(token)).length;
    const contains = courseKey.includes(title) || title.includes(courseKey);
    if (!contains && sharedTokens < 2) continue;
    const score =
      sharedTokens * 10 +
      Math.min(title.length, 80) +
      (contains ? 20 : 0) +
      (entry.qualificationCode ? 5 : 0) +
      ((entry.campuses?.length ?? 0) > 0 ? 3 : 0);
    if (score > bestScore) bestScore = score;
  }

  return bestScore;
}

function pickProgramOverride(course: YearbookCourseCatalog) {
  const overrideKey = `${course.faculty.toLowerCase()}|${normalizeCourseKey(course.name)}`;
  const exact = NWU_PROGRAM_OVERRIDE_MAP.get(overrideKey);
  if (exact) return exact;

  const candidates = NWU_PROGRAM_OVERRIDES_BY_FACULTY.get(course.faculty.toLowerCase()) ?? [];
  let best: RawNwuProgramOverride | undefined;
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = scoreOverrideCandidate(course, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return bestScore >= 25 ? best : undefined;
}

function applyProgramOverride(course: YearbookCourseCatalog): YearbookCourseCatalog | null {
  const override = pickProgramOverride(course);
  const rawFinalName = pickBestDisplayName(course, override);
  const finalName = rawFinalName ? titleCasePreservingAcronyms(cleanCourseName(rawFinalName)) : null;

  if (!finalName || INVALID_DISPLAY_NAME_PATTERNS.some((pattern) => pattern.test(finalName))) {
    return null;
  }

  const qualificationCode = mergeQualificationCode(override?.qualificationCode ?? null, course.qualificationCode ?? null);
  const campuses = dedupeStrings([
    ...(course.campuses ?? []),
    ...normalizeCampuses(override?.campuses ?? []),
  ]);

  return {
    ...course,
    name: finalName,
    qualificationCode,
    campuses,
    sourceDocument: normalizeWhitespace(override?.sourceDocument) || course.sourceDocument || null,
  };
}

function mergeCourses(baseCourses: YearbookCourseCatalog[], overrideCourses: YearbookCourseCatalog[]) {
  const courseMap = new Map<string, YearbookCourseCatalog>();

  for (const course of baseCourses) {
    const key = buildCourseIdentity(course);
    courseMap.set(key, course);
  }

  for (const overrideCourse of overrideCourses) {
    const key = buildCourseIdentity(overrideCourse);
    const existing = courseMap.get(key);
    if (!existing) {
      courseMap.set(key, overrideCourse);
      continue;
    }

    const exactQualificationMatch =
      sanitizeQualificationCode(existing.qualificationCode)?.toLowerCase() ===
      sanitizeQualificationCode(overrideCourse.qualificationCode)?.toLowerCase();
    const overlappingQualificationCodes = qualificationCodesOverlap(existing.qualificationCode, overrideCourse.qualificationCode);
    const sameBaseProgramme =
      baseProgrammeKey(existing.name) === baseProgrammeKey(overrideCourse.name) &&
      baseProgrammeKey(existing.name).length > 0;
    const sameProgrammeTrack = isExtendedProgrammeName(existing.name) === isExtendedProgrammeName(overrideCourse.name);
    const shouldReplaceWithCurated =
      overrideCourse.source === "curated" &&
      (exactQualificationMatch || (overlappingQualificationCodes && sameProgrammeTrack) || (sameBaseProgramme && sameProgrammeTrack));

    courseMap.set(key, {
      ...existing,
      ...overrideCourse,
      campuses: dedupeStrings([...(existing.campuses ?? []), ...(overrideCourse.campuses ?? [])]),
      modules:
        shouldReplaceWithCurated
          ? enrichModules([...(overrideCourse.modules ?? [])], [...(existing.modules ?? [])])
          : dedupeModules([...(existing.modules ?? []), ...(overrideCourse.modules ?? [])]),
      durationYears:
        shouldReplaceWithCurated
          ? overrideCourse.durationYears ?? existing.durationYears
          : overrideCourse.durationYears ?? existing.durationYears,
      source: overrideCourse.source,
      sourceLabel: overrideCourse.sourceLabel ?? existing.sourceLabel ?? null,
      sourceDocument: overrideCourse.sourceDocument ?? existing.sourceDocument ?? null,
    });
  }

  const normalizedCourseMap = Array.from(courseMap.values())
    .map(applyProgramOverride)
    .filter((course): course is YearbookCourseCatalog => Boolean(course))
    .reduce<Map<string, YearbookCourseCatalog>>((map, course) => {
      const identity = buildCourseIdentity(course);
      const current = map.get(identity);
      if (!current) {
        map.set(identity, course);
        return map;
      }
      const currentIsCurated = current.source === "curated";
      const incomingIsCurated = course.source === "curated";
      const exactQualificationMatch =
        sanitizeQualificationCode(current.qualificationCode)?.toLowerCase() ===
        sanitizeQualificationCode(course.qualificationCode)?.toLowerCase();
      const sameBaseProgramme =
        baseProgrammeKey(current.name) === baseProgrammeKey(course.name) &&
        baseProgrammeKey(current.name).length > 0;
      const sameProgrammeTrack = isExtendedProgrammeName(current.name) === isExtendedProgrammeName(course.name);
      const preferIncoming =
        (incomingIsCurated && !currentIsCurated) ||
        (incomingIsCurated &&
          currentIsCurated &&
          ((course.modules?.length ?? 0) > (current.modules?.length ?? 0) ||
            (course.durationYears ?? 0) > (current.durationYears ?? 0))) ||
        (!currentIsCurated &&
          !incomingIsCurated &&
          sameBaseProgramme &&
          sameProgrammeTrack &&
          (course.modules?.length ?? 0) > (current.modules?.length ?? 0));

      if ((currentIsCurated || incomingIsCurated) && sameBaseProgramme && sameProgrammeTrack && exactQualificationMatch) {
        map.set(identity, preferIncoming ? course : current);
        return map;
      }

      map.set(identity, {
        ...(preferIncoming ? course : current),
        campuses: dedupeStrings([...(current.campuses ?? []), ...(course.campuses ?? [])]),
        modules:
          currentIsCurated && !incomingIsCurated
            ? enrichModules([...(current.modules ?? [])], [...(course.modules ?? [])])
            : incomingIsCurated && !currentIsCurated
              ? enrichModules([...(course.modules ?? [])], [...(current.modules ?? [])])
              : dedupeModules([...(current.modules ?? []), ...(course.modules ?? [])]),
        source: preferIncoming ? course.source : current.source,
        sourceLabel: preferIncoming ? course.sourceLabel ?? current.sourceLabel ?? null : current.sourceLabel ?? course.sourceLabel ?? null,
        sourceDocument:
          preferIncoming ? course.sourceDocument ?? current.sourceDocument ?? null : current.sourceDocument ?? course.sourceDocument ?? null,
        qualificationCode:
          preferIncoming ? course.qualificationCode ?? current.qualificationCode ?? null : current.qualificationCode ?? course.qualificationCode ?? null,
        durationYears:
          preferIncoming
            ? course.durationYears ?? current.durationYears
            : current.durationYears ?? course.durationYears,
      });
      return map;
    }, new Map());

  return Array.from(normalizedCourseMap.values()).sort((left, right) => {
    if (left.faculty !== right.faculty) return left.faculty.localeCompare(right.faculty);
    return left.name.localeCompare(right.name);
  });
}

const NWU_GENERATED_PROFILE = rawNwuCatalog as RawNwuCatalog;
const NWU_BASE_GENERATED_COURSES = enrichCourseCatalogModules(
  (NWU_GENERATED_PROFILE.courses ?? []).map(normalizeGeneratedCourse).filter(Boolean) as YearbookCourseCatalog[]
);
const NWU_GENERATED_COURSES = enrichCourseCatalogModules(mergeCourses(NWU_BASE_GENERATED_COURSES, NWU_CURATED_OVERRIDES));
const NWU_GENERATED_FACULTIES = dedupeStrings([
  ...(NWU_GENERATED_PROFILE.faculties ?? []),
  ...NWU_GENERATED_COURSES.map((course) => course.faculty),
]).sort((left, right) => left.localeCompare(right));
const NWU_CAMPUSES = normalizeCampuses(NWU_GENERATED_PROFILE.campuses ?? ["Mahikeng", "Potchefstroom", "Vanderbijlpark"]);
const UJ_GENERATED_PROFILE = rawUjCatalog as RawNwuCatalog;
const UJ_GENERATED_COURSES = enrichCourseCatalogModules(
  (UJ_GENERATED_PROFILE.courses ?? [])
    .map(normalizeGeneratedCourse)
    .filter(Boolean) as YearbookCourseCatalog[]
);
const UJ_GENERATED_FACULTIES = dedupeStrings([
  ...(UJ_GENERATED_PROFILE.faculties ?? []),
  ...UJ_GENERATED_COURSES.map((course) => course.faculty),
]).sort((left, right) => left.localeCompare(right));
const UNIZULU_GENERATED_PROFILE = rawUnizuluCatalog as RawNwuCatalog;
const UNIZULU_FHSS_GENERATED_PROFILE = rawUnizuluFhssCatalog as RawNwuCatalog;
const UNIZULU_GENERATED_COURSES = enrichCourseCatalogModules(
  [...(UNIZULU_GENERATED_PROFILE.courses ?? []), ...(UNIZULU_FHSS_GENERATED_PROFILE.courses ?? [])]
    .map(normalizeGeneratedCourse)
    .filter(Boolean) as YearbookCourseCatalog[]
);
const UNIZULU_GENERATED_FACULTIES = dedupeStrings(
  [
    ...(UNIZULU_GENERATED_PROFILE.faculties ?? []),
    ...(UNIZULU_FHSS_GENERATED_PROFILE.faculties ?? []),
    ...UNIZULU_GENERATED_COURSES.map((course) => course.faculty),
  ].map((faculty) => (faculty === "Arts" ? "Humanities and Social Sciences" : faculty))
).sort((left, right) => left.localeCompare(right));
const UNIZULU_CAMPUSES = dedupeStrings([
  ...(UNIZULU_GENERATED_PROFILE.campuses ?? []),
  ...(UNIZULU_FHSS_GENERATED_PROFILE.campuses ?? []),
]);

function getFallbackCatalogPayload(institutionName: string): UniversityCatalogPayload {
  const profile = getUniversityAcademicProfile(institutionName);
  return {
    institutionName,
    academicPeriodType: profile?.academicPeriodType ?? "semester",
    academicUnitLabel: profile?.academicUnitLabel ?? "Faculty",
    campuses: [],
    faculties: profile?.faculties ?? [],
    courses: getCatalogCourses(institutionName),
    note: profile?.note ?? null,
  };
}

export function getUniversityCatalogPayload(
  institutionName: string | null | undefined,
  options?: { faculty?: string | null; campus?: string | null },
): UniversityCatalogPayload {
  const normalizedInstitution = normalizeInstitutionName(institutionName);
  if (!normalizedInstitution) {
    return {
      institutionName: "",
      academicPeriodType: "semester",
      academicUnitLabel: "Faculty",
      campuses: [],
      faculties: [],
      courses: [],
      note: null,
    };
  }

  if (normalizedInstitution === "North-West University") {
    const selectedFaculty = normalizeWhitespace(options?.faculty);
    const selectedCampus = normalizeWhitespace(options?.campus);
    const courses = !selectedFaculty
      ? []
      : NWU_GENERATED_COURSES.filter((course) => {
          if (course.faculty !== selectedFaculty) return false;
          if (selectedCampus && (course.campuses?.length ?? 0) > 0 && !course.campuses?.includes(selectedCampus)) return false;
          return true;
        });

    return {
      institutionName: normalizedInstitution,
      academicPeriodType: NWU_GENERATED_PROFILE.academicPeriodType ?? "semester",
      academicUnitLabel: NWU_GENERATED_PROFILE.academicUnitLabel ?? "Faculty",
      campuses: NWU_CAMPUSES,
      faculties: NWU_GENERATED_FACULTIES,
      courses,
      note: "Yearbook-backed NWU course and module plans are available across the three campuses. Review inferred modules before saving.",
    };
  }

  if (normalizedInstitution === "University of Johannesburg") {
    const selectedFaculty = normalizeWhitespace(options?.faculty);
    const courses = !selectedFaculty
      ? []
      : UJ_GENERATED_COURSES.filter((course) => course.faculty === selectedFaculty);

    return {
      institutionName: normalizedInstitution,
      academicPeriodType: UJ_GENERATED_PROFILE.academicPeriodType ?? "semester",
      academicUnitLabel: UJ_GENERATED_PROFILE.academicUnitLabel ?? "College",
      campuses: [],
      faculties: UJ_GENERATED_FACULTIES,
      courses,
      note: "Yearbook-backed UJ College of Business and Economics course plans are available. Other UJ faculties still use recognized academic-unit lists only.",
    };
  }

  if (normalizedInstitution === "University of Zululand") {
    const selectedFaculty = normalizeWhitespace(options?.faculty);
    const selectedCampus = normalizeWhitespace(options?.campus);
    const courses = !selectedFaculty
      ? []
      : UNIZULU_GENERATED_COURSES.filter((course) => {
          if (course.faculty === "Arts" && selectedFaculty === "Humanities and Social Sciences") return true;
          if (course.faculty !== selectedFaculty) return false;
          if (selectedCampus && (course.campuses?.length ?? 0) > 0 && !course.campuses?.includes(selectedCampus)) return false;
          return true;
        });

    return {
      institutionName: normalizedInstitution,
      academicPeriodType: UNIZULU_GENERATED_PROFILE.academicPeriodType ?? UNIZULU_FHSS_GENERATED_PROFILE.academicPeriodType ?? "semester",
      academicUnitLabel: UNIZULU_GENERATED_PROFILE.academicUnitLabel ?? UNIZULU_FHSS_GENERATED_PROFILE.academicUnitLabel ?? "Faculty",
      campuses: UNIZULU_CAMPUSES,
      faculties: UNIZULU_GENERATED_FACULTIES,
      courses,
      note:
        "Yearbook-backed University of Zululand course plans are available for Commerce, Administration and Law and Humanities and Social Sciences. Other UniZulu faculties still use recognized faculty lists only.",
    };
  }

  return getFallbackCatalogPayload(normalizedInstitution);
}
