import fs from "node:fs";
import path from "node:path";
import { loadCourseOutline } from "../curriculum.js";
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
function mapSubject(subject) {
    const terms = subject.terms && typeof subject.terms === "object"
        ? Object.fromEntries(Object.entries(subject.terms).map(([termKey, termValue]) => [
            termKey,
            {
                name: termValue.name ?? termKey,
                weeks: Array.isArray(termValue.weeks)
                    ? termValue.weeks.map((week) => ({
                        name: week.name ?? "",
                        topic_title: week.topic_title ?? week.topic ?? "",
                        summary_md: week.summary_md ?? "",
                        outcomes: Array.isArray(week.outcomes) ? week.outcomes : undefined,
                    }))
                    : [],
            },
        ]))
        : undefined;
    const children = subject.children && typeof subject.children === "object"
        ? Object.fromEntries(Object.entries(subject.children).map(([childKey, childValue]) => [
            childKey,
            mapSubject(childValue),
        ]))
        : undefined;
    return {
        name: subject.name ?? subject.title ?? "Untitled subject",
        terms,
        children,
    };
}
export function buildCapsScaffoldFromData(outline) {
    const phases = {};
    for (const [phaseKey, phaseValue] of Object.entries(outline.phases || {})) {
        const grades = {};
        for (const [gradeKey, gradeValue] of Object.entries(phaseValue.grades || {})) {
            const groups = {};
            for (const [groupKey, groupValue] of Object.entries(gradeValue.groups || {})) {
                const subjects = {};
                for (const [subjectKey, subjectValue] of Object.entries(groupValue.subjects || {})) {
                    subjects[subjectKey] = mapSubject(subjectValue);
                }
                groups[groupKey] = {
                    name: groupValue.name ?? groupKey,
                    subjects,
                };
            }
            grades[gradeKey] = {
                name: gradeValue.name ?? `Grade ${gradeKey}`,
                groups,
            };
        }
        phases[phaseKey] = {
            name: phaseValue.name ?? phaseKey,
            grades,
        };
    }
    return { phases };
}
export function buildCapsScaffoldFromCourseOutline() {
    return buildCapsScaffoldFromData(loadCourseOutline());
}
export function ensureCapsScaffold() {
    const scaffoldPath = getCapsScaffoldPath();
    if (fs.existsSync(scaffoldPath)) {
        const raw = fs.readFileSync(scaffoldPath, "utf-8");
        return JSON.parse(raw);
    }
    const scaffold = buildCapsScaffoldFromCourseOutline();
    try {
        fs.mkdirSync(path.dirname(scaffoldPath), { recursive: true });
        fs.writeFileSync(scaffoldPath, JSON.stringify(scaffold, null, 2));
    }
    catch {
        // read-only filesystem (e.g. Vercel) — return in-memory scaffold
    }
    return scaffold;
}
export function loadCapsScaffold() {
    const scaffoldPath = getCapsScaffoldPath();
    if (!fs.existsSync(scaffoldPath)) {
        return ensureCapsScaffold();
    }
    const raw = fs.readFileSync(scaffoldPath, "utf-8");
    return JSON.parse(raw);
}
