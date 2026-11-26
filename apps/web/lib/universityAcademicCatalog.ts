import type { CalendarFormat } from "@/lib/academicPeriod";

export type UniversityAcademicUnitLabel = "Faculty" | "College" | "Faculty / College";

export type UniversityCourseModule = {
  code: string;
  name: string;
  semester: number | null;
  yearOfStudy: number;
  credits?: number | null;
  isCore?: boolean | null;
  durationType?: "semester" | "year" | null;
  durationLabel?: string | null;
};

export type UniversityCourseCatalog = {
  id: string;
  name: string;
  qualificationCode?: string | null;
  faculty: string;
  campuses?: string[];
  durationYears: number;
  source: "yearbook" | "curated";
  sourceLabel?: string | null;
  sourceDocument?: string | null;
  modules: UniversityCourseModule[];
};

export type UniversityAcademicProfile = {
  institutionName: string;
  academicPeriodType: CalendarFormat;
  academicUnitLabel?: UniversityAcademicUnitLabel;
  faculties: string[];
  courses: UniversityCourseCatalog[];
  note?: string | null;
};

const SEMESTER = "semester" as const;

function facultyProfile(
  institutionName: string,
  faculties: string[],
  courses: UniversityCourseCatalog[] = [],
  options?: {
    academicUnitLabel?: UniversityAcademicUnitLabel;
    note?: string | null;
    academicPeriodType?: CalendarFormat;
  }
): UniversityAcademicProfile {
  return {
    institutionName,
    academicPeriodType: options?.academicPeriodType ?? SEMESTER,
    academicUnitLabel: options?.academicUnitLabel,
    faculties,
    courses,
    note: options?.note ?? null,
  };
}

