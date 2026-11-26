import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
function pad2(value) {
    return String(value).padStart(2, "0");
}
function gradeToPhase(grade) {
    if (grade <= 3)
        return "foundation";
    if (grade <= 6)
        return "intermediate";
    if (grade <= 9)
        return "senior";
    return "fet";
}
function resolveRepoRoot() {
    const cwd = process.cwd();
    const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
    let fallback = cwd;
    for (const candidate of candidates) {
        if (existsSync(path.join(candidate, "content"))) {
            fallback = candidate;
            if (existsSync(path.join(candidate, "apps"))) {
                return candidate;
            }
        }
    }
    return fallback;
}
function ensureWeekEntry(index, params) {
    if (!index.phases[params.phase]) {
        index.phases[params.phase] = { grades: {} };
    }
    const phaseNode = index.phases[params.phase];
    if (!phaseNode.grades[params.grade]) {
        phaseNode.grades[params.grade] = { subjects: {} };
    }
    const gradeNode = phaseNode.grades[params.grade];
    if (!gradeNode.subjects[params.subject]) {
        gradeNode.subjects[params.subject] = { terms: {} };
    }
    const subjectNode = gradeNode.subjects[params.subject];
    if (!subjectNode.terms[params.term]) {
        subjectNode.terms[params.term] = { weeks: {} };
    }
    const termNode = subjectNode.terms[params.term];
    if (!termNode.weeks[params.week]) {
        termNode.weeks[params.week] = { hasLessonJson: false, resourcesCount: 0, resourceTypes: [] };
    }
    return termNode.weeks[params.week];
}
function resourceTypeFromName(filename) {
    const lower = filename.toLowerCase();
    if (lower.startsWith("lesson."))
        return "lesson";
    if (lower.startsWith("worksheet."))
        return "worksheet";
    if (lower.startsWith("assessment."))
        return "assessment";
    if (lower.startsWith("memo."))
        return "memo";
    if (lower.startsWith("resources."))
        return "resources";
    if (lower.startsWith("teacher-notes."))
        return "teacher_notes";
    if (lower.startsWith("slides."))
        return "slides";
    if (lower.endsWith(".ppt") || lower.endsWith(".pptx"))
        return "slides";
    return "other";
}
async function scanPdfWeeks(pdfRoot, index) {
    if (!existsSync(pdfRoot))
        return;
    const phases = await fs.readdir(pdfRoot, { withFileTypes: true });
    for (const phaseEntry of phases) {
        if (!phaseEntry.isDirectory())
            continue;
        if (phaseEntry.name.startsWith("_") || phaseEntry.name.toLowerCase() === "unmapped")
            continue;
        const phase = phaseEntry.name;
        const phasePath = path.join(pdfRoot, phase);
        const gradeDirs = await fs.readdir(phasePath, { withFileTypes: true });
        for (const gradeEntry of gradeDirs) {
            if (!gradeEntry.isDirectory() || !gradeEntry.name.startsWith("grade-"))
                continue;
            const grade = gradeEntry.name.replace("grade-", "");
            const gradePath = path.join(phasePath, gradeEntry.name);
            const subjectDirs = await fs.readdir(gradePath, { withFileTypes: true });
            for (const subjectEntry of subjectDirs) {
                if (!subjectEntry.isDirectory())
                    continue;
                const subject = subjectEntry.name;
                const subjectPath = path.join(gradePath, subjectEntry.name);
                const termDirs = await fs.readdir(subjectPath, { withFileTypes: true });
                for (const termEntry of termDirs) {
                    if (!termEntry.isDirectory() || !termEntry.name.startsWith("term-"))
                        continue;
                    const term = termEntry.name.replace("term-", "");
                    const termPath = path.join(subjectPath, termEntry.name);
                    const weekDirs = await fs.readdir(termPath, { withFileTypes: true });
                    for (const weekEntry of weekDirs) {
                        if (!weekEntry.isDirectory() || !weekEntry.name.startsWith("week-"))
                            continue;
                        const week = weekEntry.name.replace("week-", "");
                        const weekPath = path.join(termPath, weekEntry.name);
                        const files = await fs.readdir(weekPath, { withFileTypes: true });
                        const resourceFiles = files.filter((file) => file.isFile());
                        const resourcesCount = resourceFiles.length;
                        const resourceTypes = Array.from(new Set(resourceFiles.map((file) => resourceTypeFromName(file.name)))).sort();
                        const entry = ensureWeekEntry(index, { phase, grade, subject, term, week });
                        entry.resourcesCount = resourcesCount;
                        entry.resourceTypes = resourceTypes;
                    }
                }
            }
        }
    }
}
async function scanLessonJson(lessonsRoot, index) {
    if (!existsSync(lessonsRoot))
        return;
    const gradeDirs = await fs.readdir(lessonsRoot, { withFileTypes: true });
    for (const gradeEntry of gradeDirs) {
        if (!gradeEntry.isDirectory() || !gradeEntry.name.startsWith("grade-"))
            continue;
        const gradeKey = gradeEntry.name.replace("grade-", "");
        const gradeNumber = Number(gradeKey);
        const phase = gradeToPhase(Number.isFinite(gradeNumber) ? gradeNumber : 0);
        const gradePath = path.join(lessonsRoot, gradeEntry.name);
        const subjectDirs = await fs.readdir(gradePath, { withFileTypes: true });
        for (const subjectEntry of subjectDirs) {
            if (!subjectEntry.isDirectory())
                continue;
            const subject = subjectEntry.name;
            const subjectPath = path.join(gradePath, subjectEntry.name);
            const termDirs = await fs.readdir(subjectPath, { withFileTypes: true });
            for (const termEntry of termDirs) {
                if (!termEntry.isDirectory() || !termEntry.name.startsWith("term-"))
                    continue;
                const term = termEntry.name.replace("term-", "");
                const termPath = path.join(subjectPath, termEntry.name);
                const weekFiles = await fs.readdir(termPath, { withFileTypes: true });
                for (const weekEntry of weekFiles) {
                    if (!weekEntry.isFile() || !weekEntry.name.startsWith("week-"))
                        continue;
                    const match = weekEntry.name.match(/^week-([0-9]{2})\.json$/);
                    if (!match)
                        continue;
                    const week = match[1];
                    const entry = ensureWeekEntry(index, { phase, grade: gradeKey, subject, term, week });
                    entry.hasLessonJson = true;
                }
            }
        }
    }
}
export async function generateContentIndex(repoRoot) {
    const root = repoRoot || resolveRepoRoot();
    const index = {
        generated_at: new Date().toISOString(),
        stats: {
            total_week_folders: 0,
            weeks_with_json: 0,
            weeks_with_resources_only: 0,
            phases: 0,
            grades: 0,
            subjects: 0,
        },
        phases: {},
    };
    await scanPdfWeeks(path.join(root, "content", "pdf"), index);
    await scanLessonJson(path.join(root, "content", "lessons"), index);
    index.generated_at = new Date().toISOString();
    index.stats = summarizeContentIndex(index);
    index.phases = sortIndex(index.phases);
    return index;
}
export async function writeContentIndex(repoRoot) {
    const root = repoRoot || resolveRepoRoot();
    const index = await generateContentIndex(root);
    const targetPath = path.join(root, "content", "content_index.json");
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, JSON.stringify(index, null, 2));
    return index;
}
export function summarizeContentIndex(index) {
    if (!index) {
        return {
            total_week_folders: 0,
            weeks_with_json: 0,
            weeks_with_resources_only: 0,
            phases: 0,
            grades: 0,
            subjects: 0,
        };
    }
    let totalWeeks = 0;
    let weeksWithJson = 0;
    let weeksResourcesOnly = 0;
    let grades = 0;
    let subjects = 0;
    const phaseKeys = Object.keys(index.phases || {});
    for (const phaseKey of phaseKeys) {
        const gradeEntries = index.phases[phaseKey]?.grades || {};
        for (const gradeKey of Object.keys(gradeEntries)) {
            grades += 1;
            const subjectEntries = gradeEntries[gradeKey]?.subjects || {};
            for (const subjectKey of Object.keys(subjectEntries)) {
                subjects += 1;
                const termEntries = subjectEntries[subjectKey]?.terms || {};
                for (const termKey of Object.keys(termEntries)) {
                    const weekEntries = termEntries[termKey]?.weeks || {};
                    for (const weekKey of Object.keys(weekEntries)) {
                        totalWeeks += 1;
                        const week = weekEntries[weekKey];
                        if (week.hasLessonJson) {
                            weeksWithJson += 1;
                        }
                        else if (week.resourcesCount > 0) {
                            weeksResourcesOnly += 1;
                        }
                    }
                }
            }
        }
    }
    return {
        total_week_folders: totalWeeks,
        weeks_with_json: weeksWithJson,
        weeks_with_resources_only: weeksResourcesOnly,
        phases: phaseKeys.length,
        grades,
        subjects,
    };
}
export function normalizeGradeKey(grade) {
    const numeric = typeof grade === "number" ? grade : Number(grade);
    if (!Number.isFinite(numeric))
        return String(grade);
    return pad2(numeric);
}
function sortIndex(phases) {
    const sortedPhases = {};
    Object.keys(phases)
        .sort()
        .forEach((phaseKey) => {
        const phase = phases[phaseKey];
        const sortedGrades = {};
        Object.keys(phase.grades)
            .sort()
            .forEach((gradeKey) => {
            const grade = phase.grades[gradeKey];
            const sortedSubjects = {};
            Object.keys(grade.subjects)
                .sort()
                .forEach((subjectKey) => {
                const subject = grade.subjects[subjectKey];
                const sortedTerms = {};
                Object.keys(subject.terms)
                    .sort()
                    .forEach((termKey) => {
                    const term = subject.terms[termKey];
                    const sortedWeeks = {};
                    Object.keys(term.weeks)
                        .sort()
                        .forEach((weekKey) => {
                        sortedWeeks[weekKey] = term.weeks[weekKey];
                    });
                    sortedTerms[termKey] = { weeks: sortedWeeks };
                });
                sortedSubjects[subjectKey] = { terms: sortedTerms };
            });
            sortedGrades[gradeKey] = { subjects: sortedSubjects };
        });
        sortedPhases[phaseKey] = { grades: sortedGrades };
    });
    return sortedPhases;
}
