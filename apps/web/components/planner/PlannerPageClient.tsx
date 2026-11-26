"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Badge } from "@/components/ui/Badge";
import { buttonClassName } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useSession } from "@/components/SessionProvider";
import {
  buildAcademicPreferencesPatch,
  CALENDAR_FORMAT_STORAGE_KEY,
  type AcademicPreferences,
  readAcademicPreferences,
} from "@/lib/academicPreferences";
import {
  formatAcademicDateRange,
  getAcademicSchedule,
  getCurrentPeriod,
  type CalendarFormat,
} from "@/lib/academicPeriod";
import { API_BASE, getApiErrorMessage } from "@/lib/apiBase";
import { useOfflineCredits } from "../../hooks/useOffline";
import type { PlannerCatalog, PlannerGrade, PlannerSubject, PlannerWeek } from "@/lib/plannerCatalog";
import {
  PLANNER_UPLOAD_ACCEPT_ATTR,
  PLANNER_UPLOAD_FORMAT_PILLS,
  PLANNER_UPLOAD_HELPER_TEXT,
  validatePlannerUploadFile,
} from "@/lib/plannerUploadValidation";
import styles from "@/components/planner/PlannerPage.module.css";

type PlannerPageClientProps = {
  catalog: PlannerCatalog;
};

type ProfileResponse = {
  profile?: {
    appPreferences?: Record<string, unknown>;
  };
};

type UniversityPlan = {
  id: string;
  fileName: string | null;
  fileKey: string | null;
  extractedText: string;
  uploadedAt: string;
  updatedAt: string;
  preview: string;
};

type PlannerApiResponse = {
  success?: boolean;
  error?: string;
  plan?: UniversityPlan | null;
  planId?: string;
  preview?: string;
};

type UniversityWeekState = {
  completed: boolean;
  notes: string;
};

type SchoolWeekRow = {
  subjectKey: string;
  subjectName: string;
  topicTitle: string;
  summaryMd: string;
  color: string;
  completed: boolean;
};

type SchoolWeekCard = {
  termNumber: number;
  weekNumber: number;
  dateRange: string;
  rows: SchoolWeekRow[];
};

const BAND_ORDER = ["Foundation", "Intermediate", "Senior", "FET"] as const;
const SUBJECT_COLOR_TOKENS = ["var(--gold)", "var(--green)", "var(--amber)", "var(--red)"];
const CUSTOM_CALENDAR_EVENT = "school:calendar-format-changed";

function isCalendarFormat(value: unknown): value is CalendarFormat {
  return value === "term" || value === "semester" || value === "trimester" || value === "quarter";
}

function getStoredCalendarFormat(): CalendarFormat | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(CALENDAR_FORMAT_STORAGE_KEY);
  return isCalendarFormat(saved) ? saved : null;
}

function subjectColor(subjectKey: string) {
  const hash = Array.from(subjectKey).reduce((total, char) => total + char.charCodeAt(0), 0);
  return SUBJECT_COLOR_TOKENS[hash % SUBJECT_COLOR_TOKENS.length];
}

function formatPlanName(fileName: string | null) {
  if (!fileName) return "My Plan";
  return fileName.replace(/\.[a-z0-9]+$/i, "").trim() || "My Plan";
}

function getSchoolCompletionKey(gradeKey: string, subjectKey: string, termNumber: number, weekNumber: number) {
  return `school:planner:school:${gradeKey}:${subjectKey}:term${termNumber}:week${weekNumber}`;
}

function getUniversityWeekKey(planId: string, periodNumber: number, weekNumber: number) {
  return `school:planner:university:${planId}:${periodNumber}:${weekNumber}`;
}

function readSchoolCompletion(gradeKey: string, subjectKeys: string[]) {
  if (typeof window === "undefined") return {};
  const next: Record<string, boolean> = {};
  for (const subjectKey of subjectKeys) {
    for (let termNumber = 1; termNumber <= 4; termNumber += 1) {
      for (let weekNumber = 1; weekNumber <= 10; weekNumber += 1) {
        const key = getSchoolCompletionKey(gradeKey, subjectKey, termNumber, weekNumber);
        next[key] = window.localStorage.getItem(key) === "1";
      }
    }
  }
  return next;
}

