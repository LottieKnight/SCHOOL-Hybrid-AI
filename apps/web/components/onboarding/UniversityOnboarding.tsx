"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PENDING_TIMETABLE_SYNC_STORAGE_KEY } from "@/lib/plannerSync";
import type { PendingTimetableSyncPayload, UniversityCampusRecord, UniversityRecord } from "@/types/planner";

const NWU_FACULTIES = [
  "Economic and Management Sciences",
  "Engineering",
  "Health Sciences",
  "Humanities",
  "Law",
  "Natural and Agricultural Sciences",
  "Theology",
  "Education",
];

const QUALIFICATION_GROUPS = [
  {
    label: "Bachelor's Degrees",
    options: [
      "BCom (General)",
      "BCom Accounting",
      "BCom Economics",
      "BCom Economic Sciences",
      "BCom International Trade & Risk Management",
      "BCom Financial Management",
      "BCom Investment Management",
      "BCom Marketing Management",
      "BCom Human Resource Management",
      "BCom Business Management",
      "BCom Informatics",
      "BCom Information Technology",
      "BA (General)",
      "BA Law",
      "BA Languages",
      "BA Psychology",
      "BA Communication",
      "BA Social Work",
      "BSc (General)",
      "BSc Computer Science",
      "BSc Information Technology",
      "BSc Mathematics & Statistics",
      "BSc Physics",
      "BSc Chemistry",
      "BSc Biological Sciences",
      "BSc Agriculture",
      "BEng (Civil)",
      "BEng (Mechanical)",
      "BEng (Electrical)",
      "BEng (Chemical)",
      "BEng (Industrial)",
      "BEd (Foundation Phase)",
      "BEd (Intermediate Phase)",
      "BEd (Senior Phase & FET)",
      "BNurs",
      "LLB",
      "BPharm",
      "BDietetics",
      "BOccTher",
      "BPhysio",
    ],
  },
  {
    label: "Diploma & Advanced Diploma",
    options: [
      "Diploma in Accounting",
      "Diploma in Business Management",
      "Diploma in Marketing",
      "Diploma in HR Management",
      "Diploma in Public Administration",
      "Diploma in Information Technology",
      "Diploma in Engineering (Civil)",
      "Diploma in Engineering (Mechanical)",
      "Diploma in Engineering (Electrical)",
      "Advanced Diploma in Accounting",
      "Advanced Diploma in Business Management",
      "Advanced Diploma in Education",
      "Postgraduate Diploma in Education (PGCE)",
      "Postgraduate Diploma in Accounting (PGDA / CTA)",
    ],
  },
  {
    label: "Honours",
    options: [
      "BCom Honours (Accounting)",
      "BCom Honours (Economics)",
      "BCom Honours (Financial Management)",
      "BCom Honours (Risk Management)",
      "BCom Honours (Business Management)",
      "BA Honours",
      "BSc Honours",
      "BEd Honours",
      "LLB Honours",
    ],
  },
  {
    label: "Postgraduate",
    options: ["MCom", "MBA", "MPhil", "MSc", "MEd", "LLM", "PhD", "DCom"],
  },
] as const;

const NWU_FEMS_MODULE_SUGGESTIONS = [
  {
    label: "Year 1 Semester 1",
    items: [
      { code: "REKS111", semester: 1 as const },
      { code: "BMAN111", semester: 1 as const },
      { code: "ECON111", semester: 1 as const },
      { code: "FINS111", semester: 1 as const },
      { code: "OEBL111", semester: 1 as const },
    ],
  },
  {
    label: "Year 1 Semester 2",
    items: [
      { code: "REKS121", semester: 2 as const },
      { code: "BMAN121", semester: 2 as const },
      { code: "ECON121", semester: 2 as const },
      { code: "FINS121", semester: 2 as const },
      { code: "OEBL121", semester: 2 as const },
    ],
  },
  {
    label: "Year 2 Semester 1",
    items: [
      { code: "EKIP211", semester: 1 as const },
      { code: "EKRP211", semester: 1 as const },
      { code: "EKRP212", semester: 1 as const },
      { code: "FINS221", semester: 1 as const },
    ],
  },
  {
    label: "Year 2 Semester 2",
    items: [
      { code: "EKIP221", semester: 2 as const },
      { code: "EKRP221", semester: 2 as const },
      { code: "FINS222", semester: 2 as const },
    ],
  },
  {
    label: "Year 3",
    items: [
      { code: "EKIP311", semester: "both" as const },
      { code: "EKIP321", semester: "both" as const },
      { code: "EKRP311", semester: "both" as const },
      { code: "EKRP321", semester: "both" as const },
    ],
  },
] as const;

