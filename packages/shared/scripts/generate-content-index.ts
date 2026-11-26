import { writeContentIndex } from "../src/content-index.js";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

function findRepoRoot() {
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

async function writeReport(repoRoot: string, index: any) {
  const stats = index.stats;
  const lines = [
    "# Content Index Report",
    "",
    `Generated: ${index.generated_at}`,
    "",
    "## Stats",
    "",
    `Total week folders: ${stats.total_week_folders}`,
    `Weeks with JSON: ${stats.weeks_with_json}`,
    `Weeks with resources only: ${stats.weeks_with_resources_only}`,
    `Phases: ${stats.phases}`,
    `Grades: ${stats.grades}`,
    `Subjects: ${stats.subjects}`,
    "",
  ];
  const reportPath = path.join(repoRoot, "content", "reports", "content_index_report.md");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, lines.join("\n"));
}

async function main() {
  const repoRoot = findRepoRoot();
  const index = await writeContentIndex(repoRoot);
  const summary = index.stats;
  await writeReport(repoRoot, index);
  console.log("Content index generated.");
  console.log(
    JSON.stringify(
      {
        generated_at: index.generated_at,
        totalWeeks: summary.total_week_folders,
        weeksWithJson: summary.weeks_with_json,
        weeksResourcesOnly: summary.weeks_with_resources_only,
        phases: summary.phases,
        grades: summary.grades,
        subjects: summary.subjects,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
