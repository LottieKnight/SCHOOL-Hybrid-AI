// apps/api/src/scripts/backfill-lesson-images.ts
// Recursively scans lesson JSON under content/ for visuals of kind "image" with an
// empty src, generates the illustration via DALL·E 3, persists it, and writes the URL
// back. Works for both content/lessons and content/generated_lessons layouts.
//
// Run:  cd apps/api && npm run backfill:lesson-images [-- --dry-run] [-- --limit N]
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateLessonImage } from "../lib/imageGen.js";

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const CONTENT_ROOTS = [
  path.join(REPO_ROOT, "content", "lessons"),
  path.join(REPO_ROOT, "content", "generated_lessons"),
];

async function collectJson(dir: string, out: string[]): Promise<void> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJson(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      out.push(full);
    }
  }
}

async function walkLessons(): Promise<string[]> {
  const out: string[] = [];
  for (const root of CONTENT_ROOTS) {
    await collectJson(root, out);
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  const lessons = await walkLessons();
  console.log(`Found ${lessons.length} JSON files to scan.`);

  let processed = 0;
  let generated = 0;
  for (const lessonPath of lessons) {
    if (processed >= limit) break;
    processed++;
    let lesson: any;
    try {
      lesson = JSON.parse(await fs.readFile(lessonPath, "utf-8"));
    } catch {
      continue;
    }
    const visuals: any[] = Array.isArray(lesson.visuals) ? lesson.visuals : [];
    const needsImage = visuals.filter((v) => v?.kind === "image" && !v?.src);
    if (!needsImage.length) continue;

    for (const visual of needsImage) {
      const alt = visual.alt || lesson.topic || "lesson illustration";
      const context = `${lesson.topic ?? ""} — ${lesson.subjectKey ?? ""} grade ${lesson.grade ?? ""}`;
      if (dryRun) {
        console.log(`[dry-run] would generate image for: ${alt} (${lessonPath})`);
        continue;
      }
      try {
        const { url } = await generateLessonImage({ alt, context });
        visual.src = url;
        generated++;
        console.log(`✓ generated: ${alt} -> ${url}`);
      } catch (err) {
        console.error(`✗ failed for ${alt}:`, (err as Error).message);
      }
    }

    if (!dryRun && needsImage.length) {
      await fs.writeFile(lessonPath, JSON.stringify(lesson, null, 2) + "\n");
    }
  }

  console.log(`\nDone. Scanned ${processed} files, generated ${generated} images.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
