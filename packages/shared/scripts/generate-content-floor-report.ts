import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { evaluateContentFloor, generateContentIndex } from "../src/content-index.js";

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.join(cwd, ".."), path.join(cwd, "..", "..")];
  return candidates.find((candidate) => existsSync(path.join(candidate, "content"))) ?? cwd;
}

function markdownReport(report: ReturnType<typeof evaluateContentFloor>) {
  const lines = [
    "# Minimum Trustworthy Content Floor",
    "",
    `Generated: ${report.generated_at}`,
    "",
    "This report measures the learner-visible curriculum floor from the checked content index. A lesson week requires a validated lesson JSON; resources-only weeks are visible but must not be represented as complete lessons.",
    "",
    "## Overall",
    "",
    `- Status: **${report.overall.status.toUpperCase()}**`,
    `- Lesson coverage: ${report.overall.weeksWithLessonJson}/${report.overall.totalWeeks} weeks (${report.overall.lessonCoveragePercent}%)`,
    `- Resource coverage: ${report.overall.weeksWithResources}/${report.overall.totalWeeks} weeks (${report.overall.resourceCoveragePercent}%)`,
    `- Green threshold: ${report.thresholds.greenLessonCoveragePercent}% lesson coverage and ${report.thresholds.minimumResourceCoveragePercent}% resource coverage`,
    `- Amber threshold: ${report.thresholds.amberLessonCoveragePercent}% lesson coverage with some resources present`,
    "",
    "## Subject coverage",
    "",
    "| Phase | Grade | Subject | Lesson weeks | Resources | Lesson coverage | Status |",
    "|---|---:|---|---:|---:|---:|---|",
    ...report.subjects.map((subject) =>
      `| ${subject.phase} | ${subject.grade} | ${subject.subject} | ${subject.weeksWithLessonJson}/${subject.totalWeeks} | ${subject.weeksWithResources}/${subject.totalWeeks} | ${subject.lessonCoveragePercent}% | ${subject.status} |`,
    ),
    "",
    "## Launch interpretation",
    "",
    "- Green subjects are safe to promote as complete learner pathways.",
    "- Amber subjects require explicit availability labels and should not be marketed as full coverage.",
    "- Red subjects should remain discoverable only through a clearly labelled preview or waitlist state until validated lessons exist.",
  ];
  return lines.join("\n") + "\n";
}

async function main() {
  const repoRoot = findRepoRoot();
  const index = await generateContentIndex(repoRoot);
  const report = evaluateContentFloor(index, {
    greenLessonCoveragePercent: Number(process.env.CONTENT_FLOOR_GREEN_PERCENT || 80),
    amberLessonCoveragePercent: Number(process.env.CONTENT_FLOOR_AMBER_PERCENT || 50),
    minimumResourceCoveragePercent: Number(process.env.CONTENT_FLOOR_RESOURCE_PERCENT || 90),
  });
  const reportPath = path.join(repoRoot, "content", "reports", "content_floor_report.md");
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, markdownReport(report));
  console.log(JSON.stringify({ reportPath, ...report.overall }, null, 2));
  if (process.env.CONTENT_FLOOR_STRICT === "true" && report.overall.status === "red") {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
