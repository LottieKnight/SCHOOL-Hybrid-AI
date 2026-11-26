import fs from "node:fs";
import path from "node:path";

const outlinePath = path.join(process.cwd(), "packages", "shared", "content", "course_outline.json");
const outline = JSON.parse(fs.readFileSync(outlinePath, "utf-8"));

const VALID_PHASES = new Set(["foundation", "intermediate", "senior", "fet"]);

function pad2(value) {
  return String(value).padStart(2, "0");
}

function buildLessonHref({ phase, grade, subject, term, week }) {
  return `/phase/${phase}/grade/${pad2(grade)}/${subject}/term/${pad2(term)}/week/${pad2(week)}`;
}

function validateParams({ phase, grade, subject, term, week }) {
  if (!VALID_PHASES.has(phase)) return false;
  if (grade < 1 || grade > 12) return false;
  if (term < 1 || term > 4) return false;
  if (week < 1) return false;
  if (!subject) return false;
  return true;
}

const routeFile = path.join(
  process.cwd(),
  "apps",
  "web",
  "app",
  "phase",
  "[phase]",
  "grade",
  "[grade]",
  "[subject]",
  "term",
  "[term]",
  "week",
  "[week]",
  "page.tsx"
);

if (!fs.existsSync(routeFile)) {
  console.error("Canonical lesson route file missing:", routeFile);
  process.exit(1);
}

const links = [];
Object.entries(outline.phases).forEach(([phaseKey, phase]) => {
  Object.entries(phase.grades || {}).forEach(([gradeKey, grade]) => {
    const gradeNumber = Number(String(gradeKey).replace(/\D/g, "")) || Number(gradeKey);
    Object.values(grade.groups || {}).forEach((group) => {
      Object.entries(group.subjects || {}).forEach(([subjectKey, subject]) => {
        const subjectNodes = subject.children ? Object.keys(subject.children) : [subjectKey];
        subjectNodes.forEach((subjectNode) => {
          const terms = subject.children
            ? subject.children[subjectNode]?.terms
            : subject.terms;
          Object.entries(terms || {}).forEach(([termKey, term]) => {
            (term.weeks || []).forEach((_, idx) => {
              const termNumber = Number(String(termKey).replace(/\D/g, "")) || 0;
              const weekNumber = idx + 1;
              const params = {
                phase: phaseKey,
                grade: gradeNumber,
                subject: subjectNode,
                term: termNumber,
                week: weekNumber,
              };
              if (!validateParams(params)) {
                console.error("Invalid params", params);
                process.exit(1);
              }
              links.push(buildLessonHref(params));
            });
          });
        });
      });
    });
  });
});

const invalid = links.filter((href) => !href.startsWith("/phase/"));
if (invalid.length) {
  console.error("Invalid links detected:", invalid.slice(0, 5));
  process.exit(1);
}

console.log(`Validated ${links.length} weekly lesson links.`);