const NWU_MODULE_CODE_PATTERN = /^[A-Z]{4}\d{3}$/;
const QUALIFICATION_OPTIONS = QUALIFICATION_GROUPS.flatMap((group) => group.options);

type UniversityOnboardingProps = {
  universities: UniversityRecord[];
  campusesByUniversity: Record<string, UniversityCampusRecord[]>;
};

type ModuleDraft = {
  id: string;
  moduleCode: string;
  moduleName: string;
  semester: 1 | 2 | "both" | "";
};

type CompletionResponse = {
  success?: boolean;
  error?: string;
  pendingTimetableSync?: PendingTimetableSyncPayload | null;
};

type UniversityCatalogCourse = {
  id: string;
  name: string;
  qualificationCode?: string | null;
  faculty: string;
  campuses?: string[];
  modules: Array<{
    code: string;
    name: string;
    semester: number | null;
    yearOfStudy: number;
    credits?: number | null;
    isCore?: boolean | null;
    durationType?: "semester" | "year" | null;
    durationLabel?: string | null;
  }>;
};

type UniversityCatalogPayload = {
  institutionName: string;
  academicPeriodType: "term" | "semester" | "trimester" | "quarter";
  academicUnitLabel: string | null;
  campuses: string[];
  faculties: string[];
  courses: UniversityCatalogCourse[];
  note: string | null;
};

function createModuleDraft(
  index: number,
  defaults?: Partial<Pick<ModuleDraft, "moduleCode" | "moduleName" | "semester">>
): ModuleDraft {
  return {
    id: `module-${index}`,
    moduleCode: defaults?.moduleCode ?? "",
    moduleName: defaults?.moduleName ?? "",
    semester: defaults?.semester ?? "",
  };
}

function sortCampuses(left: UniversityCampusRecord, right: UniversityCampusRecord) {
  if (left.isPrimary !== right.isPrimary) {
    return left.isPrimary ? -1 : 1;
  }
  return left.campusName.localeCompare(right.campusName);
}

function normalizeModuleCode(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

function resolveQualificationValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const match = QUALIFICATION_OPTIONS.find((option) => option.toLowerCase() === trimmed.toLowerCase());
  return match ?? trimmed;
}

function ProgressDots({ step }: { step: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
      {[1, 2, 3].map((item) => (
        <span
          key={item}
          style={{
            width: item <= step ? "10px" : "7px",
            height: item <= step ? "10px" : "7px",
            borderRadius: "999px",
            background: item < step ? "var(--green)" : item === step ? "var(--gold)" : "var(--border-2)",
            transition: "all var(--t) var(--ease)",
          }}
        />
      ))}
    </div>
  );
}

function StepShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section
      className="animate-fade-up"
      style={{
        width: "min(760px, calc(100vw - 32px))",
        display: "grid",
        gap: "24px",
        padding: "28px",
        borderRadius: "var(--r-xl)",
        border: "1px solid var(--border)",
        background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
        boxShadow: "var(--sh-lg)",
      }}
    >
      <div style={{ display: "grid", gap: "10px" }}>
        <span
          style={{
            display: "inline-flex",
            width: "fit-content",
            padding: "6px 10px",
            borderRadius: "999px",
            border: "1px solid var(--gold-border)",
            background: "var(--gold-dim)",
            color: "var(--gold)",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </span>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: "32px", lineHeight: 1.1 }}>{title}</h1>
        <p style={{ margin: 0, color: "var(--text-2)", fontSize: "14px", lineHeight: 1.6 }}>{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export function UniversityOnboarding({ universities, campusesByUniversity }: UniversityOnboardingProps) {
  const router = useRouter();
  const qualificationBlurTimerRef = useRef<number | null>(null);
  const selectingQualificationRef = useRef(false);
  const [step, setStep] = useState(1);
  const [selectedUniversityId, setSelectedUniversityId] = useState("");
  const [selectedCampusId, setSelectedCampusId] = useState("");
  const [faculty, setFaculty] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("1");
  const [qualification, setQualification] = useState("");
  const [qualificationInput, setQualificationInput] = useState("");
  const [qualificationOpen, setQualificationOpen] = useState(false);
  const [studentNumber, setStudentNumber] = useState("");
  const [modules, setModules] = useState<ModuleDraft[]>([createModuleDraft(1)]);
  const [catalog, setCatalog] = useState<UniversityCatalogPayload | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [semesterHintLoadingById, setSemesterHintLoadingById] = useState<Record<string, boolean>>({});
  const [moduleWarning, setModuleWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedUniversity = universities.find((entry) => entry.id === selectedUniversityId) ?? null;
  const campuses = useMemo(
    () =>
      selectedUniversityId
        ? [...(campusesByUniversity[selectedUniversityId] ?? [])].sort(sortCampuses)
        : [],
    [campusesByUniversity, selectedUniversityId]
  );
  const selectedCampus = campuses.find((entry) => entry.id === selectedCampusId) ?? null;
  const hasSingleCampus = campuses.length === 1;
  const completedModuleCount = modules.filter((entry) => normalizeModuleCode(entry.moduleCode)).length;
  const currentModuleCodes = useMemo(
    () => new Set(modules.map((entry) => normalizeModuleCode(entry.moduleCode)).filter(Boolean)),
    [modules]
  );
  const showFemsQuickAdd =
    selectedUniversity?.shortCode === "NWU" &&
    faculty === "Economic and Management Sciences" &&
    (catalog?.courses.length ?? 0) === 0 &&
    completedModuleCount === 0;
  const availableFaculties = useMemo(() => {
    if (catalog?.faculties?.length) return catalog.faculties;
    if (selectedUniversity?.shortCode === "NWU") return NWU_FACULTIES;
    return [];
  }, [catalog?.faculties, selectedUniversity?.shortCode]);
  const matchingCourses = useMemo(() => {
    const selectedCampusName = selectedCampus?.campusName?.trim().toLowerCase();
    return (catalog?.courses ?? []).filter((course) => {
      const sameFaculty = faculty ? course.faculty === faculty : true;
      const sameCampus =
        !selectedCampusName ||
        !Array.isArray(course.campuses) ||
        course.campuses.length === 0 ||
        course.campuses.some((campus) => campus.trim().toLowerCase() === selectedCampusName);
      return sameFaculty && sameCampus;
    });
  }, [catalog?.courses, faculty, selectedCampus?.campusName]);
  const selectedCourse = useMemo(() => {
    const normalizedQualification = qualification.trim().toLowerCase();
    if (!normalizedQualification) return null;
    return (
      matchingCourses.find((course) => course.name.trim().toLowerCase() === normalizedQualification) ??
      matchingCourses.find((course) => (course.qualificationCode ?? "").trim().toLowerCase() === normalizedQualification) ??
      null
    );
  }, [matchingCourses, qualification]);
  const qualificationGroups = useMemo(() => {
    if (matchingCourses.length > 0) {
      const query = qualificationInput.trim().toLowerCase();
      const filtered = matchingCourses.filter((course) => {
        if (!query) return true;
        return (
          course.name.toLowerCase().includes(query) ||
          (course.qualificationCode ?? "").toLowerCase().includes(query)
        );
      });
      return filtered.length > 0
        ? [
            {
              label: faculty || catalog?.academicUnitLabel || "Qualifications",
              options: filtered.map((course) => course.name),
            },
          ]
        : [];
    }

    const query = qualificationInput.trim().toLowerCase();
    if (!query) return QUALIFICATION_GROUPS;
    return QUALIFICATION_GROUPS.map((group) => ({
      ...group,
      options: group.options.filter((option) => option.toLowerCase().includes(query)),
    })).filter((group) => group.options.length > 0);
  }, [catalog?.academicUnitLabel, faculty, matchingCourses, qualificationInput]);

  useEffect(() => {
    if (!selectedUniversityId) {
      setSelectedCampusId("");
      return;
    }

    const nextCampus =
      campuses.find((campus) => campus.id === selectedCampusId) ??
      campuses.find((campus) => campus.isPrimary) ??
      campuses[0] ??
      null;

    setSelectedCampusId(nextCampus?.id ?? "");
  }, [campuses, selectedCampusId, selectedUniversityId]);

  useEffect(() => {
    return () => {
      if (qualificationBlurTimerRef.current) {
        window.clearTimeout(qualificationBlurTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedUniversity?.name) {
      setCatalog(null);
      return;
    }

    let active = true;
    setCatalogLoading(true);
    const params = new URLSearchParams({
      institution: selectedUniversity.name,
    });
    if (selectedCampus?.campusName) {
      params.set("campus", selectedCampus.campusName);
    }
    if (faculty) {
      params.set("faculty", faculty);
    }

    fetch(`/api/onboarding/university-catalog?${params.toString()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json().catch(() => null)) as UniversityCatalogPayload | null;
      })
      .then((payload) => {
        if (!active) return;
        setCatalog(payload);
      })
      .catch(() => {
        if (active) setCatalog(null);
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    return () => {
      active = false;
    };
  }, [faculty, selectedCampus?.campusName, selectedUniversity?.name]);

  useEffect(() => {
    if (!selectedCourse) return;
    const year = Number(yearOfStudy) || 1;
    const courseModules = selectedCourse.modules.filter((module) => module.yearOfStudy === year);
    if (courseModules.length === 0) return;

    setModules(
      courseModules.slice(0, 12).map((module, index) =>
        createModuleDraft(index + 1, {
          moduleCode: module.code,
          moduleName: module.name,
          semester: module.semester === 1 || module.semester === 2 ? module.semester : "both",
        })
      )
    );
  }, [selectedCourse, yearOfStudy]);

  function updateModule(id: string, patch: Partial<ModuleDraft>) {
    setModules((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }

  function addModule() {
    setModuleWarning(null);
    setModules((current) => (current.length >= 12 ? current : [...current, createModuleDraft(current.length + 1)]));
  }

  function removeModule(id: string) {
    setModuleWarning(null);
    setModules((current) => {
      if (current.length === 1) {
        return [createModuleDraft(1)];
      }
      return current.filter((entry) => entry.id !== id);
    });
  }

  function commitQualification(rawValue: string) {
    const resolved = resolveQualificationValue(rawValue);
    setQualification(resolved);
    setQualificationInput(resolved);
    setQualificationOpen(false);
  }

  function handleQualificationKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitQualification(qualificationInput);
      return;
    }

    if (event.key === "Escape") {
      setQualificationOpen(false);
    }
  }

  function findDuplicateModuleCode(moduleId: string, moduleCode: string) {
    const normalized = normalizeModuleCode(moduleCode);
    if (!normalized) return null;

    return modules.find(
      (entry) => entry.id !== moduleId && normalizeModuleCode(entry.moduleCode).toLowerCase() === normalized.toLowerCase()
    );
  }

  async function maybePrefillSemester(moduleId: string, moduleCode: string) {
    if (!selectedUniversityId || !NWU_MODULE_CODE_PATTERN.test(moduleCode)) {
      return;
    }

    const currentModule = modules.find((entry) => entry.id === moduleId);
    if (!currentModule || currentModule.semester !== "") {
      return;
    }

    setSemesterHintLoadingById((current) => ({ ...current, [moduleId]: true }));

    try {
      const params = new URLSearchParams({
        module_code: moduleCode,
        university_id: selectedUniversityId,
      });
      const response = await fetch(`/api/modules/semester-hint?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = (await response.json()) as { semester: 1 | 2 | null; found: boolean };
      if ((data.semester === 1 || data.semester === 2) && (modules.find((entry) => entry.id === moduleId)?.semester ?? "") === "") {
        updateModule(moduleId, { semester: data.semester });
      }
    } catch {
      return;
    } finally {
      setSemesterHintLoadingById((current) => {
        const next = { ...current };
        delete next[moduleId];
        return next;
      });
    }
  }

  async function handleModuleCodeBlur(moduleId: string, rawValue?: string) {
    const targetModule = modules.find((entry) => entry.id === moduleId);
    if (!targetModule && rawValue == null) return;

    const normalized = normalizeModuleCode(rawValue ?? targetModule?.moduleCode ?? "");
    updateModule(moduleId, { moduleCode: normalized });

    if (!normalized) {
      setModuleWarning(null);
      return;
    }

    const duplicate = findDuplicateModuleCode(moduleId, normalized);
    if (duplicate) {
      setModuleWarning(`${normalized} is already in your list`);
      updateModule(moduleId, { moduleCode: "", moduleName: "" });
      return;
    }

    setModuleWarning(null);
    await maybePrefillSemester(moduleId, normalized);
  }

  function handleQuickAddModule(moduleCode: string, semester: ModuleDraft["semester"]) {
    const normalized = normalizeModuleCode(moduleCode);
    if (currentModuleCodes.has(normalized)) {
      setModuleWarning(`${normalized} is already in your list`);
      return;
    }

    setModuleWarning(null);
    setModules((current) => {
      const emptySlotIndex = current.findIndex((entry) => !normalizeModuleCode(entry.moduleCode));
      if (emptySlotIndex >= 0) {
        return current.map((entry, index) =>
          index === emptySlotIndex ? { ...entry, moduleCode: normalized, semester } : entry
        );
      }

      if (current.length >= 12) {
        return current;
      }

      return [...current, createModuleDraft(current.length + 1, { moduleCode: normalized, semester })];
    });
  }

  async function completeOnboarding(includeModules: boolean) {
    if (!selectedUniversity || !selectedCampus) {
      setError("Choose your university and campus before continuing.");
      return;
    }

    setSaving(true);
    setError(null);

    const modulePlan = includeModules
      ? modules
          .map((entry) => {
            const code = normalizeModuleCode(entry.moduleCode);
            return {
              code,
              name: entry.moduleName.trim() || code,
              semester: entry.semester === "" ? null : entry.semester,
              yearOfStudy: Number(yearOfStudy) || 1,
              credits: null,
              isCore: null,
              durationType: entry.semester === 1 || entry.semester === 2 ? "semester" : entry.semester === "both" ? "year" : null,
              durationLabel:
                entry.semester === 1 || entry.semester === 2
                  ? `Semester ${entry.semester}`
                  : entry.semester === "both"
                    ? "Full year"
                    : null,
              assumed: false,
              source: "manual",
            };
          })
          .filter((entry) => entry.code)
      : [];

    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          studyType: "university",
          institutionId: selectedUniversity.id,
          institution: selectedUniversity.name,
          campusId: selectedCampus.id,
          campus: selectedCampus.campusName,
          academicPeriodType: "semester",
          faculty: faculty.trim() || null,
          yearOfStudy: Number(yearOfStudy) || null,
          qualification: qualification.trim() || null,
          studentNumber: studentNumber || null,
          subjects: [],
          modulePlan,
          examDates: [],
        }),
      });

      const data = (await response.json()) as CompletionResponse;
      if (!response.ok || !data.success) {
        setError(data.error || "Unable to save your onboarding details.");
        setSaving(false);
        return;
      }

      if (typeof window !== "undefined" && data.pendingTimetableSync?.modules.length) {
        window.localStorage.setItem(PENDING_TIMETABLE_SYNC_STORAGE_KEY, JSON.stringify(data.pendingTimetableSync));
      }

      router.push("/planner");
      router.refresh();
    } catch {
      setError("Unable to complete onboarding right now.");
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "32px 16px 56px",
      }}
    >
      <div style={{ display: "grid", gap: "18px", justifyItems: "center", width: "100%" }}>
        <div style={{ display: "grid", gap: "8px", justifyItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-2)" }}>
            Step {step} of 3
          </span>
          <ProgressDots step={step} />
        </div>

        {step === 1 ? (
          <StepShell
            eyebrow="University Setup"
            title="Select your institution"
            subtitle="Start with the university and campus that should drive your planner. This step is required before the planner can load."
          >
            <div style={{ display: "grid", gap: "18px" }}>
              <div style={{ display: "grid", gap: "8px" }}>
                <label htmlFor="university">University</label>
                <select
                  id="university"
                  value={selectedUniversityId}
                  onChange={(event) => {
                    setSelectedUniversityId(event.target.value);
                    setSelectedCampusId("");
                    setError(null);
                    setModuleWarning(null);
                  }}
                >
                  <option value="">Select a university</option>
                  {universities.map((university) => (
                    <option key={university.id} value={university.id}>
                      {university.shortCode} - {university.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <label htmlFor="campus">Campus</label>
                {selectedUniversityId && hasSingleCampus && selectedCampus ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--border)",
                      background: "rgba(255, 255, 255, 0.03)",
                      color: "var(--text-1)",
                    }}
                  >
                    {selectedCampus.campusName}
                  </div>
                ) : (
                  <select
                    id="campus"
                    value={selectedCampusId}
                    onChange={(event) => {
                      setSelectedCampusId(event.target.value);
                      setError(null);
                    }}
                    disabled={!selectedUniversityId}
                  >
                    <option value="">{selectedUniversityId ? "Select a campus" : "Choose a university first"}</option>
                    {campuses.map((campus) => (
                      <option key={campus.id} value={campus.id}>
                        {campus.campusName}
                      </option>
                    ))}
                  </select>
                )}
                {selectedUniversity?.shortCode === "UNISA" ? (
                  <p style={{ margin: 0, color: "var(--text-2)", fontSize: "12px", lineHeight: 1.6 }}>
                    UNISA is a distance learning university. Your regional campus is for administrative purposes only
                    - all study is done online.
                  </p>
                ) : null}
              </div>
            </div>

            {error ? (
              <p
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid rgba(239, 68, 68, 0.32)",
                  background: "var(--red-dim)",
                  color: "#fecaca",
                  fontSize: "13px",
                }}
              >
                {error}
              </p>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="gold"
                onClick={() => setStep(2)}
                disabled={!selectedUniversityId || !selectedCampusId}
              >
                Continue
              </Button>
            </div>
          </StepShell>
        ) : null}

        {step === 2 ? (
          <StepShell
            eyebrow="Academic Profile"
            title="Tell us about your degree"
            subtitle="This helps us label the planner correctly. You can skip this and fill it in later from your profile settings."
          >
            <div style={{ display: "grid", gap: "18px" }}>
              <div style={{ display: "grid", gap: "8px" }}>
                <label htmlFor="faculty">Faculty</label>
                <select id="faculty" value={faculty} onChange={(event) => setFaculty(event.target.value)}>
                  <option value="">Choose a faculty</option>
                  {availableFaculties.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {catalogLoading ? (
                  <p style={{ margin: 0, color: "var(--text-2)", fontSize: "12px", lineHeight: 1.6 }}>
                    Loading university catalog...
                  </p>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <label htmlFor="yearOfStudy">Year of study</label>
                <select id="yearOfStudy" value={yearOfStudy} onChange={(event) => setYearOfStudy(event.target.value)}>
                  {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
                    <option key={value} value={value}>
                      Year {value}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gap: "8px", position: "relative" }}>
                <label htmlFor="qualification">Qualification</label>
                <input
                  id="qualification"
                  type="text"
                  placeholder="Search or type your qualification..."
                  value={qualificationInput}
                  onChange={(event) => {
                    setQualificationInput(event.target.value);
                    setQualification(event.target.value.trim());
                    setQualificationOpen(true);
                  }}
                  onFocus={() => setQualificationOpen(true)}
                  onBlur={() => {
                    if (selectingQualificationRef.current) {
                      selectingQualificationRef.current = false;
                      return;
                    }
                    if (qualificationBlurTimerRef.current) {
                      window.clearTimeout(qualificationBlurTimerRef.current);
                    }
                    qualificationBlurTimerRef.current = window.setTimeout(() => {
                      commitQualification(qualificationInput);
                    }, 120);
                  }}
                  onKeyDown={handleQualificationKeyDown}
                  autoComplete="off"
                />
                {qualificationOpen ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      left: 0,
                      right: 0,
                      zIndex: 20,
                      maxHeight: "280px",
                      overflowY: "auto",
                      padding: "8px",
                      borderRadius: "var(--r-lg)",
                      border: "1px solid var(--border)",
                      background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-2) 100%)",
                      boxShadow: "var(--sh-lg)",
                    }}
                  >
                    {qualificationGroups.length > 0 ? (
                      <div style={{ display: "grid", gap: "10px" }}>
                        {qualificationGroups.map((group) => (
                          <div key={group.label} style={{ display: "grid", gap: "6px" }}>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: "11px",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                                color: "var(--text-2)",
                              }}
                            >
                              {group.label}
                            </span>
                            <div style={{ display: "grid", gap: "4px" }}>
                              {group.options.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  onMouseDown={(event) => {
                                    event.preventDefault();
                                    selectingQualificationRef.current = true;
                                    commitQualification(option);
                                  }}
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: "var(--r-md)",
                                    border: "1px solid transparent",
                                    background: "rgba(255, 255, 255, 0.03)",
                                    color: "var(--text-1)",
                                    textAlign: "left",
                                    cursor: "pointer",
                                  }}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: "10px 12px", color: "var(--text-2)", fontSize: "13px" }}>
                        Press Enter to use &quot;{qualificationInput.trim()}&quot; as your qualification.
                      </div>
                    )}
                  </div>
                ) : null}
                {catalog?.note ? (
                  <p style={{ margin: 0, color: "var(--text-2)", fontSize: "12px", lineHeight: 1.6 }}>
                    {catalog.note}
                  </p>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <label htmlFor="studentNumber">Student number</label>
                <input
                  id="studentNumber"
                  type="text"
                  placeholder="Optional"
                  value={studentNumber}
                  onChange={(event) => setStudentNumber(event.target.value)}
                />
                <p style={{ margin: 0, color: "var(--text-2)", fontSize: "12px", lineHeight: 1.6 }}>
                  Your student number is used to help you identify your personal exam timetable. SCHOOL never accesses
                  your student portal on your behalf.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <Button onClick={() => setStep(1)}>Back</Button>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => setStep(3)}>
                  Skip for now
                </Button>
                <Button variant="gold" onClick={() => setStep(3)}>
                  Continue
                </Button>
              </div>
            </div>
          </StepShell>
        ) : null}

        {step === 3 ? (
          <StepShell
            eyebrow="Modules"
            title="Add your modules"
            subtitle="Add up to 12 module codes. We will use them to load your class timetable in the background after onboarding."
          >
            <div style={{ display: "grid", gap: "14px" }}>
              {showFemsQuickAdd ? (
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    padding: "16px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "rgba(255, 255, 255, 0.03)",
                  }}
                >
                  <div style={{ display: "grid", gap: "6px" }}>
                    <strong style={{ fontSize: "14px" }}>Common modules</strong>
                    <p style={{ margin: 0, color: "var(--text-2)", fontSize: "12px", lineHeight: 1.6 }}>
                      Quick-add common NWU Economics &amp; Management Sciences modules to get started faster.
                    </p>
                  </div>
                  <div style={{ display: "grid", gap: "12px" }}>
                    {NWU_FEMS_MODULE_SUGGESTIONS.map((group) => (
                      <div key={group.label} style={{ display: "grid", gap: "8px" }}>
                        <span style={{ color: "var(--text-2)", fontSize: "12px" }}>{group.label}</span>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {group.items
                            .filter((item) => !currentModuleCodes.has(item.code))
                            .map((item) => (
                              <button
                                key={item.code}
                                type="button"
                                onClick={() => handleQuickAddModule(item.code, item.semester)}
                                style={{
                                  padding: "8px 12px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--gold-border)",
                                  background: "var(--gold-dim)",
                                  color: "var(--gold)",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                              >
                                {item.code}
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {modules.map((module, index) => (
                <div
                  key={module.id}
                  style={{
                    display: "grid",
                    gap: "12px",
                    padding: "16px",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "color-mix(in srgb, var(--surface-2) 78%, transparent)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                    <strong style={{ fontSize: "13px" }}>Module {index + 1}</strong>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeModule(module.id)}
                      disabled={modules.length === 1 && !module.moduleCode && !module.moduleName}
                    >
                      Remove
                    </Button>
                  </div>

                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={{ display: "grid", gap: "8px" }}>
                      <label htmlFor={`${module.id}-code`}>Module code</label>
                      <input
                        id={`${module.id}-code`}
                        type="text"
                        placeholder="Example: EKIP212"
                        value={module.moduleCode}
                        onChange={(event) => {
                          setModuleWarning(null);
                          updateModule(module.id, { moduleCode: event.target.value.toUpperCase() });
                        }}
                        onBlur={(event) => void handleModuleCodeBlur(module.id, event.target.value)}
                      />
                    </div>

                    <div style={{ display: "grid", gap: "8px" }}>
                      <label htmlFor={`${module.id}-name`}>Module name</label>
                      <input
                        id={`${module.id}-name`}
                        type="text"
                        placeholder="Optional"
                        value={module.moduleName}
                        onChange={(event) => updateModule(module.id, { moduleName: event.target.value })}
                      />
                    </div>

                    <div style={{ display: "grid", gap: "8px" }}>
                      <label htmlFor={`${module.id}-semester`}>Semester</label>
                      <select
                        id={`${module.id}-semester`}
                        value={module.semester}
                        onChange={(event) =>
                          updateModule(module.id, {
                            semester:
                              event.target.value === "1"
                                ? 1
                                : event.target.value === "2"
                                  ? 2
                                  : event.target.value === "both"
                                    ? "both"
                                    : "",
                          })
                        }
                      >
                        <option value="">Select semester</option>
                        <option value="both">Both semesters</option>
                        <option value="1">Semester 1</option>
                        <option value="2">Semester 2</option>
                      </select>
                      {semesterHintLoadingById[module.id] ? (
                        <span style={{ color: "var(--text-2)", fontSize: "12px" }}>Looking up a semester hint...</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <p style={{ margin: 0, color: "var(--text-2)", fontSize: "12px" }}>
                  {completedModuleCount > 0
                    ? `${completedModuleCount} module${completedModuleCount === 1 ? "" : "s"} ready to sync`
                    : "You can finish now and add modules later from your profile settings."}
                </p>
                <Button variant="outline" onClick={addModule} disabled={modules.length >= 12}>
                  Add another module
                </Button>
              </div>
            </div>

            {moduleWarning ? (
              <p
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--gold-border)",
                  background: "var(--gold-dim)",
                  color: "var(--gold)",
                  fontSize: "13px",
                }}
              >
                {moduleWarning}
              </p>
            ) : null}

            {error ? (
              <p
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid rgba(239, 68, 68, 0.32)",
                  background: "var(--red-dim)",
                  color: "#fecaca",
                  fontSize: "13px",
                }}
              >
                {error}
              </p>
            ) : null}

            {saving && completedModuleCount > 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "12px 14px",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--gold-border)",
                  background: "var(--gold-dim)",
                  color: "var(--gold)",
                  fontSize: "13px",
                }}
              >
                We&apos;re loading your class timetable. This takes about 30 seconds.
              </p>
            ) : null}

            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
              <Button onClick={() => setStep(2)} disabled={saving}>
                Back
              </Button>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Button variant="ghost" onClick={() => void completeOnboarding(false)} disabled={saving}>
                  Finish later
                </Button>
                <Button
                  variant="gold"
                  onClick={() => void completeOnboarding(true)}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Finish and open planner"}
                </Button>
              </div>
            </div>
          </StepShell>
        ) : null}
      </div>
    </main>
  );
}