export const UNIVERSITY_ACADEMIC_PROFILES: UniversityAcademicProfile[] = [
  facultyProfile("Cape Peninsula University of Technology", [
    "Applied Sciences",
    "Business and Management Sciences",
    "Education",
    "Engineering and the Built Environment",
    "Health and Wellness Sciences",
    "Humanities",
    "Informatics and Design",
  ]),
  facultyProfile("Central University of Technology", [
    "Engineering, Built Environment and Information Technology",
    "Health and Environmental Sciences",
    "Humanities",
    "Management Sciences",
  ]),
  facultyProfile("Durban University of Technology", [
    "Accounting and Informatics",
    "Applied Sciences",
    "Arts and Design",
    "Engineering and the Built Environment",
    "Health Sciences",
    "Management Sciences",
  ]),
  facultyProfile("Mangosuthu University of Technology", [
    "Engineering",
    "Management Sciences",
    "Natural Sciences",
  ]),
  facultyProfile("Nelson Mandela University", [
    "Business and Economic Sciences",
    "Education",
    "Engineering, the Built Environment and Technology",
    "Health Sciences",
    "Humanities",
    "Law",
    "Science",
  ]),
  facultyProfile(
    "North-West University Vanderbijlpark",
    [
      "Economic and Management Sciences",
      "Education",
      "Engineering",
      "Health Sciences",
      "Humanities",
      "Law",
      "Natural and Agricultural Sciences",
      "Theology",
    ],
    [
      {
        id: "nwu-bcom-accounting-general",
        name: "Bachelor of Commerce in Accounting (General)",
        qualificationCode: "5FH-H01-E302V-FT",
        faculty: "Economic and Management Sciences",
        durationYears: 3,
        source: "yearbook",
        sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
        sourceDocument:
          "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
        modules: [
          { code: "ACCF111", name: "Accounting 1A", semester: 1, yearOfStudy: 1 },
          { code: "BMAN111", name: "Business Management 1A", semester: 1, yearOfStudy: 1 },
          { code: "ECON112", name: "Economics 1A", semester: 1, yearOfStudy: 1 },
          { code: "MTHS112", name: "Mathematics 1A", semester: 1, yearOfStudy: 1 },
          { code: "GEAR111", name: "Governance, Ethics, Assurance and Risk 1A", semester: 1, yearOfStudy: 1 },
          { code: "ACCF121", name: "Accounting 1B", semester: 2, yearOfStudy: 1 },
          { code: "ALDA/E122", name: "Academic Literacy 1B", semester: 2, yearOfStudy: 1 },
          { code: "BMAN121", name: "Business Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "ECON122", name: "Economics 1B", semester: 2, yearOfStudy: 1 },
          { code: "STTN122", name: "Statistics 1B", semester: 2, yearOfStudy: 1 },
          { code: "WVET222", name: "Understanding the World 2B", semester: 2, yearOfStudy: 1 },
          { code: "ACCF211", name: "Accounting 2A", semester: 1, yearOfStudy: 2 },
          { code: "BMAR213", name: "Marketing Management 2A", semester: 1, yearOfStudy: 2 },
          { code: "TAXF211", name: "Taxation 2A", semester: 1, yearOfStudy: 2 },
          { code: "ACCF221", name: "Accounting 2B", semester: 2, yearOfStudy: 2 },
          { code: "BMAN221", name: "Business Management 2B", semester: 2, yearOfStudy: 2 },
          { code: "TAXF221", name: "Taxation 2B", semester: 2, yearOfStudy: 2 },
          { code: "WVET222", name: "Understanding the World 2B", semester: 2, yearOfStudy: 2 },
          { code: "FINM272", name: "Financial Management 2AB", semester: 1, yearOfStudy: 2 },
          { code: "MACC272", name: "Management Accounting 2AB", semester: 2, yearOfStudy: 2 },
          { code: "BMAN311", name: "Business Management 3A", semester: 1, yearOfStudy: 3 },
          { code: "WVES312", name: "Understanding the World 3A", semester: 1, yearOfStudy: 3 },
          { code: "BMAN321", name: "Business Management 3B", semester: 2, yearOfStudy: 3 },
          { code: "ACCF372", name: "Accounting 3AB", semester: 1, yearOfStudy: 3 },
          { code: "FINM372", name: "Financial Management 3AB", semester: 2, yearOfStudy: 3 },
          { code: "MACC372", name: "Management Accounting 3AB", semester: 2, yearOfStudy: 3 },
          { code: "TAXF372", name: "Taxation 3AB", semester: 2, yearOfStudy: 3 },
        ],
      },
      {
        id: "nwu-bcom-economics-risk-management",
        name: "Bachelor of Commerce in Economic Sciences with Economics and Risk Management",
        qualificationCode: "5FK-H05-E301P-FT / 5FK-H05-E301V-FT",
        faculty: "Economic and Management Sciences",
        durationYears: 3,
        source: "yearbook",
        sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
        sourceDocument:
          "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
        modules: [
          { code: "ACCS/ACCF111", name: "Accounting 1A", semester: 1, yearOfStudy: 1 },
          { code: "BMAN111", name: "Business Management 1A", semester: 1, yearOfStudy: 1 },
          { code: "ECON112", name: "Economics 1A", semester: 1, yearOfStudy: 1 },
          { code: "MTHS112", name: "Mathematics 1A", semester: 1, yearOfStudy: 1 },
          { code: "CMPG112", name: "Computing 1A", semester: 1, yearOfStudy: 1 },
          { code: "ACCS/F121", name: "Accounting 1B", semester: 2, yearOfStudy: 1 },
          { code: "ALDA/E122", name: "Academic Literacy 1B", semester: 2, yearOfStudy: 1 },
          { code: "BMAN121", name: "Business Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "ECON122", name: "Economics 1B", semester: 2, yearOfStudy: 1 },
          { code: "STTN122", name: "Statistics 1B", semester: 2, yearOfStudy: 1 },
          { code: "ACCF211", name: "Accounting 2A", semester: 1, yearOfStudy: 2 },
          { code: "ECON211", name: "Economics 2A", semester: 1, yearOfStudy: 2 },
          { code: "EKIP212", name: "Macroeconomics 2A", semester: 1, yearOfStudy: 2 },
          { code: "EKRP211", name: "Risk Management 2A", semester: 1, yearOfStudy: 2 },
          { code: "ACCF221", name: "Accounting 2B", semester: 2, yearOfStudy: 2 },
          { code: "ECON221", name: "Economics 2B", semester: 2, yearOfStudy: 2 },
          { code: "EKIP222", name: "Macroeconomics 2B", semester: 2, yearOfStudy: 2 },
          { code: "EKRP221", name: "Risk Management 2B", semester: 2, yearOfStudy: 2 },
          { code: "CMPG222", name: "Computing 2B", semester: 2, yearOfStudy: 2 },
          { code: "ECON313", name: "Economics 3A", semester: 1, yearOfStudy: 3 },
          { code: "ECON314", name: "Economics 3A Advanced", semester: 1, yearOfStudy: 3 },
          { code: "EKIP312", name: "Macroeconomics 3A", semester: 1, yearOfStudy: 3 },
          { code: "EKRP311", name: "Risk Management 3A", semester: 1, yearOfStudy: 3 },
          { code: "WVES312", name: "Understanding the World 3A", semester: 1, yearOfStudy: 3 },
          { code: "ECON322", name: "Economics 3B", semester: 2, yearOfStudy: 3 },
          { code: "ECON325", name: "Economics 3B Applied", semester: 2, yearOfStudy: 3 },
          { code: "EKIP322", name: "Macroeconomics 3B", semester: 2, yearOfStudy: 3 },
          { code: "EKRP321", name: "Risk Management 3B", semester: 2, yearOfStudy: 3 },
          { code: "WVES222", name: "Understanding the World 2B", semester: 2, yearOfStudy: 3 },
        ],
      },
      {
        id: "nwu-bcom-economics-international-trade",
        name: "Bachelor of Commerce in Economic Sciences with Economics and International Trade",
        qualificationCode: "5FK-H01-E301P-FT / 5FK-H01-E301V-FT",
        faculty: "Economic and Management Sciences",
        durationYears: 3,
        source: "yearbook",
        sourceLabel: "NWU FEMS Undergraduate Yearbook 2026",
        sourceDocument:
          "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\nwu-yearbooks-2026-main-page\\Economic and Management Sciences\\15-FEMS-UG-2026-003.pdf",
        modules: [
          { code: "ACCS111/ACCF111", name: "Accounting 1A", semester: 1, yearOfStudy: 1 },
          { code: "BMAN111", name: "Business Management 1A", semester: 1, yearOfStudy: 1 },
          { code: "CMPG112", name: "Computing 1A", semester: 1, yearOfStudy: 1 },
          { code: "ECON112", name: "Economics 1A", semester: 1, yearOfStudy: 1 },
          { code: "MTHS112", name: "Mathematics 1A", semester: 1, yearOfStudy: 1 },
          { code: "ACCS121/ACCF121", name: "Accounting 1B", semester: 2, yearOfStudy: 1 },
          { code: "ALDA/E122", name: "Academic Literacy 1B", semester: 2, yearOfStudy: 1 },
          { code: "BMAN121", name: "Business Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "ECON122", name: "Economics 1B", semester: 2, yearOfStudy: 1 },
          { code: "STTN122", name: "Statistics 1B", semester: 2, yearOfStudy: 1 },
          { code: "BMAR213", name: "Marketing Management 2A", semester: 1, yearOfStudy: 2 },
          { code: "ECON211", name: "Economics 2A", semester: 1, yearOfStudy: 2 },
          { code: "EKIP212", name: "Macroeconomics 2A", semester: 1, yearOfStudy: 2 },
          { code: "EKRP211", name: "International Trade 2A", semester: 1, yearOfStudy: 2 },
          { code: "BMAN221", name: "Business Management 2B", semester: 2, yearOfStudy: 2 },
          { code: "ECON221", name: "Economics 2B", semester: 2, yearOfStudy: 2 },
          { code: "EKIP222", name: "Macroeconomics 2B", semester: 2, yearOfStudy: 2 },
          { code: "EKRP221", name: "International Trade 2B", semester: 2, yearOfStudy: 2 },
          { code: "CMPG222", name: "Computing 2B", semester: 2, yearOfStudy: 2 },
          { code: "BMAN311", name: "Business Management 3A", semester: 1, yearOfStudy: 3 },
          { code: "ECON313", name: "Economics 3A", semester: 1, yearOfStudy: 3 },
          { code: "ECON314", name: "Economics 3A Advanced", semester: 1, yearOfStudy: 3 },
          { code: "EKIP312", name: "Macroeconomics 3A", semester: 1, yearOfStudy: 3 },
          { code: "WVES312", name: "Understanding the World 3A", semester: 1, yearOfStudy: 3 },
          { code: "BMAN321", name: "Business Management 3B", semester: 2, yearOfStudy: 3 },
          { code: "ECON322", name: "Economics 3B", semester: 2, yearOfStudy: 3 },
          { code: "ECON325", name: "Economics 3B Applied", semester: 2, yearOfStudy: 3 },
          { code: "EKIP322", name: "Macroeconomics 3B", semester: 2, yearOfStudy: 3 },
          { code: "WVES222", name: "Understanding the World 2B", semester: 2, yearOfStudy: 3 },
        ],
      },
    ],
    {
      note: "Yearbook-backed course plans currently seeded for founder-targeted NWU pathways.",
    }
  ),
  facultyProfile("Rhodes University", [
    "Commerce",
    "Education",
    "Humanities",
    "Law",
    "Pharmacy",
    "Science",
  ]),
  facultyProfile("Sefako Makgatho Health Sciences University", ["Health Sciences"]),
  facultyProfile("Sol Plaatje University", [
    "Economic and Management Sciences",
    "Education",
    "Humanities",
    "Natural and Applied Sciences",
  ]),
  facultyProfile("Stellenbosch University", [
    "AgriSciences",
    "Arts and Social Sciences",
    "Economic and Management Sciences",
    "Education",
    "Engineering",
    "Law",
    "Medicine and Health Sciences",
    "Military Science",
    "Science",
    "Theology",
  ]),
  facultyProfile("Tshwane University of Technology", [
    "Arts and Design",
    "Economics and Finance",
    "Engineering and the Built Environment",
    "Humanities",
    "Information and Communication Technology",
    "Management Sciences",
    "Science",
  ]),
  facultyProfile("University of Cape Town", [
    "Commerce",
    "Engineering and the Built Environment",
    "Health Sciences",
    "Humanities",
    "Law",
    "Science",
  ]),
  facultyProfile("University of Fort Hare", [
    "Education",
    "Health Sciences",
    "Law",
    "Management and Commerce",
    "Science and Agriculture",
    "Social Sciences and Humanities",
  ]),
  facultyProfile(
    "University of Johannesburg",
    [
      "College of Business and Economics",
      "Art, Design and Architecture",
      "Education",
      "Engineering and the Built Environment",
      "Health Sciences",
      "Humanities",
      "Law",
      "Science",
    ],
    [
      {
        id: "uj-bcom-accounting",
        name: "BCom (Accounting)",
        qualificationCode: "B34A5Q",
        faculty: "College of Business and Economics",
        campuses: ["Auckland Park Kingsway", "Auckland Park Bunting Road"],
        durationYears: 3,
        source: "yearbook",
        sourceLabel: "UJ CBE Undergraduate Yearbook 2025",
        sourceDocument:
          "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\uj-cbe-yearbook-2026-pruned\\2025\\Yearbooks\\CBE Undergraduate Yearbook Latest.pdf",
        modules: [
          { code: "ACC01A1", name: "Accounting 1A", semester: 1, yearOfStudy: 1 },
          { code: "BMA11A1", name: "Business Management 1A", semester: 1, yearOfStudy: 1 },
          { code: "COL41A1", name: "Commercial Law 1A", semester: 1, yearOfStudy: 1 },
          { code: "ECO01A1", name: "Economics 1A", semester: 1, yearOfStudy: 1 },
          { code: "MAA00A1", name: "Introductory Mathematical Analysis A", semester: 1, yearOfStudy: 1 },
          { code: "ACC01B1", name: "Accounting 1B", semester: 2, yearOfStudy: 1 },
          { code: "BMA21B1", name: "Business Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "COL41B1", name: "Commercial Law 1B", semester: 2, yearOfStudy: 1 },
          { code: "ECO01B1", name: "Economics 1B", semester: 2, yearOfStudy: 1 },
          { code: "FNM1B01", name: "Financial Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "ACT02A2", name: "Accounting 2A", semester: 1, yearOfStudy: 2 },
          { code: "BIS22A2", name: "Business Information Systems 2A", semester: 1, yearOfStudy: 2 },
          { code: "GAC02A2", name: "Governance and Control 2A", semester: 1, yearOfStudy: 2 },
          { code: "MAS02A2", name: "Management Accounting Strategy 2A", semester: 1, yearOfStudy: 2 },
          { code: "FNM22A2", name: "Financial Management 2A", semester: 1, yearOfStudy: 2 },
          { code: "TAX2B00", name: "Taxation 2AB", semester: 2, yearOfStudy: 2 },
          { code: "ACT02B2", name: "Accounting 2B", semester: 2, yearOfStudy: 2 },
          { code: "BIS22B2", name: "Business Information Systems 2B", semester: 2, yearOfStudy: 2 },
          { code: "EFC02B2", name: "Ethical Foundation to Commerce 2B", semester: 2, yearOfStudy: 2 },
          { code: "MAS02B2", name: "Management Accounting Strategy 2B", semester: 2, yearOfStudy: 2 },
          { code: "CMA02B2", name: "Cost and Management Accounting 2B", semester: 2, yearOfStudy: 2 },
          { code: "ACC3AB0", name: "Accounting 3AB", semester: 1, yearOfStudy: 3 },
          { code: "GOC3AB0", name: "Governance and Control 3AB", semester: 1, yearOfStudy: 3 },
          { code: "TAX3AB0", name: "Taxation 3AB", semester: 2, yearOfStudy: 3 },
          { code: "CMA03A3", name: "Cost and Management Accounting 3A", semester: 1, yearOfStudy: 3 },
          { code: "FNM03B3", name: "Financial Management 3B", semester: 2, yearOfStudy: 3 },
          { code: "ACC4IRB", name: "4IR Accounting B", semester: 2, yearOfStudy: 3 },
        ],
      },
      {
        id: "uj-bcom-economics-econometrics",
        name: "BCom (Economics and Econometrics)",
        qualificationCode: "B3N14Q",
        faculty: "College of Business and Economics",
        campuses: ["Auckland Park Kingsway", "Auckland Park Bunting Road"],
        durationYears: 3,
        source: "yearbook",
        sourceLabel: "UJ CBE Undergraduate Yearbook 2025",
        sourceDocument:
          "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\uj-cbe-yearbook-2026-pruned\\2025\\Yearbooks\\CBE Undergraduate Yearbook Latest.pdf",
        modules: [
          { code: "MAA00A1", name: "Introductory Mathematical Analysis A", semester: 1, yearOfStudy: 1 },
          { code: "COL41A1", name: "Commercial Law 1A", semester: 1, yearOfStudy: 1 },
          { code: "ECO01A1", name: "Economics 1A", semester: 1, yearOfStudy: 1 },
          { code: "ACC01A1", name: "Accounting 1A", semester: 1, yearOfStudy: 1 },
          { code: "BMA11A1", name: "Business Management 1A", semester: 1, yearOfStudy: 1 },
          { code: "MAA00B1", name: "Mathematical Analysis B", semester: 2, yearOfStudy: 1 },
          { code: "FNM1B01", name: "Financial Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "ECO01B1", name: "Economics 1B", semester: 2, yearOfStudy: 1 },
          { code: "ACC01B1", name: "Accounting 1B", semester: 2, yearOfStudy: 1 },
          { code: "BMA21B1", name: "Business Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "ECM02A2", name: "Econometrics 2A", semester: 1, yearOfStudy: 2 },
          { code: "ECO2AA2", name: "Economics 2A", semester: 1, yearOfStudy: 2 },
          { code: "ECO2CA2", name: "Economics 2C", semester: 1, yearOfStudy: 2 },
          { code: "ECO2FA2", name: "Economics 2F", semester: 1, yearOfStudy: 2 },
          { code: "QTE2AA2", name: "Quantitative Economics 2A", semester: 1, yearOfStudy: 2 },
          { code: "ECM02B2", name: "Econometrics 2B", semester: 2, yearOfStudy: 2 },
          { code: "ECO2BB2", name: "Economics 2B", semester: 2, yearOfStudy: 2 },
          { code: "ECO2DB2", name: "Economics 2D", semester: 2, yearOfStudy: 2 },
          { code: "ECO2EB2", name: "Economics 2E", semester: 2, yearOfStudy: 2 },
          { code: "QTE2BB2", name: "Quantitative Economics 2B", semester: 2, yearOfStudy: 2 },
          { code: "ECO3AA3", name: "Economics 3A", semester: 1, yearOfStudy: 3 },
          { code: "ECO3CA3", name: "Economics 3C", semester: 1, yearOfStudy: 3 },
          { code: "QTE3AA3", name: "Quantitative Economics 3A", semester: 1, yearOfStudy: 3 },
          { code: "ECO3BB3", name: "Economics 3B", semester: 2, yearOfStudy: 3 },
          { code: "ECO3DB3", name: "Economics 3D", semester: 2, yearOfStudy: 3 },
          { code: "QTE3BB3", name: "Quantitative Economics 3B", semester: 2, yearOfStudy: 3 },
        ],
      },
      {
        id: "uj-bcom-finance",
        name: "BCom in Finance",
        qualificationCode: "B34F5Q",
        faculty: "College of Business and Economics",
        campuses: ["Auckland Park Kingsway", "Auckland Park Bunting Road"],
        durationYears: 3,
        source: "yearbook",
        sourceLabel: "UJ CBE Undergraduate Yearbook 2025",
        sourceDocument:
          "C:\\Users\\molot\\Desktop\\AI LAB\\downloads\\uj-cbe-yearbook-2026-pruned\\2025\\Yearbooks\\CBE Undergraduate Yearbook Latest.pdf",
        modules: [
          { code: "ACC01A1", name: "Accounting 1A", semester: 1, yearOfStudy: 1 },
          { code: "BMA11A1", name: "Business Management 1A", semester: 1, yearOfStudy: 1 },
          { code: "PFS01A1", name: "Professional Skills 1A", semester: 1, yearOfStudy: 1 },
          { code: "ECO01A1", name: "Economics 1A", semester: 1, yearOfStudy: 1 },
          { code: "ATE01A1", name: "Analytical Techniques 1A", semester: 1, yearOfStudy: 1 },
          { code: "ACC01B1", name: "Accounting 1B", semester: 2, yearOfStudy: 1 },
          { code: "BMA21B1", name: "Business Management 1B", semester: 2, yearOfStudy: 1 },
          { code: "ITF01B1", name: "Introduction to Finance 1B", semester: 2, yearOfStudy: 1 },
          { code: "ECO01B1", name: "Economics 1B", semester: 2, yearOfStudy: 1 },
          { code: "ATE01B1", name: "Analytical Techniques 1B", semester: 2, yearOfStudy: 1 },
        ],
      },
    ],
    { academicUnitLabel: "Faculty / College", note: "Yearbook-backed UJ course plans are seeded for key College of Business and Economics pathways." }
  ),
  facultyProfile("University of KwaZulu-Natal", [
    "Agriculture, Engineering and Science",
    "Health Sciences",
    "Humanities",
    "Law and Management Studies",
  ]),
  facultyProfile("University of Limpopo", [
    "Health Sciences",
    "Humanities",
    "Management, Commerce and Law",
    "Science and Agriculture",
  ]),
  facultyProfile("University of Mpumalanga", [
    "Agriculture and Natural Sciences",
    "Economics, Development and Business Sciences",
    "Education",
    "Humanities",
  ]),
  facultyProfile("University of Pretoria", [
    "Economic and Management Sciences",
    "Education",
    "Engineering, Built Environment and Information Technology",
    "Health Sciences",
    "Humanities",
    "Law",
    "Natural and Agricultural Sciences",
    "Theology and Religion",
    "Veterinary Science",
  ]),
  facultyProfile(
    "University of South Africa",
    [
      "College of Accounting Sciences",
      "College of Agriculture and Environmental Sciences",
      "College of Economic and Management Sciences",
      "College of Education",
      "College of Human Sciences",
      "College of Law",
      "College of Science, Engineering and Technology",
    ],
    [],
    { academicUnitLabel: "College" }
  ),
  facultyProfile("University of the Free State", [
    "Economic and Management Sciences",
    "Education",
    "Health Sciences",
    "Humanities",
    "Law",
    "Natural and Agricultural Sciences",
    "Theology and Religion",
  ]),
  facultyProfile("University of the Western Cape", [
    "Arts and Humanities",
    "Community and Health Sciences",
    "Dentistry",
    "Economic and Management Sciences",
    "Education",
    "Law",
    "Natural Sciences",
  ]),
  facultyProfile("University of Venda", [
    "Health Sciences",
    "Humanities, Social Sciences and Education",
    "Management, Commerce and Law",
    "Science, Engineering and Agriculture",
  ]),
  facultyProfile("University of Zululand", [
    "Humanities and Social Sciences",
    "Commerce, Administration and Law",
    "Education",
    "Science, Agriculture and Engineering",
  ]),
  facultyProfile("Vaal University of Technology", [
    "Applied and Computer Sciences",
    "Engineering and Technology",
    "Human Sciences",
    "Management Sciences",
  ]),
  facultyProfile("Walter Sisulu University", [
    "Commerce and Administration",
    "Education",
    "Engineering, Built Environment and Information Technology",
    "Health Sciences",
    "Humanities, Social Sciences and Law",
    "Natural Sciences",
  ]),
  facultyProfile("University of the Witwatersrand", [
    "Commerce, Law and Management",
    "Engineering and the Built Environment",
    "Health Sciences",
    "Humanities",
    "Science",
  ]),
];

export function getUniversityAcademicProfile(institutionName: string | null | undefined) {
  if (!institutionName) return null;
  return UNIVERSITY_ACADEMIC_PROFILES.find((profile) => profile.institutionName === institutionName) ?? null;
}

export function getRecognizedFaculties(institutionName: string | null | undefined) {
  return getUniversityAcademicProfile(institutionName)?.faculties ?? [];
}

export function getCatalogCourses(institutionName: string | null | undefined) {
  return getUniversityAcademicProfile(institutionName)?.courses ?? [];
}

export function getCourseModulesForYear(
  institutionName: string | null | undefined,
  courseId: string | null | undefined,
  yearOfStudy: number | null | undefined
) {
  if (!institutionName || !courseId || !yearOfStudy) return [];
  const course = getCatalogCourses(institutionName).find((item) => item.id === courseId);
  if (!course) return [];
  return course.modules.filter((module) => module.yearOfStudy === yearOfStudy);
}
