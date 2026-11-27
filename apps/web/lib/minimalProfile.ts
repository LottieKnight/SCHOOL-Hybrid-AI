export const MINIMAL_PROFILE_STORAGE_KEY = "school.minimalProfile.v1";
export const MINIMAL_PROFILE_EVENT = "school:minimal-profile-changed";

export const PROFILE_ROLES = ["learner", "teacher", "university"] as const;
export type ProfileRole = (typeof PROFILE_ROLES)[number];

export const PROFILE_GRADES = ["R", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "university"] as const;
export type ProfileGrade = (typeof PROFILE_GRADES)[number];

export const SUBJECT_CHIPS = [
  "Mathematics",
  "Mathematical Literacy",
  "Physical Sciences",
  "Life Sciences",
  "English",
  "Afrikaans",
  "History",
  "Geography",
  "Accounting",
  "Business Studies",
  "Economics",
  "Life Orientation",
] as const;

export type MinimalProfile = {
  displayName: string;
  email: string;
  photoURL: string;
  role: ProfileRole;
  grade: ProfileGrade | "";
  subjects: string[];
  skipped: boolean;
  updatedAt: string;
};

export type ProfileStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const ROLE_SET = new Set<string>(PROFILE_ROLES);
const GRADE_SET = new Set<string>(PROFILE_GRADES);

export function emptyMinimalProfile(now = new Date().toISOString()): MinimalProfile {
  return {
    displayName: "",
    email: "",
    photoURL: "",
    role: "learner",
    grade: "",
    subjects: [],
    skipped: false,
    updatedAt: now,
  };
}

function cleanEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function cleanPhotoURL(value: unknown) {
  if (typeof value !== "string") return "";
  const url = value.trim().slice(0, 500);
  return url.startsWith("https://") ? url : "";
}

function cleanName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

function cleanSubjects(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const label = entry.replace(/\s+/g, " ").trim().slice(0, 48);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    subjects.push(label);
    if (subjects.length >= 8) break;
  }
  return subjects;
}

export function parseMinimalProfile(raw: unknown): MinimalProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const role = typeof record.role === "string" && ROLE_SET.has(record.role) ? (record.role as ProfileRole) : "learner";
  const grade = typeof record.grade === "string" && GRADE_SET.has(record.grade) ? (record.grade as ProfileGrade) : "";
  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt : new Date(0).toISOString();
  return {
    displayName: cleanName(record.displayName),
    email: cleanEmail(record.email),
    photoURL: cleanPhotoURL(record.photoURL),
    role,
    grade,
    subjects: cleanSubjects(record.subjects),
    skipped: record.skipped === true,
    updatedAt,
  };
}

export function readMinimalProfile(storage: ProfileStorage | null | undefined): MinimalProfile | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(MINIMAL_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    return parseMinimalProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeMinimalProfile(storage: ProfileStorage, profile: MinimalProfile): MinimalProfile {
  const next = parseMinimalProfile(profile) ?? emptyMinimalProfile();
  storage.setItem(MINIMAL_PROFILE_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function skippedMinimalProfile(now = new Date().toISOString()): MinimalProfile {
  return { ...emptyMinimalProfile(now), skipped: true };
}

export function gradeNumber(grade: string | null | undefined): number | null {
  if (!grade || grade === "university") return null;
  if (grade === "R") return 0;
  const number = Number(grade);
  return Number.isInteger(number) && number >= 1 && number <= 12 ? number : null;
}

export function formatGradeLabel(grade: string | null | undefined) {
  if (!grade) return null;
  if (grade === "R") return "Grade R";
  if (grade === "university") return "University";
  const number = gradeNumber(grade);
  return number ? `Grade ${number}` : null;
}

export function roleLabel(role: ProfileRole | null | undefined) {
  if (role === "teacher") return "Teacher";
  if (role === "university") return "University";
  return "Learner";
}

export type TopbarIdentity = {
  greetingName: string | null;
  badge: string;
  showAcademicPeriod: boolean;
};

export function topbarIdentity(input: {
  profile: MinimalProfile | null;
  sessionFirstName?: string | null;
}): TopbarIdentity {
  const profile = input.profile;
  const personal = profile?.displayName?.trim() || input.sessionFirstName?.trim() || null;
  const university = profile?.role === "university" || profile?.grade === "university";
  if (university) {
    return {
      greetingName: personal,
      badge: personal || "University",
      showAcademicPeriod: true,
    };
  }
  const grade = formatGradeLabel(profile?.grade);
  const parts = [personal, grade].filter(Boolean);
  return {
    greetingName: personal,
    badge: parts.join(" · ") || roleLabel(profile?.role),
    showAcademicPeriod: false,
  };
}

export function learnPhaseForGrade(grade: string | null | undefined) {
  const number = gradeNumber(grade);
  if (number == null) return null;
  if (number <= 3) return "foundation";
  if (number <= 6) return "intermediate";
  if (number <= 9) return "senior";
  return "fet";
}

export function learnHrefForProfile(profile: MinimalProfile | null) {
  if (!profile) return "/learn";
  if (profile.role === "university" || profile.grade === "university") return "/university";
  const number = gradeNumber(profile.grade);
  if (number == null) return "/learn";
  const phase = learnPhaseForGrade(profile.grade);
  const segment = number === 0 ? "grade-00" : `grade-${String(number).padStart(2, "0")}`;
  return `/learn/${phase}/${segment}`;
}

export function pastPapersGradeParam(profile: MinimalProfile | null) {
  const number = gradeNumber(profile?.grade);
  if (number != null && number >= 10 && number <= 12) return String(number);
  return null;
}

export function tutorDefaults(profile: MinimalProfile | null) {
  const number = gradeNumber(profile?.grade);
  return {
    grade: number != null && number >= 10 && number <= 12 ? String(number) : null,
    subject: profile?.subjects[0] ?? null,
  };
}

export function mergeProfiles(local: MinimalProfile | null, remote: MinimalProfile | null) {
  if (!local) return remote;
  if (!remote) return local;
  return local.updatedAt >= remote.updatedAt ? local : remote;
}

export function applyGoogleName(profile: MinimalProfile | null, googleName: string | null | undefined, now = new Date().toISOString()) {
  const base = profile ?? emptyMinimalProfile(now);
  const incoming = cleanName(googleName);
  if (!incoming || base.displayName) return base;
  return { ...base, displayName: incoming, updatedAt: now };
}

export function applyGoogleIdentity(
  profile: MinimalProfile | null,
  google: { displayName?: string | null; email?: string | null; photoURL?: string | null },
  now = new Date().toISOString(),
) {
  const base = profile ?? emptyMinimalProfile(now);
  let next = applyGoogleName(base, google.displayName, now);
  const email = cleanEmail(google.email);
  const photoURL = cleanPhotoURL(google.photoURL);
  if (email && email !== next.email) next = { ...next, email };
  if (photoURL && photoURL !== next.photoURL) next = { ...next, photoURL };
  const changed = next.displayName !== base.displayName || next.email !== base.email || next.photoURL !== base.photoURL;
  if (changed && next.updatedAt === base.updatedAt) next = { ...next, updatedAt: now };
  return next;
}

export function profileForAccountSync(profile: MinimalProfile) {
  return {
    appPreferences: {
      minimalProfile: profile,
    },
  };
}

export function readMinimalProfileFromPreferences(preferences: unknown) {
  if (!preferences || typeof preferences !== "object") return null;
  return parseMinimalProfile((preferences as { minimalProfile?: unknown }).minimalProfile);
}
