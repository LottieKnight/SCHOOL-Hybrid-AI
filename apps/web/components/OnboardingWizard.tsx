"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { safeReturnUrl } from "@/lib/safeReturnUrl";
import { Button } from "@/components/ui/Button";
import { useSession } from "@/components/SessionProvider";
import { CALENDAR_FORMAT_STORAGE_KEY } from "@/lib/academicPreferences";
import type { CalendarFormat } from "@/lib/academicPeriod";
import { planSchoolLessonGeneration, planUniversityLessonGeneration } from "@/lib/lessonGenerationPlan";
import { isFetGrade, schoolFinishHref } from "@/lib/onboardingDestination";
import type { PlannerCatalog, PlannerGrade } from "@/lib/plannerCatalog";
import type { PublicInstitutionListItem } from "@/lib/server/institutions";
import type {
  UniversityAcademicUnitLabel,
  UniversityCourseCatalog,
  UniversityCourseModule,
} from "@/lib/universityAcademicCatalog";

import { LiteModeToggle } from "@/components/LiteModeToggle";

type StudyType = "school" | "university" | null;
type ExamEntry = { subject: string; date: string };
type SchoolSubjectOption = { key: string; name: string };
type UniversityModule = UniversityCourseModule & {
  assumed: boolean;
  source: "yearbook" | "manual";
};
type UniversityCatalogResponse = {
  institutionName: string;
  academicPeriodType: CalendarFormat;
  academicUnitLabel: UniversityAcademicUnitLabel | null;
  campuses: string[];
  faculties: string[];
  courses: UniversityCourseCatalog[];
  note: string | null;
};
type CampusOption = {
  id: string;
  name: string;
  isPrimary: boolean;
};

function getPhaseLabel(grade: PlannerGrade | null) {
  return grade ? `${grade.band} Phase` : null;
}

function normalizeCampusName(value: string) {
  const lowered = value.trim().toLowerCase();
  if (lowered.includes("mafikeng") || lowered.includes("mahikeng")) return "Mahikeng";
  if (lowered.includes("potchefstroom")) return "Potchefstroom";
  if (lowered.includes("vanderbijlpark")) return "Vanderbijlpark";
  return value.trim();
}

function dedupeModules(modules: UniversityModule[]) {
  const seen = new Map<string, UniversityModule>();
  for (const mod of modules) {
    const key = `${mod.code.trim().toUpperCase()}|${mod.yearOfStudy}|${mod.semester ?? "x"}|${mod.source}`;
    if (!mod.code.trim()) continue;
    const normalized: UniversityModule = {
      ...mod,
      code: mod.code.trim().toUpperCase(),
      name: mod.name.trim(),
      credits: typeof mod.credits === "number" ? mod.credits : null,
      isCore: typeof mod.isCore === "boolean" ? mod.isCore : null,
      durationType: mod.durationType ?? null,
      durationLabel: mod.durationLabel ?? null,
      semester: mod.semester ?? null,
    };
    const current = seen.get(key);
    if (!current) {
      seen.set(key, normalized);
      continue;
    }
    seen.set(key, {
      ...current,
      name: current.name.length >= normalized.name.length ? current.name : normalized.name,
      credits: current.credits ?? normalized.credits ?? null,
      isCore: current.isCore ?? normalized.isCore ?? null,
      durationType: current.durationType ?? normalized.durationType ?? null,
      durationLabel: current.durationLabel ?? normalized.durationLabel ?? null,
    });
  }
  return Array.from(seen.values()).sort((left, right) => {
    if (left.yearOfStudy !== right.yearOfStudy) return left.yearOfStudy - right.yearOfStudy;
    if ((left.semester ?? 9) !== (right.semester ?? 9)) return (left.semester ?? 9) - (right.semester ?? 9);
    return left.code.localeCompare(right.code);
  });
}

function parseManualModule(value: string, yearOfStudy: number): UniversityModule | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const [first, ...rest] = trimmed.split("-");
  const code = (first.trim().split(/\s+/)[0] ?? "").toUpperCase().replace(/[^A-Z0-9/]/g, "");
  if (!code) return null;
  return {
    code,
    name: rest.join("-").trim() || trimmed,
    semester: null,
    yearOfStudy,
    credits: null,
    isCore: null,
    durationType: null,
    durationLabel: null,
    assumed: false,
    source: "manual",
  };
}

function formatPeriodLabel(periodType: CalendarFormat | null | undefined) {
  switch (periodType) {
    case "quarter":
      return "Quarter system";
    case "trimester":
      return "Trimester system";
    case "term":
      return "Term system";
    case "semester":
    default:
      return "Semester system";
  }
}

function formatModuleDuration(module: UniversityModule) {
  if (module.durationLabel) return module.durationLabel;
  if (module.durationType === "year") return "Year module";
  if (module.semester === 1 || module.semester === 2) return `Semester ${module.semester}`;
  return "Flexible duration";
}

function PeriodBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "5px 10px",
        borderRadius: "999px",
        background: "var(--gold-dim)",
        border: "1px solid var(--gold-border)",
        color: "var(--gold)",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
      }}
    >
      {label}
    </span>
  );
}

function buildSubjectLabel(module: UniversityModule) {
  return module.name === module.code ? module.code : `${module.code} - ${module.name}`;
}

function buildPostOnboardingHref(input: {
  studyType: StudyType;
  grade: PlannerGrade | null;
  schoolSubjects: SchoolSubjectOption[];
  modules: UniversityModule[];
  action?: "papers" | "tutor" | "learn";
}) {
  if (input.studyType === "school" && input.grade) {
    return schoolFinishHref(input.grade.number, input.action ?? "learn");
  }

  if (input.studyType === "university") {
    return "/university/learning";
  }

  return "/dashboard";
}

