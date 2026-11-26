import { existsSync } from "node:fs";
import path from "node:path";
import { writeGeneratedOutline } from "../src/generated-outline-builder.js";

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

async function main() {
  const repoRoot = findRepoRoot();
  const generated = await writeGeneratedOutline(repoRoot);

  console.log("Generated outline written to content/generated_course_outline.json");
  console.log(
    JSON.stringify(
      {
        generated_at: generated.generated_at,
        stats: generated.stats,
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
