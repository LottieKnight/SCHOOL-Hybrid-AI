"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";

type CampusOption = {
  id: string;
  campusName: string;
  isPrimary: boolean;
};

type ModuleDraft = {
  id: string;
  moduleCode: string;
  moduleName: string;
  semester: 1 | 2 | "both" | null;
};

type UniversityProfileResponse = {
  profile: {
    university: {
      id: string;
      name: string;
      shortCode: string;
    } | null;
    campusId: string | null;
    faculty: string | null;
    yearOfStudy: number | null;
    qualification: string | null;
    studentNumber: string | null;
  } | null;
  campuses: CampusOption[];
  modules: Array<{
    id: string;
    moduleCode: string;
    moduleName: string | null;
    semester: number | null;
  }>;
  error?: string;
};

function normalizeModuleCode(value: string) {
  return value.replace(/\s+/g, "").trim().toUpperCase();
}

function createModuleDraft(index: number): ModuleDraft {
  return {
    id: `module-${index}`,
    moduleCode: "",
    moduleName: "",
    semester: null,
  };
}

export default function UniversityProfileSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [campusId, setCampusId] = useState("");
  const [faculty, setFaculty] = useState("");
  const [yearOfStudy, setYearOfStudy] = useState("1");
  const [qualification, setQualification] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [modules, setModules] = useState<ModuleDraft[]>([]);

  const singleCampus = campuses.length === 1 ? campuses[0] : null;
  const moduleCodes = useMemo(
    () => new Set(modules.map((module) => normalizeModuleCode(module.moduleCode)).filter(Boolean)),
    [modules]
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setNotice(null);
      try {
        const response = await fetch("/api/settings/university-profile", {
          credentials: "include",
        });
        const data = (await response.json()) as UniversityProfileResponse;
        if (!response.ok) {
          throw new Error(data.error || "Unable to load university profile.");
        }

        if (cancelled || !data.profile) {
          if (!cancelled) {
            setUniversityName(null);
            setCampuses([]);
            setModules([]);
          }
          return;
        }

        setUniversityName(data.profile.university?.name ?? null);
        setCampuses(data.campuses);
        setCampusId(data.profile.campusId ?? data.campuses[0]?.id ?? "");
        setFaculty(data.profile.faculty ?? "");
        setYearOfStudy(String(data.profile.yearOfStudy ?? 1));
        setQualification(data.profile.qualification ?? "");
        setStudentNumber(data.profile.studentNumber ?? "");
        setModules(
          data.modules.length > 0
            ? data.modules.map((module) => ({
                id: module.id,
                moduleCode: module.moduleCode,
                moduleName: module.moduleName ?? "",
                semester: module.semester === 1 || module.semester === 2 ? module.semester : null,
              }))
            : [createModuleDraft(1)]
        );
      } catch (error) {
        if (!cancelled) {
          setNotice({
            type: "error",
            message: error instanceof Error ? error.message : "Unable to load university profile.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateModule(id: string, patch: Partial<ModuleDraft>) {
    setModules((current) => current.map((module) => (module.id === id ? { ...module, ...patch } : module)));
  }

  function addModule() {
    setNotice(null);
    setModules((current) => (current.length >= 12 ? current : [...current, createModuleDraft(current.length + 1)]));
  }

  function removeModule(id: string) {
    setNotice(null);
    setModules((current) => {
      if (current.length === 1) {
        return [createModuleDraft(1)];
      }
      return current.filter((module) => module.id !== id);
    });
  }

  function handleModuleBlur(id: string, rawValue?: string) {
    const normalized = normalizeModuleCode(rawValue ?? modules.find((module) => module.id === id)?.moduleCode ?? "");
    if (!normalized) {
      updateModule(id, { moduleCode: "" });
      return;
    }

    const duplicate = modules.find(
      (module) => module.id !== id && normalizeModuleCode(module.moduleCode) === normalized
    );
    if (duplicate) {
      setNotice({ type: "error", message: `${normalized} is already in your module list.` });
      updateModule(id, { moduleCode: "", moduleName: "" });
      return;
    }

    updateModule(id, { moduleCode: normalized });
  }

  async function handleSave() {
    if (!universityName || saving) return;

    const normalizedModules = modules
      .map((module) => ({
        moduleCode: normalizeModuleCode(module.moduleCode),
        moduleName: module.moduleName.trim() || null,
        semester: module.semester,
      }))
      .filter((module) => module.moduleCode);

    if (normalizedModules.length !== new Set(normalizedModules.map((module) => module.moduleCode)).size) {
      setNotice({ type: "error", message: "Each module code can only appear once." });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/settings/university-profile", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campus_id: campusId || null,
          faculty: faculty.trim() || null,
          year_of_study: Number(yearOfStudy) || null,
          qualification: qualification.trim() || null,
          student_number: studentNumber,
          modules: normalizedModules,
        }),
      });

      const data = (await response.json().catch(() => null)) as { updated?: boolean; error?: string } | null;
      if (!response.ok || !data?.updated) {
        throw new Error(data?.error || "Unable to update university profile.");
      }

      setNotice({ type: "success", message: "University profile updated." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to update university profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="profile-section">
        <h3>University profile</h3>
        <p className="profile-subtitle">Loading university profile...</p>
      </section>
    );
  }

  if (!universityName) {
    return (
      <section className="profile-section">
        <h3>University profile</h3>
        <p className="profile-subtitle">Complete university onboarding to manage these settings.</p>
      </section>
    );
  }

  return (
    <section className="profile-section" style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gap: "6px" }}>
        <h3 style={{ margin: 0 }}>University profile</h3>
        <p className="profile-subtitle" style={{ margin: 0 }}>
          Update your academic profile and current module list without re-running onboarding.
        </p>
      </div>

      {notice ? (
        <p className="badge" style={{ margin: 0 }}>
          {notice.message}
        </p>
      ) : null}

      <label className="profile-field">
        University
        <input type="text" value={universityName} readOnly />
      </label>

      <label className="profile-field">
        Campus
        {singleCampus ? (
          <input type="text" value={singleCampus.campusName} readOnly />
        ) : (
          <select value={campusId} onChange={(event) => setCampusId(event.target.value)}>
            <option value="">Select a campus</option>
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.campusName}
              </option>
            ))}
          </select>
        )}
      </label>

      <label className="profile-field">
        Faculty
        <input type="text" value={faculty} onChange={(event) => setFaculty(event.target.value)} />
      </label>

      <label className="profile-field">
        Year of study
        <select value={yearOfStudy} onChange={(event) => setYearOfStudy(event.target.value)}>
          {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              Year {value}
            </option>
          ))}
        </select>
      </label>

      <label className="profile-field">
        Qualification
        <input type="text" value={qualification} onChange={(event) => setQualification(event.target.value)} />
      </label>

      <label className="profile-field">
        Student number
        <input type="text" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} />
      </label>
      <p className="profile-subtitle" style={{ margin: 0 }}>
        Your student number is used to help you identify your personal exam timetable. SCHOOL never accesses your
        student portal on your behalf.
      </p>

      <div style={{ display: "grid", gap: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <h4 style={{ margin: 0 }}>Enrolled modules</h4>
          <Button variant="outline" size="sm" onClick={addModule} disabled={modules.length >= 12}>
            Add module
          </Button>
        </div>

        <div style={{ display: "grid", gap: "12px" }}>
          {modules.map((module, index) => (
            <div
              key={module.id}
              style={{
                display: "grid",
                gap: "10px",
                padding: "14px",
                borderRadius: "var(--r-lg)",
                border: "1px solid var(--border)",
                background: "rgba(255, 255, 255, 0.03)",
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

              <label className="profile-field">
                Module code
                <input
                  type="text"
                  value={module.moduleCode}
                  onChange={(event) => updateModule(module.id, { moduleCode: event.target.value.toUpperCase() })}
                  onBlur={(event) => handleModuleBlur(module.id, event.target.value)}
                />
              </label>

              <label className="profile-field">
                Module name
                <input
                  type="text"
                  value={module.moduleName}
                  onChange={(event) => updateModule(module.id, { moduleName: event.target.value })}
                />
              </label>

              <label className="profile-field">
                Semester
                <select
                  value={module.semester ?? ""}
                  onChange={(event) =>
                    updateModule(module.id, {
                      semester:
                        event.target.value === "1"
                          ? 1
                          : event.target.value === "2"
                            ? 2
                            : event.target.value === "both"
                              ? "both"
                              : null,
                    })
                  }
                >
                  <option value="">Not set</option>
                  <option value="both">Both semesters</option>
                  <option value="1">Semester 1</option>
                  <option value="2">Semester 2</option>
                </select>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variant="gold" onClick={() => void handleSave()} disabled={saving || moduleCodes.size > 12}>
          {saving ? "Saving..." : "Save university profile"}
        </Button>
      </div>
    </section>
  );
}
