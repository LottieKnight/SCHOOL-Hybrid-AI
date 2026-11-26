import type { CalendarFormat } from "@/lib/academicPeriod";
import { UNIVERSITY_ACADEMIC_PROFILES, getUniversityAcademicProfile } from "@/lib/universityAcademicCatalog";

export type InstitutionSeedRecord = {
  name: string;
  shortName?: string | null;
  domain?: string | null;
  type: "university" | "school";
  province?: string | null;
  country: string;
};

export type InstitutionProfileSeed = {
  institutionName: string;
  academicPeriodType: CalendarFormat;
  faculties: string[];
  country?: string;
  region?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
};

export const SOUTH_AFRICAN_UNIVERSITY_SEEDS: InstitutionSeedRecord[] = [
  { name: "Cape Peninsula University of Technology", shortName: "CPUT", domain: "cput.ac.za", type: "university", country: "ZA" },
  { name: "Central University of Technology", shortName: "CUT", domain: "cut.ac.za", type: "university", country: "ZA" },
  { name: "Durban University of Technology", shortName: "DUT", domain: "dut.ac.za", type: "university", country: "ZA" },
  { name: "Mangosuthu University of Technology", shortName: "MUT", domain: "mut.ac.za", type: "university", country: "ZA" },
  { name: "Nelson Mandela University", shortName: "NMU", domain: "mandela.ac.za", type: "university", country: "ZA" },
  { name: "North-West University", shortName: "NWU", domain: "nwu.ac.za", type: "university", province: "North West", country: "ZA" },
  { name: "Rhodes University", shortName: "RU", domain: "ru.ac.za", type: "university", country: "ZA" },
  { name: "Sefako Makgatho Health Sciences University", shortName: "SMU", domain: "smu.ac.za", type: "university", country: "ZA" },
  { name: "Sol Plaatje University", shortName: "SPU", domain: "spu.ac.za", type: "university", country: "ZA" },
  { name: "Stellenbosch University", shortName: "SU", domain: "sun.ac.za", type: "university", country: "ZA" },
  { name: "Tshwane University of Technology", shortName: "TUT", domain: "tut.ac.za", type: "university", country: "ZA" },
  { name: "University of Cape Town", shortName: "UCT", domain: "uct.ac.za", type: "university", country: "ZA" },
  { name: "University of Fort Hare", shortName: "UFH", domain: "ufh.ac.za", type: "university", country: "ZA" },
  { name: "University of Johannesburg", shortName: "UJ", domain: "uj.ac.za", type: "university", country: "ZA" },
  { name: "University of KwaZulu-Natal", shortName: "UKZN", domain: "ukzn.ac.za", type: "university", country: "ZA" },
  { name: "University of Limpopo", shortName: "UL", domain: "ul.ac.za", type: "university", country: "ZA" },
  { name: "University of Mpumalanga", shortName: "UMP", domain: "ump.ac.za", type: "university", country: "ZA" },
  { name: "University of Pretoria", shortName: "UP", domain: "up.ac.za", type: "university", country: "ZA" },
  { name: "University of South Africa", shortName: "UNISA", domain: "unisa.ac.za", type: "university", country: "ZA" },
  { name: "University of the Free State", shortName: "UFS", domain: "ufs.ac.za", type: "university", country: "ZA" },
  { name: "University of the Western Cape", shortName: "UWC", domain: "uwc.ac.za", type: "university", country: "ZA" },
  { name: "University of Venda", shortName: "UNIVEN", domain: "univen.ac.za", type: "university", country: "ZA" },
  { name: "University of Zululand", shortName: "UNIZULU", domain: "unizulu.ac.za", type: "university", country: "ZA" },
  { name: "Vaal University of Technology", shortName: "VUT", domain: "vut.ac.za", type: "university", country: "ZA" },
  { name: "Walter Sisulu University", shortName: "WSU", domain: "wsu.ac.za", type: "university", country: "ZA" },
  { name: "University of the Witwatersrand", shortName: "Wits", domain: "wits.ac.za", type: "university", country: "ZA" },
];

const INSTITUTION_COLORS: Record<string, { region?: string; primaryColor?: string; secondaryColor?: string }> = {
  "North-West University": {
    region: "North West",
    primaryColor: "#5C2D91",
    secondaryColor: "#A783D8",
  },
  "University of Cape Town": {
    region: "Western Cape",
    primaryColor: "#0B4F71",
    secondaryColor: "#69B7D4",
  },
  "University of Johannesburg": {
    region: "Gauteng",
    primaryColor: "#F36F21",
    secondaryColor: "#F7B267",
  },
};

export const INSTITUTION_PROFILE_SEEDS: InstitutionProfileSeed[] = UNIVERSITY_ACADEMIC_PROFILES.map((profile) => ({
  institutionName: profile.institutionName,
  academicPeriodType: profile.academicPeriodType,
  faculties: profile.faculties,
  country: "ZA",
  region: INSTITUTION_COLORS[profile.institutionName]?.region ?? null,
  logoUrl: null,
  primaryColor: INSTITUTION_COLORS[profile.institutionName]?.primaryColor ?? null,
  secondaryColor: INSTITUTION_COLORS[profile.institutionName]?.secondaryColor ?? null,
}));

export const UNIVERSITY_ARCHIVE_NOTES: Record<string, string> = {
  "Durban University of Technology":
    "Official DUT document URLs were identified during archive collection, but the host timed out repeatedly from this environment.",
  "North-West University": getUniversityAcademicProfile("North-West University")?.note ?? "",
  "University of Johannesburg": getUniversityAcademicProfile("University of Johannesburg")?.note ?? "",
};
