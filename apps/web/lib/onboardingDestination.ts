export type SchoolFinishAction = "papers" | "tutor" | "learn";

export function schoolFinishHref(grade: number | null | undefined, action: SchoolFinishAction = "learn") {
  if (grade != null && grade >= 10 && grade <= 12) {
    if (action === "papers") return `/past-papers?grade=${grade}`;
    if (action === "tutor") return `/tutor?grade=${grade}&subject=Mathematics`;
  }
  if (grade != null && grade >= 0) {
    const phase = grade <= 3 ? "foundation" : grade <= 6 ? "intermediate" : grade <= 9 ? "senior" : "fet";
    const segment = grade === 0 ? "grade-00" : `grade-${String(grade).padStart(2, "0")}`;
    return `/learn/${phase}/${segment}`;
  }
  return "/dashboard";
}

export function isFetGrade(grade: number | null | undefined) {
  return grade != null && grade >= 10 && grade <= 12;
}