function moduleIdentity(module: Pick<UniversityModule, "code" | "semester" | "yearOfStudy" | "source">) {
  return [module.code.trim().toUpperCase(), module.semester ?? "x", module.yearOfStudy, module.source].join("|");
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
      {Array.from({ length: total }, (_, index) => index + 1).map((item) => (
        <span
          key={item}
          style={{
            width: item <= step ? "8px" : "6px",
            height: item <= step ? "8px" : "6px",
            borderRadius: "999px",
            background: item < step ? "var(--green)" : item === step ? "var(--gold)" : "var(--border-2)",
          }}
        />
      ))}
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section
      className="animate-fade-up"
      style={{
        width: "min(920px, calc(100vw - 32px))",
        display: "grid",
        gap: "24px",
        padding: "32px",
        borderRadius: "var(--r-xl)",
        border: "1px solid var(--border)",
        background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
        boxShadow: "var(--sh-lg)",
      }}
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "32px" }}>{title}</h1>
        <p style={{ margin: 0, fontSize: "14px" }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function OnboardingWizard({ catalog, institutions, returnUrl }: { catalog: PlannerCatalog; institutions: PublicInstitutionListItem[]; returnUrl?: string | null }) {
  const router = useRouter();
  const { session, refresh } = useSession();
  const apiBase = API_BASE;
  const [step, setStep] = useState(0);
  const STORAGE_KEY = "school_onboarding_draft";

  const [studyType, setStudyType] = useState<StudyType>(null);
  const [signupFirstName, setSignupFirstName] = useState("");
  const [signupLastName, setSignupLastName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupStudentNumber, setSignupStudentNumber] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupConflict, setSignupConflict] = useState(false);
  const [gradeValue, setGradeValue] = useState("");
  const [institutionQuery, setInstitutionQuery] = useState("");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState("");

  // Persistence: Load draft from localStorage on mount
  useEffect(() => {
    const draft = window.localStorage.getItem(STORAGE_KEY);
    if (draft) {
      try {
        const data = JSON.parse(draft);
        if (data.studyType) setStudyType(data.studyType);
        if (data.signupFirstName) setSignupFirstName(data.signupFirstName);
        if (data.signupLastName) setSignupLastName(data.signupLastName);
        if (data.signupEmail) setSignupEmail(data.signupEmail);
        if (data.signupPhone) setSignupPhone(data.signupPhone);
        if (data.gradeValue) setGradeValue(data.gradeValue);
        if (data.selectedInstitutionId) setSelectedInstitutionId(data.selectedInstitutionId);
        if (data.institutionQuery) setInstitutionQuery(data.institutionQuery);
        // Restore step (session effect will override to 1 if user isn't logged in and step is 0)
        if (typeof data.step === "number" && data.step > 0) {
          setStep(data.step);
        }
        // Don't restore password for security
      } catch (e) {
        console.error("Failed to load onboarding draft", e);
      }
    }
  }, []);

  // Persistence: Save draft on every change
  useEffect(() => {
    const data = {
      step,
      studyType,
      signupFirstName,
      signupLastName,
      signupEmail,
      signupPhone,
      gradeValue,
      selectedInstitutionId,
      institutionQuery,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [step, studyType, signupFirstName, signupLastName, signupEmail, signupPhone, gradeValue, selectedInstitutionId, institutionQuery]);
  const [useCustomInstitution, setUseCustomInstitution] = useState(false);
  const [studyStyle, setStudyStyle] = useState<"visual" | "text" | "mixed" | "">("");
  const [bestStudyTime, setBestStudyTime] = useState<"morning" | "afternoon" | "evening" | "night" | "">("");
  const [customInstitutionName, setCustomInstitutionName] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("1");
  const [selectedCampus, setSelectedCampus] = useState("");
  const [selectedCampusId, setSelectedCampusId] = useState("");
  const [selectedFaculty, setSelectedFaculty] = useState("");
  const [customFaculty, setCustomFaculty] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [useCustomCourse, setUseCustomCourse] = useState(false);
  const [customCourseName, setCustomCourseName] = useState("");
  const [schoolSubjects, setSchoolSubjects] = useState<SchoolSubjectOption[]>([]);
  const [manualModules, setManualModules] = useState<UniversityModule[]>([]);
  const [excludedAssumedModules, setExcludedAssumedModules] = useState<string[]>([]);
  const [manualModuleDraft, setManualModuleDraft] = useState("");
  const [exams, setExams] = useState<ExamEntry[]>([{ subject: "", date: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const [catalogInstitutionName, setCatalogInstitutionName] = useState("");
  const [catalogPeriodType, setCatalogPeriodType] = useState<CalendarFormat | null>(null);
  const [catalogAcademicUnitLabel, setCatalogAcademicUnitLabel] = useState<UniversityAcademicUnitLabel | null>(null);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const [availableCampuses, setAvailableCampuses] = useState<string[]>([]);
  const [availableFaculties, setAvailableFaculties] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<UniversityCourseCatalog[]>([]);

  useEffect(() => {
    if (session && step === 0) {
      setStep(1);
    } else if (!session) {
      setStep(0);
    }
  }, [session, step]);

  const groupedGrades = useMemo(
    () =>
      ["Foundation", "Intermediate", "Senior", "FET"].map((band) => ({
        band,
        grades: catalog.grades.filter((grade) => grade.band === band),
      })),
    [catalog.grades]
  );
  const selectedGrade = useMemo(
    () => catalog.grades.find((grade) => grade.key === gradeValue) ?? null,
    [catalog.grades, gradeValue]
  );
  const schoolOptions = useMemo(
    () =>
      selectedGrade
        ? selectedGrade.groups.flatMap((group) =>
            group.subjects.map((subject) => ({ key: subject.key, name: subject.name }))
          )
        : [],
    [selectedGrade]
  );
  const selectedInstitution = useMemo(
    () => institutions.find((item) => item.id === selectedInstitutionId) ?? null,
    [institutions, selectedInstitutionId]
  );
  const campusOptions = useMemo(() => {
    const seeded: CampusOption[] = (selectedInstitution?.campuses ?? []).map((campus) => ({
      id: campus.id,
      name: normalizeCampusName(campus.name),
      isPrimary: campus.isPrimary,
    }));
    const byName = new Map<string, CampusOption>(seeded.map((campus) => [campus.name, campus]));
    for (const campus of availableCampuses) {
      const normalizedName = normalizeCampusName(campus);
      if (!byName.has(normalizedName)) {
        byName.set(normalizedName, {
          id: "",
          name: normalizedName,
          isPrimary: false,
        });
      }
    }
    return Array.from(byName.values()).sort((left, right) => {
      if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
  }, [availableCampuses, selectedInstitution?.campuses]);
  const filteredInstitutions = useMemo(() => {
    const query = institutionQuery.trim().toLowerCase();
    return (query ? institutions.filter((item) => item.name.toLowerCase().includes(query)) : institutions).slice(0, 12);
  }, [institutionQuery, institutions]);
  const institutionLookupName = useMemo(() => {
    if (useCustomInstitution) return customInstitutionName.trim();
    return selectedInstitution?.name ?? "";
  }, [customInstitutionName, selectedInstitution?.name, useCustomInstitution]);

  useEffect(() => {
    if (studyType !== "university" || !institutionLookupName) {
      setCatalogInstitutionName("");
      setCatalogPeriodType(null);
      setCatalogAcademicUnitLabel(null);
      setCatalogNote(null);
      setAvailableCampuses([]);
      setSelectedCampusId("");
      setAvailableFaculties([]);
      setAvailableCourses([]);
      setCatalogError(null);
      setCatalogLoading(false);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const params = new URLSearchParams({ institution: institutionLookupName });
    if (selectedFaculty.trim()) params.set("faculty", selectedFaculty.trim());
    if (selectedCampus.trim()) params.set("campus", selectedCampus.trim());

    setCatalogLoading(true);
    setCatalogError(null);

    void fetch(`/api/onboarding/university-catalog?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as UniversityCatalogResponse | null;
        if (!response.ok || !data) {
          throw new Error("Unable to load yearbook-backed university data.");
        }
        if (!active) return;
        setCatalogInstitutionName(data.institutionName || institutionLookupName);
        setCatalogPeriodType(data.academicPeriodType ?? null);
        setCatalogAcademicUnitLabel(data.academicUnitLabel ?? null);
        setCatalogNote(data.note ?? null);
        setAvailableCampuses((data.campuses ?? []).map(normalizeCampusName));
        setAvailableFaculties(data.faculties ?? []);
        setAvailableCourses(data.courses ?? []);
        if (selectedFaculty && data.faculties.length > 0 && !data.faculties.includes(selectedFaculty)) {
          setSelectedFaculty("");
        }
        if (
          selectedCampus &&
          data.campuses.length > 0 &&
          !data.campuses.map(normalizeCampusName).includes(normalizeCampusName(selectedCampus))
        ) {
          setSelectedCampus("");
          setSelectedCampusId("");
        }
      })
      .catch((fetchError) => {
        if (!active || controller.signal.aborted) return;
        setCatalogInstitutionName("");
        setCatalogPeriodType(null);
        setCatalogAcademicUnitLabel(null);
        setCatalogNote(null);
        setAvailableCampuses([]);
        setAvailableFaculties([]);
        setAvailableCourses([]);
        setCatalogError(fetchError instanceof Error ? fetchError.message : "Unable to load yearbook-backed university data.");
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [institutionLookupName, selectedCampus, selectedFaculty, studyType]);

  useEffect(() => {
    if (!selectedCampus) {
      setSelectedCampusId("");
      return;
    }
    const matchingCampus = (selectedInstitution?.campuses ?? []).find(
      (campus) => normalizeCampusName(campus.name) === normalizeCampusName(selectedCampus)
    );
    setSelectedCampusId(matchingCampus?.id ?? "");
  }, [selectedCampus, selectedInstitution?.campuses]);

  useEffect(() => {
    if (!selectedCourseId) return;
    const stillExists = availableCourses.some((course) => course.id === selectedCourseId);
    if (!stillExists) {
      setSelectedCourseId("");
      setExcludedAssumedModules([]);
    }
  }, [availableCourses, selectedCourseId]);

  const academicUnitLabel = catalogAcademicUnitLabel ?? selectedInstitution?.academicUnitLabel ?? "Faculty";
  const resolvedFaculty = (selectedFaculty || customFaculty).trim();
  const resolvedPeriodType = catalogPeriodType ?? selectedInstitution?.academicPeriodType ?? "semester";
  const resolvedInstitutionName =
    catalogInstitutionName ||
    (selectedInstitution?.name?.includes("North-West University") ? "North-West University" : selectedInstitution?.name) ||
    customInstitutionName.trim();
  const selectedCourse = useMemo(
    () => availableCourses.find((course) => course.id === selectedCourseId) ?? null,
    [availableCourses, selectedCourseId]
  );
  useEffect(() => {
    if (!selectedCourse?.durationYears) return;
    if (Number(yearOfStudy) <= selectedCourse.durationYears) return;
    setYearOfStudy(String(selectedCourse.durationYears));
    setExcludedAssumedModules([]);
  }, [selectedCourse?.durationYears, yearOfStudy]);

  const assumedModules = useMemo(() => {
    if (!selectedCourseId) return [];
    return (selectedCourse?.modules ?? [])
      .filter((module) => module.yearOfStudy === Number(yearOfStudy))
      .map((module) => ({
        ...module,
        semester: module.semester ?? null,
        credits: typeof module.credits === "number" ? module.credits : null,
        isCore: typeof module.isCore === "boolean" ? module.isCore : null,
        durationType: module.durationType ?? null,
        durationLabel: module.durationLabel ?? null,
        assumed: true,
        source: "yearbook" as const,
      }));
  }, [selectedCourse, selectedCourseId, yearOfStudy]);
  const activeAssumedModules = useMemo(
    () => assumedModules.filter((module) => !excludedAssumedModules.includes(moduleIdentity(module))),
    [assumedModules, excludedAssumedModules]
  );
  const allUniversityModules = useMemo(
    () => dedupeModules([...activeAssumedModules, ...manualModules]),
    [activeAssumedModules, manualModules]
  );
  const moduleGroups = useMemo(() => {
    const buckets = new Map<string, UniversityModule[]>();
    for (const mod of allUniversityModules) {
      const label = mod.semester === 1 ? "Semester 1" : mod.semester === 2 ? "Semester 2" : "Additional modules";
      const current = buckets.get(label) ?? [];
      current.push(mod);
      buckets.set(label, current);
    }
    return Array.from(buckets.entries());
  }, [allUniversityModules]);
  const selectedSubjectNames = useMemo(
    () => (studyType === "school" ? schoolSubjects.map((subject) => subject.name) : allUniversityModules.map(buildSubjectLabel)),
    [allUniversityModules, schoolSubjects, studyType]
  );
  const universitySubjectCodes = useMemo(() => allUniversityModules.map((module) => module.code), [allUniversityModules]);
  const resolvedCourseName = selectedCourse?.name ?? customCourseName.trim();
  const hasUniversityModulePlan = allUniversityModules.length > 0;
  const availableYearOptions = useMemo(() => {
    const maxYear = selectedCourse?.durationYears && selectedCourse.durationYears > 0 ? selectedCourse.durationYears : 6;
    return Array.from({ length: maxYear }, (_, index) => index + 1);
  }, [selectedCourse?.durationYears]);
  const schoolLessonPlan = useMemo(
    () =>
      selectedGrade
        ? planSchoolLessonGeneration({
            grade: selectedGrade.number,
            phase: getPhaseLabel(selectedGrade),
            subjects: schoolSubjects,
          })
        : null,
    [schoolSubjects, selectedGrade]
  );
  const universityLessonPlan = useMemo(
    () =>
      resolvedInstitutionName && resolvedFaculty && resolvedCourseName
        ? planUniversityLessonGeneration({
            institution: resolvedInstitutionName,
            faculty: resolvedFaculty,
            course: resolvedCourseName,
            yearOfStudy: Number(yearOfStudy),
            modules: allUniversityModules,
          })
        : null,
    [allUniversityModules, resolvedCourseName, resolvedFaculty, resolvedInstitutionName, yearOfStudy]
  );
  const currentYearModuleCount = assumedModules.length;
  const currentYearSemesterCount = new Set(
    assumedModules.map((module) => (module.semester === 1 || module.semester === 2 ? module.semester : "other"))
  ).size;

  useEffect(() => {
    if (!navigationTarget) return;
    startNavigation(() => {
      router.replace(navigationTarget);
    });
  }, [navigationTarget, router, startNavigation]);

  const signupStepValid =
    signupFirstName.trim().length > 0 &&
    signupLastName.trim().length > 0 &&
    signupEmail.trim().includes("@") &&
    signupPhone.trim().length >= 7 &&
    signupStudentNumber.trim().length > 0 &&
    signupPassword.length >= 8;

  const stepOneValid =
    studyType === "school"
      ? Boolean(selectedGrade)
      : Boolean(studyType === "university" && resolvedInstitutionName);
  const stepTwoValid =
    studyType === "school"
      ? schoolSubjects.length > 0
      : Boolean(resolvedFaculty && resolvedCourseName && yearOfStudy);

  const toggleSchoolSubject = (subject: SchoolSubjectOption) => {
    setSchoolSubjects((current) =>
      current.some((item) => item.key === subject.key)
        ? current.filter((item) => item.key !== subject.key)
        : current.length >= 8
          ? current
          : [...current, subject]
    );
  };

  const addManualModule = () => {
    const parsed = parseManualModule(manualModuleDraft, Number(yearOfStudy));
    if (!parsed) return;
    setManualModules((current) => dedupeModules([...current, parsed]));
    setManualModuleDraft("");
  };

  const toggleAssumedModule = (module: UniversityModule) => {
    const key = moduleIdentity(module);
    setExcludedAssumedModules((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const removeManualModule = (moduleCode: string) => {
    setManualModules((current) => current.filter((module) => module.code !== moduleCode));
  };

  const handleSignupContinue = async () => {
    if (signupSubmitting || !signupStepValid) return;
    setSignupSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: signupFirstName.trim(),
          lastName: signupLastName.trim(),
          email: signupEmail.trim().toLowerCase(),
          phone: signupPhone.trim(),
          password: signupPassword,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setSignupConflict(true);
          throw new Error("That email is already registered. Sign in, then continue onboarding.");
        }
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Unable to create your account right now.");
      }

      await refresh();
      setStep(1);
    } catch (signupError) {
      setError(getApiErrorMessage(signupError, "Unable to create your account right now."));
    } finally {
      setSignupSubmitting(false);
    }
  };

  const handleSignupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSignupContinue();
  };

  const handleSubmit = async (skipExams: boolean, action: "papers" | "tutor" | "learn" = "learn") => {
    if (!studyType || submitting) return;
    setSubmitting(true);
    setError(null);
    let shouldKeepSubmitting = true;
    const examDates = skipExams
      ? []
      : exams.map((entry) => ({ subject: entry.subject.trim(), date: entry.date })).filter((entry) => entry.subject && entry.date);

    const payload = {
      studyType,
      ...(studyType === "school"
        ? {
            grade: selectedGrade?.number,
            phase: getPhaseLabel(selectedGrade),
            subjects: schoolSubjects.map((subject) => subject.name),
            selectedSubjectLabels: schoolSubjects.map((subject) => subject.name),
            subjectKeys: schoolSubjects.map((subject) => subject.key),
          }
        : {
            institutionId: selectedInstitution?.id ?? null,
            plannerUniversityId: selectedInstitution?.plannerUniversityId ?? null,
            institution: resolvedInstitutionName,
            campus: selectedCampus || null,
            campusId: selectedCampusId || null,
            academicPeriodType: resolvedPeriodType,
            yearOfStudy: Number(yearOfStudy),
            faculty: resolvedFaculty,
            course: resolvedCourseName,
            courseId: selectedCourse?.id ?? null,
            courseCode: selectedCourse?.qualificationCode ?? null,
            studentNumber: signupStudentNumber.trim() || null,
            subjects: universitySubjectCodes,
            selectedSubjectLabels: allUniversityModules.map(buildSubjectLabel),
            modulePlan: allUniversityModules,
          }),
      examDates,
      personalisation: {
        studyStyle,
        bestStudyTime,
      },
      studentNumber: signupStudentNumber.trim() || null,
    };

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        router.push("/auth?session_expired=true&next=/onboarding");
        router.refresh();
        return;
      }
      const responseBody = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(responseBody.error || "Unable to complete onboarding.");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(CALENDAR_FORMAT_STORAGE_KEY, studyType === "school" ? "term" : resolvedPeriodType);
      }

      const isSafeInternalPath = (v: string | null | undefined): v is string =>
        !!v && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\");
      const validatedReturnUrl = isSafeInternalPath(returnUrl) ? returnUrl : null;

      const destination = validatedReturnUrl ?? buildPostOnboardingHref({
        studyType,
        grade: selectedGrade,
        schoolSubjects,
        modules: allUniversityModules,
        action,
      });

      shouldKeepSubmitting = false;
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("school_onboarding_draft");
        document.cookie = "school_onboarding_complete=1; path=/; SameSite=Lax";
        // Defense-in-depth: never redirect to an unvalidated returnUrl, even if
        // a caller forgot to sanitize it. Only same-origin relative paths pass.
        const finalDestination = validatedReturnUrl ? safeReturnUrl(validatedReturnUrl, destination) : destination;
        const separator = finalDestination.includes("?") ? "&" : "?";
        setNavigationTarget(`${finalDestination}${separator}onboarding_complete=1`);
        return;
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to complete onboarding.");
    } finally {
      if (shouldKeepSubmitting) {
        setSubmitting(false);
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ display: "grid", gap: "20px", width: "100%", justifyItems: "center" }}>
        <ProgressDots step={step === 0 ? 1 : step} total={session ? 4 : 5} />

        {step === 0 ? (
          <SectionCard
            title="Create your SCHOOL account first."
            subtitle="Start with your core student details, then continue into the same onboarding flow you already had."
          >
            <form onSubmit={handleSignupSubmit}>
              <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <label style={{ display: "grid", gap: "8px" }}>
                  Name
                  <input value={signupFirstName} onChange={(event) => setSignupFirstName(event.target.value)} placeholder="e.g. Thandi" />
                </label>
                <label style={{ display: "grid", gap: "8px" }}>
                  Surname
                  <input value={signupLastName} onChange={(event) => setSignupLastName(event.target.value)} placeholder="e.g. Nkosi" />
                </label>
                <label style={{ display: "grid", gap: "8px" }}>
                  School email address
                  <input type="email" value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} placeholder="e.g. student@myuct.ac.za" />
                </label>
                <label style={{ display: "grid", gap: "8px" }}>
                  Contact number
                  <input type="tel" value={signupPhone} onChange={(event) => setSignupPhone(event.target.value)} placeholder="e.g. +27 82 123 4567" />
                </label>
                <label style={{ display: "grid", gap: "8px" }}>
                  Student number
                  <input
                    value={signupStudentNumber}
                    onChange={(event) => setSignupStudentNumber(event.target.value)}
                    placeholder="e.g. 12345678"
                    autoComplete="username"
                  />
                </label>
                <label style={{ display: "grid", gap: "8px" }}>
                  Create password
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                </label>
              </div>
              {error ? <div className="assistant-error">{error}</div> : null}
              <div style={{ display: "flex", justifyContent: signupConflict ? "space-between" : "flex-end", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                {signupConflict ? (
                  <Button variant="ghost" onClick={() => router.push(`/auth?next=/onboarding`)}>
                    Sign in to your account -&gt;
                  </Button>
                ) : null}
                <Button type="submit" variant="gold" disabled={!signupStepValid || signupSubmitting}>
                  {signupSubmitting ? "Creating account..." : "Continue into onboarding ->"}
                </Button>
              </div>
            </form>
          </SectionCard>
        ) : null}

        {step === 1 ? (
          <SectionCard title="Welcome to SCHOOL." subtitle="Let's personalise your experience.">
            <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              <button
                type="button"
                onClick={() => {
                  setStudyType("school");
                  setSelectedInstitutionId("");
                  setSelectedCampus("");
                  setError(null);
                }}
                style={{
                  padding: "28px",
                  borderRadius: "var(--r-xl)",
                  border: studyType === "school" ? "1px solid var(--gold)" : "1px solid var(--border)",
                  background: studyType === "school" ? "var(--gold-dim)" : "var(--surface)",
                  textAlign: "left",
                }}
              >
                <strong style={{ color: "var(--text-1)" }}>Grade R - 12</strong>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudyType("university");
                  setGradeValue("");
                  setSchoolSubjects([]);
                  setError(null);
                }}
                style={{
                  padding: "28px",
                  borderRadius: "var(--r-xl)",
                  border: studyType === "university" ? "1px solid var(--gold)" : "1px solid var(--border)",
                  background: studyType === "university" ? "var(--gold-dim)" : "var(--surface)",
                  textAlign: "left",
                }}
              >
                <strong style={{ color: "var(--text-1)" }}>University</strong>
              </button>
            </div>

            {studyType === "school" ? (
              <label style={{ display: "grid", gap: "8px" }}>
                Grade
                <select
                  value={gradeValue}
                  onChange={(event) => {
                    setGradeValue(event.target.value);
                    setSchoolSubjects([]);
                  }}
                >
                  <option value="">Select your grade</option>
                  {groupedGrades.map((group) => (
                    <optgroup key={group.band} label={`${group.band} Phase`}>
                      {group.grades.map((grade) => (
                        <option key={grade.key} value={grade.key}>
                          {grade.number === 0 ? "Grade R" : `Grade ${grade.number}`}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            ) : null}

            {studyType === "university" ? (
              <div style={{ display: "grid", gap: "16px" }}>
                <label style={{ display: "grid", gap: "8px" }}>
                  University
                  <input value={institutionQuery} onChange={(event) => setInstitutionQuery(event.target.value)} placeholder="Search your university" />
                </label>
                <div
                  style={{
                    display: "grid",
                    gap: "8px",
                    maxHeight: "220px",
                    overflowY: "auto",
                    padding: "12px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  {filteredInstitutions.map((institution) => (
                    <button
                      key={institution.id}
                      type="button"
                      onClick={() => {
                        setSelectedInstitutionId(institution.id);
                        setUseCustomInstitution(false);
                        setCustomInstitutionName("");
                        setSelectedCampus("");
                        setSelectedCampusId("");
                        setSelectedFaculty("");
                        setCustomFaculty("");
                        setSelectedCourseId("");
                        setUseCustomCourse(false);
                        setCustomCourseName("");
                        setManualModules([]);
                        setExcludedAssumedModules([]);
                      }}
                      style={{
                        textAlign: "left",
                        padding: "12px 14px",
                        borderRadius: "var(--r-md)",
                        border:
                          institution.id === selectedInstitutionId && !useCustomInstitution
                            ? "1px solid var(--gold-border)"
                            : "1px solid var(--border)",
                        background:
                          institution.id === selectedInstitutionId && !useCustomInstitution
                            ? "var(--gold-dim)"
                            : "transparent",
                      }}
                    >
                      <strong style={{ color: "var(--text-1)" }}>{institution.name}</strong>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomInstitution(true);
                    setSelectedInstitutionId("");
                    setSelectedCampus("");
                    setSelectedCampusId("");
                    setSelectedFaculty("");
                    setSelectedCourseId("");
                  }}
                  style={{
                    justifySelf: "start",
                    color: useCustomInstitution ? "var(--gold)" : "var(--text-2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                  }}
                >
                  My university isn't listed
                </button>
                {useCustomInstitution ? (
                  <label style={{ display: "grid", gap: "8px" }}>
                    Institution name
                    <input value={customInstitutionName} onChange={(event) => setCustomInstitutionName(event.target.value)} placeholder="Enter your university name" />
                  </label>
                ) : null}
                {(selectedInstitution || useCustomInstitution) ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                    <PeriodBadge label={formatPeriodLabel(resolvedPeriodType)} />
                    {catalogNote || selectedInstitution?.note ? <span className="text-dim">{catalogNote ?? selectedInstitution?.note}</span> : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? <div className="assistant-error">{error}</div> : null}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="gold" disabled={!stepOneValid} onClick={() => setStep(2)}>
                Continue -&gt;
              </Button>
            </div>
          </SectionCard>
        ) : null}

        {step === 2 ? (
          <SectionCard
            title={studyType === "school" ? "What are you studying?" : "Choose your faculty, course, and modules."}
            subtitle={
              studyType === "school"
                ? "Select your subjects so we can personalise your resources and quiz topics."
                : "We will use your institution, campus, faculty, course, and year to assume your current modules and semester load."
            }
          >
            {studyType === "school" ? (
              <div style={{ display: "grid", gap: "16px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {schoolOptions.map((subject) => {
                    const selected = schoolSubjects.some((item) => item.key === subject.key);
                    return (
                      <button
                        key={subject.key}
                        type="button"
                        onClick={() => toggleSchoolSubject(subject)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "999px",
                          border: selected ? "1px solid var(--gold-border)" : "1px solid var(--border)",
                          background: selected ? "var(--gold-dim)" : "var(--surface-2)",
                          color: selected ? "var(--gold)" : "var(--text-2)",
                        }}
                      >
                        {subject.name}
                      </button>
                    );
                  })}
                </div>
                {schoolLessonPlan && schoolLessonPlan.targets.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      padding: "16px",
                      borderRadius: "var(--r-lg)",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <strong style={{ color: "var(--text-1)" }}>Lesson generation targets</strong>
                    <span className="text-dim" style={{ fontSize: "12px" }}>
                      {schoolLessonPlan.summary}
                    </span>
                    <code style={{ fontSize: "12px", wordBreak: "break-word" }}>{schoolLessonPlan.storageRoot}</code>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "18px" }}>
                {catalogLoading ? <div className="text-dim">Loading yearbook-backed university data...</div> : null}
                {catalogError ? <div className="assistant-error">{catalogError}</div> : null}

                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  {campusOptions.length > 0 ? (
                    <label style={{ display: "grid", gap: "8px" }}>
                      Campus
                      <select
                        value={selectedCampus}
                        onChange={(event) => {
                          const nextCampus = normalizeCampusName(event.target.value);
                          const matchingCampus = campusOptions.find((campus) => campus.name === nextCampus);
                          setSelectedCampus(nextCampus);
                          setSelectedCampusId(matchingCampus?.id ?? "");
                          setSelectedCourseId("");
                          setUseCustomCourse(false);
                          setCustomCourseName("");
                          setManualModules([]);
                          setExcludedAssumedModules([]);
                        }}
                      >
                        <option value="">Select your campus</option>
                        {campusOptions.map((campus) => (
                          <option key={campus.id || campus.name} value={campus.name}>
                            {campus.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {availableFaculties.length > 0 ? (
                    <label style={{ display: "grid", gap: "8px" }}>
                      {academicUnitLabel}
                      <select
                        value={selectedFaculty}
                        onChange={(event) => {
                          setSelectedFaculty(event.target.value);
                          setSelectedCourseId("");
                          setUseCustomCourse(false);
                          setCustomCourseName("");
                          setManualModules([]);
                          setExcludedAssumedModules([]);
                        }}
                      >
                        <option value="">Select your {academicUnitLabel.toLowerCase()}</option>
                        {availableFaculties.map((facultyOption) => (
                          <option key={facultyOption} value={facultyOption}>
                            {facultyOption}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label style={{ display: "grid", gap: "8px" }}>
                    {availableFaculties.length > 0 ? `${academicUnitLabel} (custom if different)` : academicUnitLabel}
                    <input value={customFaculty} onChange={(event) => setCustomFaculty(event.target.value)} placeholder="Optional custom faculty / college" />
                  </label>
                </div>

                <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "minmax(0, 1fr) minmax(220px, 240px)" }}>
                  <label style={{ display: "grid", gap: "8px" }}>
                    Course / Programme
                    <select
                      value={selectedCourseId}
                      onChange={(event) => {
                        setSelectedCourseId(event.target.value);
                        setUseCustomCourse(false);
                        setCustomCourseName("");
                        setManualModules([]);
                        setExcludedAssumedModules([]);
                      }}
                      disabled={!resolvedFaculty || availableCourses.length === 0}
                    >
                      <option value="">
                        {availableCourses.length > 0
                          ? "Select your course"
                          : resolvedFaculty
                            ? "No yearbook-backed courses available yet"
                            : "Select a campus and faculty first"}
                      </option>
                      {availableCourses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                          {course.qualificationCode ? ` (${course.qualificationCode})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "8px" }}>
                    Year of study
                    <select
                      value={yearOfStudy}
                      onChange={(event) => {
                        setYearOfStudy(event.target.value);
                        setExcludedAssumedModules([]);
                      }}
                    >
                      {availableYearOptions.map((year) => (
                        <option key={year} value={year}>
                          Year {year}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomCourse(true);
                      setSelectedCourseId("");
                      setExcludedAssumedModules([]);
                    }}
                    style={{
                      justifySelf: "start",
                      color: useCustomCourse ? "var(--gold)" : "var(--text-2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                    }}
                  >
                    My course isn't listed
                  </button>
                  {useCustomCourse ? (
                    <label style={{ display: "grid", gap: "8px" }}>
                      Course / Programme name
                      <input value={customCourseName} onChange={(event) => setCustomCourseName(event.target.value)} placeholder="Enter your course or programme name" />
                    </label>
                  ) : null}
                </div>

                {(resolvedInstitutionName || resolvedFaculty || resolvedCourseName) ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "10px",
                      padding: "16px",
                      borderRadius: "var(--r-lg)",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <strong style={{ color: "var(--text-1)" }}>Current-year module plan context</strong>
                    <span className="text-dim" style={{ fontSize: "12px" }}>
                      {resolvedInstitutionName || "Institution pending"}
                      {resolvedFaculty ? ` / ${resolvedFaculty}` : ""}
                      {resolvedCourseName ? ` / ${resolvedCourseName}` : ""}
                      {` / Year ${yearOfStudy}`}
                      {selectedCourse?.durationYears ? ` of ${selectedCourse.durationYears}` : ""}
                    </span>
                    <span className="text-dim" style={{ fontSize: "12px" }}>
                      {selectedCourse
                        ? `This flow assumes your Year ${yearOfStudy} modules from the selected course, then lets you remove or add modules before saving.`
                        : "Choose a yearbook-backed course to infer your current-year module plan, or continue with a custom course and add modules manually."}
                    </span>
                    {selectedCourse ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        <span className="ui-badge ui-badge--neutral">{currentYearModuleCount} inferred modules</span>
                        <span className="ui-badge ui-badge--neutral">
                          {currentYearSemesterCount > 1 ? "Multi-period year plan" : "Single-period year plan"}
                        </span>
                      </div>
                    ) : null}
                    {universityLessonPlan ? (
                      <code style={{ fontSize: "12px", wordBreak: "break-word" }}>{universityLessonPlan.storageRoot}</code>
                    ) : null}
                  </div>
                ) : null}

                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                    <strong style={{ color: "var(--text-1)" }}>Assumed module plan</strong>
                    {excludedAssumedModules.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExcludedAssumedModules([])}
                        style={{
                          color: "var(--gold)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "11px",
                          textTransform: "uppercase",
                        }}
                      >
                        Restore removed yearbook modules
                      </button>
                    ) : null}
                  </div>
                  {selectedCourse || hasUniversityModulePlan ? (
                    <p className="text-dim" style={{ margin: 0, fontSize: "12px" }}>
                      Review the inferred plan before saving. Remove anything you are not taking now, then add repeats or electives below.
                    </p>
                  ) : null}
                  {hasUniversityModulePlan ? (
                    <div style={{ display: "grid", gap: "12px" }}>
                      {moduleGroups.map(([label, modules]) => (
                        <div
                          key={label}
                          style={{
                            display: "grid",
                            gap: "8px",
                            padding: "16px",
                            borderRadius: "var(--r-lg)",
                            border: "1px solid var(--border)",
                            background: "var(--surface-2)",
                          }}
                        >
                          <strong style={{ color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>{label}</strong>
                          {modules.map((module) => (
                            <div
                              key={`${label}-${module.code}-${module.source}`}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: "12px",
                                flexWrap: "wrap",
                                padding: "10px 12px",
                                borderRadius: "var(--r-md)",
                                border: "1px solid var(--border)",
                                background: module.assumed ? "var(--surface)" : "var(--surface-3)",
                              }}
                            >
                              <div style={{ display: "grid", gap: "6px", minWidth: 0 }}>
                                <strong style={{ color: "var(--text-1)" }}>{module.code}</strong>
                                <span className="text-muted">{module.name}</span>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                  <span className="ui-badge ui-badge--neutral">{formatModuleDuration(module)}</span>
                                  {module.credits !== null ? <span className="ui-badge ui-badge--neutral">{module.credits} credits</span> : null}
                                  {module.isCore !== null ? (
                                    <span className={`ui-badge ${module.isCore ? "ui-badge--gold" : "ui-badge--amber"}`}>
                                      {module.isCore ? "Core" : "Elective"}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div style={{ display: "grid", justifyItems: "end", gap: "6px" }}>
                                <span className="text-dim" style={{ fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                                  {module.assumed ? "Yearbook" : "Manual"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => (module.assumed ? toggleAssumedModule(module) : removeManualModule(module.code))}
                                  style={{
                                    color: module.assumed ? "var(--amber)" : "var(--red)",
                                    fontFamily: "var(--font-mono)",
                                    fontSize: "11px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state" style={{ padding: "24px" }}>
                      <div className="empty-state-title">No assumed modules yet</div>
                      <div className="empty-state-desc">
                        Select a yearbook-backed course to infer modules, or add repeat and elective modules manually.
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: "10px" }}>
                  <strong style={{ color: "var(--text-1)" }}>Add repeat / elective modules</strong>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <input
                      value={manualModuleDraft}
                      onChange={(event) => setManualModuleDraft(event.target.value)}
                      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addManualModule();
                        }
                      }}
                      placeholder="e.g. ECON211 or ECON211 - Microeconomics"
                      style={{ flex: "1 1 280px" }}
                    />
                    <Button variant="gold" onClick={addManualModule} disabled={!manualModuleDraft.trim()}>
                      + Add
                    </Button>
                  </div>
                </div>
                {universityLessonPlan && universityLessonPlan.targets.length > 0 ? (
                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      padding: "16px",
                      borderRadius: "var(--r-lg)",
                      border: "1px solid var(--border)",
                      background: "var(--surface-2)",
                    }}
                  >
                    <strong style={{ color: "var(--text-1)" }}>Lesson generation targets</strong>
                    <span className="text-dim" style={{ fontSize: "12px" }}>
                      {universityLessonPlan.summary}
                    </span>
                    <code style={{ fontSize: "12px", wordBreak: "break-word" }}>{universityLessonPlan.storageRoot}</code>
                  </div>
                ) : null}
              </div>
            )}

            {error ? <div className="assistant-error">{error}</div> : null}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="gold" disabled={!stepTwoValid || catalogLoading} onClick={() => setStep(3)}>
                Continue -&gt;
              </Button>
            </div>
          </SectionCard>
        ) : null}

        {step === 3 ? (
          <SectionCard title="Add your upcoming exams." subtitle="SCHOOL will count down to each exam and focus your daily quiz on relevant topics.">
            <span style={{ color: "var(--text-3)", fontSize: "11px", fontStyle: "italic" }}>Optional - you can skip this step</span>
            <div style={{ display: "grid", gap: "12px" }}>
              {exams.map((entry, index) => (
                <div
                  key={`${index}-${entry.subject}-${entry.date}`}
                  style={{
                    display: "grid",
                    gap: "12px",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    padding: "16px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                  }}
                >
                  <label style={{ display: "grid", gap: "8px" }}>
                    Subject
                    <select
                      value={entry.subject}
                      onChange={(event) =>
                        setExams((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, subject: event.target.value } : item
                          )
                        )
                      }
                    >
                      <option value="">Select a subject</option>
                      {selectedSubjectNames.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: "8px" }}>
                    Date
                    <input
                      type="date"
                      value={entry.date}
                      onChange={(event) =>
                        setExams((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, date: event.target.value } : item
                          )
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            {exams.length < 3 ? (
              <Button variant="ghost" onClick={() => setExams((current) => [...current, { subject: "", date: "" }])}>
                + Add another exam
              </Button>
            ) : null}
            {error ? <div className="assistant-error">{error}</div> : null}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => setStep(2)} disabled={submitting}>
                  Back
                </Button>
                <Button variant="ghost" onClick={() => void setStep(4)} disabled={submitting || isNavigating}>
                  {isNavigating ? "Opening..." : "Skip for now"}
                </Button>
              </div>
              <Button variant="gold" onClick={() => setStep(4)} disabled={submitting || isNavigating}>
                Next: Study Insights -&gt;
              </Button>
            </div>
          </SectionCard>
        ) : null}

        {step === 4 ? (
          <SectionCard
            title="Almost there! Tell us how you study."
            subtitle="SCHOOL uses this to tailor your daily briefing and session recommendations."
          >
            <div style={{ display: "grid", gap: "20px" }}>
              <div style={{ display: "grid", gap: "10px" }}>
                <strong>What is your preferred study style?</strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(["visual", "text", "mixed"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setStudyStyle(style)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "var(--r-md)",
                        border: studyStyle === style ? "2px solid var(--gold)" : "1px solid var(--border)",
                        background: studyStyle === style ? "var(--gold-dim)" : "var(--surface)",
                        color: studyStyle === style ? "var(--gold)" : "var(--text-1)",
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                <strong>When are you most focused?</strong>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {(["morning", "afternoon", "evening", "night"] as const).map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setBestStudyTime(time)}
                      style={{
                        padding: "10px 16px",
                        borderRadius: "var(--r-md)",
                        border: bestStudyTime === time ? "2px solid var(--gold)" : "1px solid var(--border)",
                        background: bestStudyTime === time ? "var(--gold-dim)" : "var(--surface)",
                        color: bestStudyTime === time ? "var(--gold)" : "var(--text-1)",
                        cursor: "pointer",
                        textTransform: "capitalize",
                      }}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gap: "12px", padding: "20px", borderRadius: "12px", border: "1px dashed var(--border)", background: "var(--surface-2)" }}>
                <div>
                  <strong style={{ color: "var(--text-1)" }}>Data Saver Mode</strong>
                  <p className="text-dim" style={{ fontSize: "12px", marginTop: "4px" }}>
                    Enable Lite Mode to save data. This disables heavy animations and simplifies 3D character visuals—perfect for limited data connections.
                  </p>
                </div>
                <LiteModeToggle />
              </div>
            </div>

            {error ? <div className="assistant-error">{error}</div> : null}

            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginTop: "24px" }}>
              <Button variant="ghost" onClick={() => setStep(3)} disabled={submitting}>
                Back
              </Button>
              {isFetGrade(selectedGrade?.number) ? (
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <Button variant="gold" onClick={() => void handleSubmit(false, "papers")} disabled={submitting || isNavigating}>
                    {submitting ? "Saving..." : "Open a past paper"}
                  </Button>
                  <Button variant="outline" onClick={() => void handleSubmit(false, "tutor")} disabled={submitting || isNavigating}>
                    Ask the hybrid tutor
                  </Button>
                </div>
              ) : (
                <Button variant="gold" onClick={() => void handleSubmit(false)} disabled={submitting || isNavigating}>
                  {submitting ? "Saving..." : isNavigating ? "Opening..." : "Finish Onboarding ->"}
                </Button>
              )}
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}

export default OnboardingWizard;