function readUniversityWeekState(planId: string, periodNumber: number, weekNumber: number): UniversityWeekState {
  if (typeof window === "undefined") {
    return { completed: false, notes: "" };
  }
  const raw = window.localStorage.getItem(getUniversityWeekKey(planId, periodNumber, weekNumber));
  if (!raw) {
    return { completed: false, notes: "" };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UniversityWeekState>;
    return {
      completed: Boolean(parsed.completed),
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return { completed: false, notes: "" };
  }
}

function buildGradeBands(grades: PlannerCatalog["grades"]) {
  return BAND_ORDER.map((band) => ({
    band,
    grades: grades.filter((grade) => grade.band === band),
  })).filter((entry) => entry.grades.length > 0);
}

function findPlannerGrade(catalog: PlannerCatalog, schoolGrade: string | null, schoolPhase: string | null) {
  if (!schoolGrade) return null;
  return (
    catalog.grades.find((grade) => grade.key === schoolGrade && (!schoolPhase || grade.phaseKey === schoolPhase)) ||
    catalog.grades.find((grade) => grade.key === schoolGrade) ||
    null
  );
}

function flattenGradeSubjects(grade: PlannerGrade) {
  return grade.groups.flatMap((group) => group.subjects);
}

function getSelectedSubjects(grade: PlannerGrade | null, subjectKeys: string[]) {
  if (!grade) return [];
  const wanted = new Set(subjectKeys);
  return flattenGradeSubjects(grade).filter((subject) => wanted.has(subject.key));
}

function getTermWeek(subject: PlannerSubject, termNumber: number, weekNumber: number): PlannerWeek | null {
  const term = subject.terms.find((entry) => entry.termNumber === termNumber);
  if (!term) return null;
  return term.weeks[weekNumber - 1] || null;
}

function buildSchoolWeekCards(
  grade: PlannerGrade | null,
  selectedSubjects: PlannerSubject[],
  completionMap: Record<string, boolean>,
  year: number
) {
  if (!grade || selectedSubjects.length === 0) {
    return new Map<number, SchoolWeekCard[]>();
  }

  const schedule = getAcademicSchedule("term", year);
  const cardsByTerm = new Map<number, SchoolWeekCard[]>();

  for (let termNumber = 1; termNumber <= 4; termNumber += 1) {
    const scheduleWindow = schedule[termNumber - 1];
    const maxWeeks = Math.max(
      scheduleWindow?.weekCount ?? 0,
      ...selectedSubjects.map((subject) => {
        const term = subject.terms.find((entry) => entry.termNumber === termNumber);
        return term?.weeks.length ?? 0;
      })
    );

    const cards: SchoolWeekCard[] = [];
    for (let weekNumber = 1; weekNumber <= maxWeeks; weekNumber += 1) {
      const weekStart = new Date(scheduleWindow.startDate.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000);
      const rows: SchoolWeekRow[] = selectedSubjects.map((subject) => {
        const week = getTermWeek(subject, termNumber, weekNumber);
        const completionKey = getSchoolCompletionKey(grade.key, subject.key, termNumber, weekNumber);
        return {
          subjectKey: subject.key,
          subjectName: subject.name,
          topicTitle: week?.topicTitle || "Topic not yet available",
          summaryMd: week?.summaryMd || "",
          color: subjectColor(subject.key),
          completed: Boolean(completionMap[completionKey]),
        };
      });

      cards.push({
        termNumber,
        weekNumber,
        dateRange: formatAcademicDateRange(weekStart, weekEnd),
        rows,
      });
    }

    cardsByTerm.set(termNumber, cards);
  }

  return cardsByTerm;
}

function buildSchoolExportText(grade: PlannerGrade, selectedSubjects: PlannerSubject[]) {
  const lines = [`${new Date().getFullYear()} · ${grade.name} Annual Teaching Plan`, ""];

  for (let termNumber = 1; termNumber <= 4; termNumber += 1) {
    lines.push(`Term ${termNumber}`);
    for (const subject of selectedSubjects) {
      const term = subject.terms.find((entry) => entry.termNumber === termNumber);
      if (!term) continue;
      lines.push(`- ${subject.name}`);
      for (const week of term.weeks) {
        lines.push(`  • ${week.name}: ${week.topicTitle}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function triggerDownload(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

function isPastSchoolWeek(termNumber: number, weekNumber: number, currentTerm: ReturnType<typeof getCurrentPeriod>) {
  if (termNumber < currentTerm.periodNumber) return true;
  if (termNumber > currentTerm.periodNumber) return false;
  if (currentTerm.weekNumber === 0) return false;
  return weekNumber < currentTerm.weekNumber;
}

function isCurrentSchoolWeek(termNumber: number, weekNumber: number, currentTerm: ReturnType<typeof getCurrentPeriod>) {
  return currentTerm.weekNumber > 0 && termNumber === currentTerm.periodNumber && weekNumber === currentTerm.weekNumber;
}

function plannerBranchFromFormat(format: CalendarFormat) {
  return format === "term" ? "school" : "university";
}

function buildEmptyUniversityState(planId: string, format: CalendarFormat, year: number) {
  const next: Record<string, UniversityWeekState> = {};
  for (const period of getAcademicSchedule(format, year)) {
    for (let weekNumber = 1; weekNumber <= period.weekCount; weekNumber += 1) {
      next[getUniversityWeekKey(planId, period.periodNumber, weekNumber)] = readUniversityWeekState(
        planId,
        period.periodNumber,
        weekNumber
      );
    }
  }
  return next;
}

function readCommunityModulesFromPreferences(appPreferences: Record<string, unknown>) {
  const academics =
    typeof appPreferences.academics === "object" && appPreferences.academics !== null
      ? (appPreferences.academics as Record<string, unknown>)
      : {};

  const selectedSubjects = Array.isArray(academics.selectedSubjects)
    ? academics.selectedSubjects.filter(
        (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
      )
    : [];

  return selectedSubjects;
}

export default function PlannerPageClient({ catalog }: PlannerPageClientProps) {
  const { session, loading: sessionLoading } = useSession();
  const { earnCredits } = useOfflineCredits();
  const [profileLoading, setProfileLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [calendarFormat, setCalendarFormat] = useState<CalendarFormat>("term");
  const [appPreferences, setAppPreferences] = useState<Record<string, unknown>>({});
  const [schoolGrade, setSchoolGrade] = useState<string | null>(null);
  const [schoolPhase, setSchoolPhase] = useState<string | null>(null);
  const [schoolSubjectKeys, setSchoolSubjectKeys] = useState<string[]>([]);
  const [draftSubjectKeys, setDraftSubjectKeys] = useState<string[]>([]);
  const [editingSubjects, setEditingSubjects] = useState(false);
  const [activeSchoolTerm, setActiveSchoolTerm] = useState(1);
  const [schoolCompletion, setSchoolCompletion] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<UniversityPlan | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [showWhyUpload, setShowWhyUpload] = useState(false);
  const [showFullPlan, setShowFullPlan] = useState(false);
  const [activeUniversityPeriod, setActiveUniversityPeriod] = useState(1);
  const [universityWeekState, setUniversityWeekState] = useState<Record<string, UniversityWeekState>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const gradeBands = useMemo(() => buildGradeBands(catalog.grades), [catalog.grades]);
  const selectedGrade = useMemo(
    () => findPlannerGrade(catalog, schoolGrade, schoolPhase),
    [catalog, schoolGrade, schoolPhase]
  );
  const selectedSubjects = useMemo(
    () => getSelectedSubjects(selectedGrade, schoolSubjectKeys),
    [selectedGrade, schoolSubjectKeys]
  );
  const currentSchoolPeriod = useMemo(() => getCurrentPeriod("term"), []);
  const currentSelectedPeriod = useMemo(() => getCurrentPeriod(calendarFormat), [calendarFormat]);
  const plannerBranch = plannerBranchFromFormat(calendarFormat);
  const schoolWeekCards = useMemo(
    () => buildSchoolWeekCards(selectedGrade, selectedSubjects, schoolCompletion, currentSchoolPeriod.year),
    [selectedGrade, selectedSubjects, schoolCompletion, currentSchoolPeriod.year]
  );
  const schoolTermCards = schoolWeekCards.get(activeSchoolTerm) ?? [];
  const universitySchedule = useMemo(
    () => getAcademicSchedule(calendarFormat, currentSelectedPeriod.year),
    [calendarFormat, currentSelectedPeriod.year]
  );
  const activeUniversityWindow =
    universitySchedule.find((period) => period.periodNumber === activeUniversityPeriod) || universitySchedule[0];
  const communityModules = useMemo(() => {
    if (plannerBranch === "school") {
      return selectedSubjects.map((subject) => subject.key).slice(0, 6);
    }
    return readCommunityModulesFromPreferences(appPreferences).slice(0, 6);
  }, [appPreferences, plannerBranch, selectedSubjects]);

  const persistAcademicPreferences = useCallback(
    async (patch: AcademicPreferences) => {
      if (!session) return;

      setSavingPreferences(true);
      try {
        const response = await fetch(`${API_BASE}/profile/me`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "x-csrf-token": session.csrfToken,
          },
          body: JSON.stringify({
            appPreferences: buildAcademicPreferencesPatch(appPreferences, patch),
          }),
        });

        const payload = (await response.json().catch(() => null)) as ProfileResponse | null;
        if (!response.ok) {
          throw new Error("Unable to save planner preferences.");
        }

        if (payload?.profile?.appPreferences) {
          setAppPreferences(payload.profile.appPreferences);
        }
      } catch (saveError) {
        setNotice(getApiErrorMessage(saveError, "Unable to save planner preferences."));
      } finally {
        setSavingPreferences(false);
      }
    },
    [appPreferences, session]
  );

  useEffect(() => {
    const stored = getStoredCalendarFormat();
    if (stored) {
      setCalendarFormat(stored);
    }

    const handleStorage = () => {
      const next = getStoredCalendarFormat();
      if (next) {
        setCalendarFormat(next);
      }
    };

    const handleCustomFormat = (event: Event) => {
      const next = (event as CustomEvent<CalendarFormat>).detail;
      if (isCalendarFormat(next)) {
        setCalendarFormat(next);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(CUSTOM_CALENDAR_EVENT, handleCustomFormat as EventListener);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(CUSTOM_CALENDAR_EVENT, handleCustomFormat as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfileLoading(false);
      return;
    }

    let active = true;
    setProfileLoading(true);
    fetch(`${API_BASE}/profile/me`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load planner preferences.");
        }
        return (await response.json()) as ProfileResponse;
      })
      .then((payload) => {
        if (!active) return;

        const academics = readAcademicPreferences(payload);
        const nextPreferences = payload.profile?.appPreferences ?? {};
        setAppPreferences(nextPreferences);
        setSchoolGrade(academics.schoolGrade ?? null);
        setSchoolPhase(academics.schoolPhase ?? null);
        setSchoolSubjectKeys(academics.schoolSubjectKeys ?? []);
        setDraftSubjectKeys(academics.schoolSubjectKeys ?? []);

        const nextFormat = academics.calendarFormat ?? getStoredCalendarFormat() ?? "term";
        setCalendarFormat(nextFormat);
        window.localStorage.setItem(CALENDAR_FORMAT_STORAGE_KEY, nextFormat);
      })
      .catch((loadError) => {
        if (!active) return;
        setNotice(getApiErrorMessage(loadError, "Unable to load planner preferences."));
      })
      .finally(() => {
        if (active) {
          setProfileLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!selectedGrade) return;
    if (schoolSubjectKeys.length === 0) {
      setEditingSubjects(true);
    }
  }, [selectedGrade, schoolSubjectKeys]);

  useEffect(() => {
    if (!selectedGrade) {
      setSchoolCompletion({});
      return;
    }
    setSchoolCompletion(readSchoolCompletion(selectedGrade.key, schoolSubjectKeys));
  }, [selectedGrade, schoolSubjectKeys]);

  useEffect(() => {
    setActiveSchoolTerm(Math.max(1, Math.min(4, currentSchoolPeriod.periodNumber)));
  }, [currentSchoolPeriod.periodNumber, selectedGrade?.key]);

  useEffect(() => {
    const nextPeriod = universitySchedule.find((period) => period.periodNumber === currentSelectedPeriod.periodNumber);
    setActiveUniversityPeriod(nextPeriod?.periodNumber ?? universitySchedule[0]?.periodNumber ?? 1);
  }, [currentSelectedPeriod.periodNumber, universitySchedule]);

  useEffect(() => {
    if (!session || plannerBranch !== "university") {
      setPlanLoading(false);
      return;
    }

    let active = true;
    setPlanLoading(true);
    fetch("/api/planner/upload", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as PlannerApiResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load uploaded planner.");
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setPlan(payload?.plan ?? null);
      })
      .catch((loadError) => {
        if (!active) return;
        setUploadError(getApiErrorMessage(loadError, "Unable to load uploaded planner."));
      })
      .finally(() => {
        if (active) {
          setPlanLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [plannerBranch, session]);

  useEffect(() => {
    if (!plan || plannerBranch !== "university") {
      setUniversityWeekState({});
      return;
    }
    setUniversityWeekState(buildEmptyUniversityState(plan.id, calendarFormat, currentSelectedPeriod.year));
  }, [calendarFormat, currentSelectedPeriod.year, plan, plannerBranch]);

  const toggleSchoolCompletion = (subjectKey: string, termNumber: number, weekNumber: number, checked: boolean) => {
    if (!selectedGrade) return;
    const key = getSchoolCompletionKey(selectedGrade.key, subjectKey, termNumber, weekNumber);
    setSchoolCompletion((current) => ({
      ...current,
      [key]: checked,
    }));
    window.localStorage.setItem(key, checked ? "1" : "0");
    if (checked) {
      void earnCredits(5, "STUDY_PLANNER_TASK_COMPLETE", {
        venture: "SCHOOL",
        referenceId: key,
        referenceType: "planner_task",
        idempotencyKey: `planner:${key}`,
      }).catch(() => undefined);
    }
  };

  const updateUniversityWeek = (periodNumber: number, weekNumber: number, patch: Partial<UniversityWeekState>) => {
    if (!plan) return;
    const key = getUniversityWeekKey(plan.id, periodNumber, weekNumber);
    setUniversityWeekState((current) => {
      const nextValue = {
        completed: current[key]?.completed ?? false,
        notes: current[key]?.notes ?? "",
        ...patch,
      };
      window.localStorage.setItem(key, JSON.stringify(nextValue));
      return {
        ...current,
        [key]: nextValue,
      };
    });
    if (patch.completed === true) {
      void earnCredits(5, "STUDY_PLANNER_TASK_COMPLETE", {
        venture: "SCHOOL",
        referenceId: key,
        referenceType: "planner_week",
        idempotencyKey: `planner:${key}`,
      }).catch(() => undefined);
    }
  };

  const handleGradeSelect = async (grade: PlannerGrade) => {
    setSchoolGrade(grade.key);
    setSchoolPhase(grade.phaseKey);
    setSchoolSubjectKeys([]);
    setDraftSubjectKeys([]);
    setEditingSubjects(true);
    setNotice(null);
    await persistAcademicPreferences({
      schoolGrade: grade.key,
      schoolPhase: grade.phaseKey,
      schoolSubjectKeys: [],
    });
  };

  const handleSubjectToggle = (subjectKey: string) => {
    setDraftSubjectKeys((current) =>
      current.includes(subjectKey) ? current.filter((entry) => entry !== subjectKey) : [...current, subjectKey]
    );
  };

  const handleSubjectSave = async () => {
    if (draftSubjectKeys.length === 0) {
      setNotice("Select at least one subject to build your planner.");
      return;
    }

    setSchoolSubjectKeys(draftSubjectKeys);
    setEditingSubjects(false);
    setNotice(null);
    await persistAcademicPreferences({
      schoolGrade: schoolGrade ?? undefined,
      schoolPhase: schoolPhase ?? undefined,
      schoolSubjectKeys: draftSubjectKeys,
    });
  };

  const handleSchoolExport = () => {
    if (!selectedGrade || selectedSubjects.length === 0) return;
    const text = buildSchoolExportText(selectedGrade, selectedSubjects);
    triggerDownload(`${selectedGrade.slug}-annual-teaching-plan.txt`, text);
  };
  const handleUploadResponse = (payload: PlannerApiResponse) => {
    if (!payload.success || !payload.plan) {
      throw new Error(payload.error || "Upload failed. Please try again.");
    }
    setPlan(payload.plan);
    setShowFullPlan(false);
    setUploadError(null);
    setUploadProgress(100);
    setManualMode(false);
    setManualText("");
  };

  const submitFile = (file: File) => {
    const validation = validatePlannerUploadFile(file.name, file.type, file.size);
    if (!validation.ok) {
      setUploadError(validation.error);
      return;
    }

    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/planner/upload");
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      const payload = (() => {
        try {
          return JSON.parse(xhr.responseText) as PlannerApiResponse;
        } catch {
          return { error: "Upload failed. Please try again." } as PlannerApiResponse;
        }
      })();

      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          handleUploadResponse(payload);
        } catch (uploadHandleError) {
          setUploadError(getApiErrorMessage(uploadHandleError, "Upload failed. Please try again."));
        }
        return;
      }

      setUploadProgress(0);
      setUploadError(payload.error || "Upload failed. Please try again.");
    };

    xhr.onerror = () => {
      setUploading(false);
      setUploadProgress(0);
      setUploadError("Upload failed. Please try again.");
    };

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    submitFile(file);
    event.target.value = "";
  };

  const handleManualSubmit = async () => {
    const trimmed = manualText.trim();
    if (!trimmed) {
      setUploadError("Please paste your plan before saving it.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("manualText", trimmed);
      formData.append("fileName", "Manual Plan");
      const response = await fetch("/api/planner/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as PlannerApiResponse | null;
      if (!response.ok || !payload) {
        throw new Error(payload?.error || "Upload failed. Please try again.");
      }
      handleUploadResponse(payload);
    } catch (manualError) {
      setUploadError(getApiErrorMessage(manualError, "Upload failed. Please try again."));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      submitFile(file);
    }
  };

  if (sessionLoading || profileLoading) {
    return (
      <div className={styles.stateCard}>
        <p className="eyebrow">Academic Planner</p>
        <h1>Loading planner…</h1>
        <p className="subtitle">Fetching your academic preferences and the current planner state.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.stateCard}>
        <p className="eyebrow">Academic Planner</p>
        <h1>Sign in to open your planner.</h1>
        <p className="subtitle">Your planner syncs against your SCHOOL profile and uploaded plan state.</p>
        <Link className={buttonClassName({ variant: "gold", size: "sm" })} href="/" prefetch={false}>
          Back home
        </Link>
      </div>
    );
  }

  const showSchoolGradeSelection = plannerBranch === "school" && !selectedGrade;
  const showSubjectPicker =
    plannerBranch === "school" && selectedGrade && (editingSubjects || selectedSubjects.length === 0);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <span className="eyebrow">Academic Planner</span>
          {plannerBranch === "school" ? (
            <>
              <h1>{`${currentSchoolPeriod.year} · ${selectedGrade?.name ?? "Annual Teaching Plan"}`}</h1>
              <p className="subtitle">Your CAPS-aligned annual teaching plan. Topics are pre-populated from the ATP.</p>
            </>
          ) : (
            <>
              <h1>{`${currentSelectedPeriod.year} · ${plan ? formatPlanName(plan.fileName) : "Academic Planner"}`}</h1>
              <p className="subtitle">
                Upload your semester or module plan so SCHOOL can align your planner and AI tutor to it.
              </p>
            </>
          )}
        </div>

        <div className={styles.headerActions}>
          {plannerBranch === "school" ? (
            <>
              <Badge variant="gold">{currentSchoolPeriod.label}</Badge>
              {selectedGrade ? (
                <>
                  <button
                    className={buttonClassName({ variant: "outline", size: "sm" })}
                    type="button"
                    onClick={handleSchoolExport}
                  >
                    Export
                  </button>
                  <button
                    className={buttonClassName({ variant: "ghost", size: "sm" })}
                    type="button"
                    onClick={() => setEditingSubjects(true)}
                  >
                    Change Subjects
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <Badge variant="gold">{currentSelectedPeriod.label}</Badge>
              {plan ? (
                <button
                  className={buttonClassName({ variant: "ghost", size: "sm" })}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Replace Plan
                </button>
              ) : null}
            </>
          )}
        </div>
      </header>

      {communityModules.length > 0 ? (
        <div className={styles.moduleRoomsRow}>
          <span className={styles.moduleRoomsLabel}>Module rooms</span>
          <div className={styles.moduleRoomsLinks}>
            {communityModules.map((moduleCode) => (
              <Link
                key={moduleCode}
                className={styles.moduleRoomLink}
                href={`/community/rooms/${encodeURIComponent(moduleCode)}`}
                prefetch={false}
              >
                {moduleCode}
              </Link>
            ))}
            <Link className={styles.moduleRoomLink} href="/community" prefetch={false}>
              Community hub
            </Link>
          </div>
        </div>
      ) : null}

      {notice ? <div className="assistant-error">{notice}</div> : null}

      {plannerBranch === "school" ? (
        <>
          {showSchoolGradeSelection ? (
            <section className={styles.selectorSection}>
              <Card>
                <CardHeader>
                  <CardTitle>Select your grade</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className={styles.gradeBands}>
                    {gradeBands.map((entry) => (
                      <div className={styles.gradeBand} key={entry.band}>
                        <h2 className={styles.bandTitle}>{entry.band}</h2>
                        <div className={styles.gradeGrid}>
                          {entry.grades.map((grade) => (
                            <button
                              key={`${grade.phaseKey}-${grade.key}`}
                              className={styles.gradeCard}
                              type="button"
                              onClick={() => void handleGradeSelect(grade)}
                            >
                              <span className={styles.gradeCardTitle}>{grade.name}</span>
                              <span className={styles.gradeCardMeta}>{grade.phaseName}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </section>
          ) : null}
          {showSubjectPicker && selectedGrade ? (
            <section className={styles.selectorSection}>
              <Card>
                <CardHeader>
                  <CardTitle>{`Choose subjects for ${selectedGrade.name}`}</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className={styles.selectorActions}>
                    <p className="subtitle">
                      SCHOOL does not have subject enrolment saved yet, so choose the subjects you want in your planner.
                    </p>
                    <div className={styles.selectorButtons}>
                      <button
                        className={buttonClassName({ variant: "ghost", size: "sm" })}
                        type="button"
                        onClick={() => {
                          setSchoolGrade(null);
                          setSchoolPhase(null);
                          setSchoolSubjectKeys([]);
                          setDraftSubjectKeys([]);
                        }}
                      >
                        Change Grade
                      </button>
                      <button
                        className={buttonClassName({ variant: "gold", size: "sm" })}
                        type="button"
                        onClick={() => void handleSubjectSave()}
                        disabled={savingPreferences}
                      >
                        {savingPreferences ? "Saving…" : "Save Subjects"}
                      </button>
                    </div>
                  </div>

                  <div className={styles.subjectGroups}>
                    {selectedGrade.groups.map((group) => (
                      <section key={group.key} className={styles.subjectGroup}>
                        <div className={styles.subjectGroupHeader}>
                          <h3>{group.name}</h3>
                          <Badge variant={group.category === "core" ? "green" : group.category === "elective" ? "amber" : "neutral"}>
                            {group.category}
                          </Badge>
                        </div>
                        <div className={styles.subjectGrid}>
                          {group.subjects.map((subject) => {
                            const selected = draftSubjectKeys.includes(subject.key);
                            return (
                              <button
                                key={subject.key}
                                className={selected ? `${styles.subjectCard} ${styles.subjectCardSelected}` : styles.subjectCard}
                                type="button"
                                onClick={() => handleSubjectToggle(subject.key)}
                              >
                                <span className={styles.subjectColor} style={{ background: subjectColor(subject.key) }} />
                                <span className={styles.subjectCardCopy}>
                                  <span className={styles.subjectCardTitle}>{subject.name}</span>
                                  <span className={styles.subjectCardMeta}>{`${subject.terms.length || 4} terms available`}</span>
                                </span>
                                <span className={styles.subjectCardCheck}>{selected ? "\u2713" : ""}</span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </section>
          ) : null}

          {!showSchoolGradeSelection && !showSubjectPicker && selectedGrade ? (
            <>
              <div className={styles.tabs}>
                {[1, 2, 3, 4].map((termNumber) => (
                  <button
                    key={termNumber}
                    className={termNumber === activeSchoolTerm ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                    type="button"
                    onClick={() => setActiveSchoolTerm(termNumber)}
                  >
                    {`Term ${termNumber}`}
                  </button>
                ))}
              </div>

              <section className={styles.weekGrid}>
                {schoolTermCards.map((card) => {
                  const pastWeek = isPastSchoolWeek(card.termNumber, card.weekNumber, currentSchoolPeriod);
                  const currentWeek = isCurrentSchoolWeek(card.termNumber, card.weekNumber, currentSchoolPeriod);
                  const allComplete = card.rows.length > 0 && card.rows.every((row) => row.completed);

                  return (
                    <article
                      key={`term-${card.termNumber}-week-${card.weekNumber}`}
                      className={
                        currentWeek
                          ? `${styles.weekCard} ${styles.weekCardCurrent}`
                          : pastWeek
                            ? `${styles.weekCard} ${styles.weekCardPast}`
                            : styles.weekCard
                      }
                    >
                      <div className={styles.weekCardHeader}>
                        <div>
                          <span className={styles.weekBadge}>{`Week ${card.weekNumber}`}</span>
                          <h3 className={styles.weekTitle}>{card.dateRange}</h3>
                        </div>
                        <div className={styles.weekStatus}>
                          {currentWeek ? <Badge variant="gold">Current</Badge> : null}
                          {pastWeek && allComplete ? <Badge variant="green">Completed</Badge> : null}
                        </div>
                      </div>

                      <div className={styles.weekRows}>
                        {card.rows.map((row) => (
                          <div className={styles.subjectRow} key={`${card.termNumber}-${card.weekNumber}-${row.subjectKey}`}>
                            <span className={styles.subjectRowDot} style={{ background: row.color }} />
                            <div className={styles.subjectRowCopy}>
                              <strong>{row.subjectName}</strong>
                              <span>{row.topicTitle}</span>
                            </div>
                            <input
                              aria-label={`Mark ${row.subjectName} week ${card.weekNumber} complete`}
                              checked={row.completed}
                              type="checkbox"
                              onChange={(event) =>
                                toggleSchoolCompletion(
                                  row.subjectKey,
                                  card.termNumber,
                                  card.weekNumber,
                                  event.target.checked
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </section>
            </>
          ) : null}
        </>
      ) : (
        <>
          <input
            ref={fileInputRef}
            className={styles.hiddenInput}
            type="file"
            accept={PLANNER_UPLOAD_ACCEPT_ATTR}
            onChange={handleFileChange}
          />

          {planLoading ? (
            <div className={styles.stateCard}>
              <p className="subtitle">Loading your uploaded planner…</p>
            </div>
          ) : null}

          {!planLoading && !plan ? (
            <section className={styles.uploadShell}>
              <div className={styles.uploadCard}>
                <span className={styles.uploadIcon}>{"\uD83D\uDCCB"}</span>
                <h2>Upload Your Academic Plan</h2>
                <p className="subtitle">
                  Upload your semester plan, module schedule, or course outline. SCHOOL will use it to personalise your planner and AI Study Assistant.
                </p>

                <button
                  className={dragActive ? `${styles.uploadZone} ${styles.uploadZoneActive}` : styles.uploadZone}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setDragActive(false);
                  }}
                  onDrop={handleDrop}
                  disabled={uploading}
                >
                  {uploading ? (
                    <div className={styles.uploadProgress}>
                      <strong>{`${uploadProgress}%`}</strong>
                      <div className={styles.progressBar}>
                        <span className={styles.progressBarFill} style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <span>Processing…</span>
                    </div>
                  ) : (
                    <>
                      <span className={styles.uploadArrow}>{"\u2191"}</span>
                      <strong>Drop your plan here or click to browse</strong>
                      <span>{PLANNER_UPLOAD_HELPER_TEXT}</span>
                    </>
                  )}
                </button>

                <div className={styles.uploadPills}>
                  {PLANNER_UPLOAD_FORMAT_PILLS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>

                <div className={styles.orDivider}>
                  <span>or</span>
                </div>

                <button
                  className={buttonClassName({ variant: "outline", size: "sm" })}
                  type="button"
                  onClick={() => setManualMode((current) => !current)}
                >
                  Enter plan manually
                </button>

                {manualMode ? (
                  <div className={styles.manualEntry}>
                    <textarea
                      className={styles.manualTextarea}
                      value={manualText}
                      onChange={(event) => setManualText(event.target.value)}
                      placeholder="Paste your semester or module plan here..."
                      rows={8}
                    />
                    <button
                      className={buttonClassName({ variant: "gold", size: "sm" })}
                      type="button"
                      onClick={() => void handleManualSubmit()}
                      disabled={uploading}
                    >
                      {uploading ? "Saving…" : "Save Manual Plan"}
                    </button>
                  </div>
                ) : null}

                {uploadError ? <div className="assistant-error">{uploadError}</div> : null}

                <button className={styles.whyToggle} type="button" onClick={() => setShowWhyUpload((current) => !current)}>
                  <span>Why upload?</span>
                  <span aria-hidden="true">{showWhyUpload ? "-" : "+"}</span>
                </button>

                {showWhyUpload ? (
                  <div className={styles.whyBody}>
                    Your plan helps SCHOOL&apos;s AI tutor align explanations to your exact curriculum, suggest relevant past papers, and remind you of upcoming assessments.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
          {!planLoading && plan ? (
            <>
              <div className={styles.activeBanner}>
                {"\u2713"} Your plan is active. The AI Tutor will align responses to your uploaded curriculum.
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Plan Overview</CardTitle>
                </CardHeader>
                <CardBody>
                  <div className={styles.planOverview}>
                    <pre className={styles.planPreview}>
                      {showFullPlan ? plan.extractedText : `${plan.extractedText.slice(0, 300).trim()}${plan.extractedText.length > 300 ? "…" : ""}`}
                    </pre>
                    <button
                      className={buttonClassName({ variant: "ghost", size: "sm" })}
                      type="button"
                      onClick={() => setShowFullPlan((current) => !current)}
                    >
                      {showFullPlan ? "Show Summary" : "Show Full Plan"}
                    </button>
                  </div>
                </CardBody>
              </Card>

              <div className={styles.tabs}>
                {universitySchedule.map((period) => (
                  <button
                    key={period.periodNumber}
                    className={period.periodNumber === activeUniversityPeriod ? `${styles.tab} ${styles.tabActive}` : styles.tab}
                    type="button"
                    onClick={() => setActiveUniversityPeriod(period.periodNumber)}
                  >
                    {period.periodLabel}
                  </button>
                ))}
              </div>

              {activeUniversityWindow ? (
                <section className={styles.weekGrid}>
                  {Array.from({ length: activeUniversityWindow.weekCount }, (_, index) => {
                    const weekNumber = index + 1;
                    const weekStart = new Date(activeUniversityWindow.startDate.getTime() + index * 7 * 24 * 60 * 60 * 1000);
                    const weekEnd = new Date(weekStart.getTime() + 4 * 24 * 60 * 60 * 1000);
                    const state =
                      universityWeekState[getUniversityWeekKey(plan.id, activeUniversityWindow.periodNumber, weekNumber)] ?? {
                        completed: false,
                        notes: "",
                      };

                    return (
                      <article key={`${activeUniversityWindow.periodNumber}-${weekNumber}`} className={styles.weekCard}>
                        <div className={styles.weekCardHeader}>
                          <div>
                            <span className={styles.weekBadge}>{`Week ${weekNumber}`}</span>
                            <h3 className={styles.weekTitle}>{formatAcademicDateRange(weekStart, weekEnd)}</h3>
                          </div>
                          {state.completed ? <Badge variant="green">Done</Badge> : <Badge variant="neutral">Open</Badge>}
                        </div>

                        <textarea
                          className={styles.weekNotes}
                          value={state.notes}
                          onChange={(event) =>
                            updateUniversityWeek(activeUniversityWindow.periodNumber, weekNumber, {
                              notes: event.target.value,
                            })
                          }
                          placeholder="Add weekly focus, tasks, or topics here..."
                          rows={6}
                        />

                        <label className={styles.weekCheckbox}>
                          <input
                            checked={state.completed}
                            type="checkbox"
                            onChange={(event) =>
                              updateUniversityWeek(activeUniversityWindow.periodNumber, weekNumber, {
                                completed: event.target.checked,
                              })
                            }
                          />
                          <span>Mark this week complete</span>
                        </label>
                      </article>
                    );
                  })}
                </section>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

