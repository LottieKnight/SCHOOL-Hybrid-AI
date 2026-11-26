import Link from "next/link";

type GradeLink = {
  key: string;
  name: string;
};

type PhaseLink = {
  key: string;
  label: string;
  grades: GradeLink[];
};

function gradeSlug(gradeKey: string) {
  const lower = gradeKey.toLowerCase();
  if (lower.startsWith("grade-")) return lower;
  if (lower === "r") return "grade-00";
  const num = Number(gradeKey);
  if (!Number.isFinite(num)) return `grade-${lower}`;
  return `grade-${String(num).padStart(2, "0")}`;
}

export function SidebarLearnMenu({ phaseGrades }: { phaseGrades: PhaseLink[] }) {
  return (
    <div className="sidebar-grade">
      <div className="sidebar-item" role="button" tabIndex={0}>
        <span className="side-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M9 4.2c-2.4 0-4.3 2-4.3 4.4v1.2c-1.5.5-2.5 1.9-2.5 3.5 0 2 1.5 3.6 3.4 3.8.2 1.7 1.7 3 3.6 3 1.3 0 2.4-.6 3.1-1.6.6 1 1.8 1.6 3.1 1.6 1.9 0 3.4-1.3 3.6-3 1.9-.2 3.4-1.9 3.4-3.8 0-1.6-1-3-2.5-3.5V8.6C19.3 6.2 17.4 4.2 15 4.2c-1.4 0-2.7.6-3.5 1.6-.8-1-2.1-1.6-3.5-1.6Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M12 6.6v10.8M7.6 8.7c1.2.1 2.1 1.1 2.1 2.4M7.2 12.1c1.3 0 2.3 1 2.3 2.2M16.4 8.7c-1.2.1-2.1 1.1-2.1 2.4M16.8 12.1c-1.3 0-2.3 1-2.3 2.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </span>
        Learn
      </div>
      <div className="grade-menu">
        <div className="phase-list">
          {phaseGrades.map((phase) => (
            <div className="phase-item" key={phase.key}>
              <Link className="phase-link" href={`/learn/${phase.key}`} prefetch={false}>
                {phase.label}
              </Link>
              <div className="grade-panel">
                <div className="grade-panel-title">{phase.label}</div>
                <div className="grade-grid">
                  {phase.grades.map((grade) => (
                    <Link
                      key={grade.key}
                      className="grade-link"
                      href={`/learn/${phase.key}/${gradeSlug(grade.key)}`}
                      prefetch={false}
                    >
                      {grade.name}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
