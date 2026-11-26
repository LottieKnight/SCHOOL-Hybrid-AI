export function mapPhasePathToLearnPath(pathname: string) {
  if (!pathname.startsWith("/phase/")) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const phase = segments[1];
  const gradeIndex = segments.indexOf("grade");
  const subjectIndex = segments.indexOf("subject");
  const childIndex = segments.indexOf("child");
  const termIndex = segments.indexOf("term");
  const weekIndex = segments.indexOf("week");

  const grade = gradeIndex >= 0 ? segments[gradeIndex + 1] : null;
  let subject = subjectIndex >= 0 ? segments[subjectIndex + 1] : null;
  const child = childIndex >= 0 ? segments[childIndex + 1] : null;

  if (subject && child) {
    subject = `${subject}__${child}`;
  }

  const termRaw = termIndex >= 0 ? segments[termIndex + 1] : null;
  const weekRaw = weekIndex >= 0 ? segments[weekIndex + 1] : null;
  const term = termRaw ? termRaw.replace(/\D/g, "") : null;
  const week = weekRaw ? weekRaw.replace(/\D/g, "") : null;

  const gradeSlug = (() => {
    if (!grade) return null;
    const lower = grade.toLowerCase();
    if (lower.startsWith("grade-")) return lower;
    if (lower === "r") return "grade-00";
    const num = Number(grade);
    if (!Number.isFinite(num)) return `grade-${lower}`;
    return `grade-${String(num).padStart(2, "0")}`;
  })();

  let nextPath = phase ? `/learn/${phase}` : "/learn";
  if (gradeSlug) nextPath += `/${gradeSlug}`;
  if (subject) nextPath += `/${subject}`;
  if (term) nextPath += `/term/${term}`;
  if (week) nextPath += `/week/${week}`;

  return nextPath;
}
