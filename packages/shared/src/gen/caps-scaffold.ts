import fs from "node:fs";
import path from "node:path";
import { loadCourseOutline } from "../curriculum.js";
import type { VideoLessonMeta } from "../generated-lessons-v1.js";

export type CapsScaffoldWeek = {
  name: string;
  topic_title: string;
  summary_md?: string;
  outcomes?: string[];
  video_url?: string;
  video?: VideoLessonMeta;
};

export type CapsScaffoldTerm = {
  name: string;
  weeks: CapsScaffoldWeek[];
};

export type CapsScaffoldSubject = {
  name: string;
  terms?: Record<string, CapsScaffoldTerm>;
  children?: Record<string, CapsScaffoldSubject>;
};

export type CapsScaffoldGroup = {
  name: string;
  subjects: Record<string, CapsScaffoldSubject>;
};

export type CapsScaffoldGrade = {
  name: string;
  groups: Record<string, CapsScaffoldGroup>;
};

export type CapsScaffoldPhase = {
  name: string;
  grades: Record<string, CapsScaffoldGrade>;
};

export type CapsScaffold = {
  phases: Record<string, CapsScaffoldPhase>;
};

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "content"))) {
      return candidate;
    }
  }
  return cwd;
}

export function getCapsScaffoldPath() {
  const repoRoot = findRepoRoot();
  return path.join(repoRoot, "content", "caps_scaffold.json");
}

function mapSubject(subject: any): CapsScaffoldSubject {
  const terms =
    subject.terms && typeof subject.terms === "object"
      ? Object.fromEntries(
          Object.entries(subject.terms).map(([termKey, termValue]: [string, any]) => [
            termKey,
            {
              name: termValue.name ?? termKey,
              weeks: Array.isArray(termValue.weeks)
                ? termValue.weeks.map((week: any) => ({
                    name: week.name ?? "",
                    topic_title: week.topic_title ?? week.topic ?? "",
                    summary_md: week.summary_md ?? "",
                    outcomes: Array.isArray(week.outcomes) ? week.outcomes : undefined,
                  }))
                : [],
            },
          ])
        )
      : undefined;

  const children =
    subject.children && typeof subject.children === "object"
      ? Object.fromEntries(
          Object.entries(subject.children).map(([childKey, childValue]: [string, any]) => [
            childKey,
            mapSubject(childValue),
          ])
        )
      : undefined;

  return {
    name: subject.name ?? subject.title ?? "Untitled subject",
    terms,
    children,
  };
}

export function buildCapsScaffoldFromData(outline: any): CapsScaffold {
  const phases: CapsScaffold["phases"] = {};

  for (const [phaseKey, phaseValue] of Object.entries(outline.phases || {}) as [string, any][]) {
    const grades: Record<string, CapsScaffoldGrade> = {};
    for (const [gradeKey, gradeValue] of Object.entries(phaseValue.grades || {})) {
      const groups: Record<string, CapsScaffoldGroup> = {};
      for (const [groupKey, groupValue] of Object.entries((gradeValue as any).groups || {})) {
        const subjects: Record<string, CapsScaffoldSubject> = {};
        for (const [subjectKey, subjectValue] of Object.entries((groupValue as any).subjects || {})) {
          subjects[subjectKey] = mapSubject(subjectValue);
        }
        groups[groupKey] = {
          name: (groupValue as any).name ?? groupKey,
          subjects,
        };
      }
      grades[gradeKey] = {
        name: (gradeValue as any).name ?? `Grade ${gradeKey}`,
        groups,
      };
    }
    phases[phaseKey] = {
      name: (phaseValue as any).name ?? phaseKey,
      grades,
    };
  }

  return { phases };
}

export function buildCapsScaffoldFromCourseOutline(): CapsScaffold {
  return buildCapsScaffoldFromData(loadCourseOutline());
}

export function ensureCapsScaffold(): CapsScaffold {
  const scaffoldPath = getCapsScaffoldPath();
  if (fs.existsSync(scaffoldPath)) {
    const raw = fs.readFileSync(scaffoldPath, "utf-8");
    return JSON.parse(raw) as CapsScaffold;
  }
  const scaffold = buildCapsScaffoldFromCourseOutline();
  try {
    fs.mkdirSync(path.dirname(scaffoldPath), { recursive: true });
    fs.writeFileSync(scaffoldPath, JSON.stringify(scaffold, null, 2));
  } catch {
    // read-only filesystem (e.g. Vercel) — return in-memory scaffold
  }
  return scaffold;
}

export function loadCapsScaffold(): CapsScaffold {
  const scaffoldPath = getCapsScaffoldPath();
  if (!fs.existsSync(scaffoldPath)) {
    return ensureCapsScaffold();
  }
  const raw = fs.readFileSync(scaffoldPath, "utf-8");
  return JSON.parse(raw) as CapsScaffold;
}
