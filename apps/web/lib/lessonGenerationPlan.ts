export type LessonGenerationPlanTarget = {
  id: string;
  label: string;
  queueKey: string;
  targetType: "subject" | "module";
  storagePath: string;
  storagePattern?: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type LessonGenerationPlan = {
  studyType: "school" | "university";
  summary: string;
  storageRoot: string;
  targets: LessonGenerationPlanTarget[];
};

type SchoolInput = {
  grade: number;
  phase: string | null;
  subjects: Array<{ key: string | null; name: string }>;
};

type UniversityModuleInput = {
  code: string;
  name: string;
  semester?: number | "both" | null;
  yearOfStudy: number;
  credits?: number | null;
  isCore?: boolean | null;
  durationType?: "semester" | "year" | null;
  durationLabel?: string | null;
  assumed?: boolean;
  source?: string;
};

type UniversityInput = {
  institution: string;
  faculty: string;
  course: string;
  yearOfStudy: number;
  modules: UniversityModuleInput[];
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

export function planSchoolLessonGeneration(input: SchoolInput): LessonGenerationPlan {
  const phase = input.phase?.trim() || "school";
  const grade = Number.isFinite(input.grade) ? input.grade : 0;
  const gradeLabel = grade === 0 ? "Grade R" : `Grade ${grade}`;
  const storageRoot = `content/lesson-generation/school/${slugify(phase)}/grade-${String(grade).padStart(2, "0")}`;
  const targets = input.subjects
    .filter((subject) => subject.name.trim())
    .map((subject) => {
      const subjectKey = slugify(subject.key || subject.name);
      return {
        id: `school:${grade}:${subjectKey}`,
        label: subject.name.trim(),
        queueKey: `school:${grade}:${subjectKey}`,
        targetType: "subject" as const,
        storagePath: `${storageRoot}/${subjectKey}`,
        storagePattern: `${storageRoot}/${subjectKey}/term-*/week-*`,
        metadata: {
          phase,
          grade,
          subjectKey,
        },
      };
    });

  return {
    studyType: "school",
    summary: `Queue ${targets.length} school subject${targets.length === 1 ? "" : "s"} for ${gradeLabel}.`,
    storageRoot,
    targets,
  };
}

export function planUniversityLessonGeneration(input: UniversityInput): LessonGenerationPlan {
  const institutionKey = slugify(input.institution);
  const facultyKey = slugify(input.faculty);
  const courseKey = slugify(input.course);
  const yearOfStudy = Number.isFinite(input.yearOfStudy) ? input.yearOfStudy : 1;
  const storageRoot = `content/lesson-generation/university/${institutionKey}/${facultyKey}/${courseKey}/year-${yearOfStudy}`;
  const targets = input.modules
    .filter((module) => module.code.trim() && module.name.trim())
    .map((module) => {
      const moduleCode = module.code.trim().toUpperCase();
      const moduleKey = slugify(moduleCode);
      return {
        id: `university:${yearOfStudy}:${moduleCode}`,
        label: `${moduleCode} - ${module.name.trim()}`,
        queueKey: `university:${yearOfStudy}:${moduleCode}`,
        targetType: "module" as const,
        storagePath: `${storageRoot}/${moduleKey}`,
        storagePattern: `${storageRoot}/${moduleKey}/semester-*`,
        metadata: {
          institution: input.institution,
          faculty: input.faculty,
          course: input.course,
          yearOfStudy,
          moduleCode,
          semester:
            module.semester === 1 || module.semester === 2 ? module.semester : module.semester === "both" ? "both" : null,
          source: module.source ?? (module.assumed ? "yearbook" : "manual"),
        },
      };
    });

  return {
    studyType: "university",
    summary: `Queue ${targets.length} university module${targets.length === 1 ? "" : "s"} for Year ${yearOfStudy}.`,
    storageRoot,
    targets,
  };
}
