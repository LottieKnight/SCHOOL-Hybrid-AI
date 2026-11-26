import { existsSync, readFileSync } from "node:fs";
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
export function loadGeneratedOutline() {
    const repoRoot = findRepoRoot();
    const filePath = path.join(repoRoot, "content", "generated_course_outline.json");
    if (!existsSync(filePath))
        return null;
    try {
        const raw = readFileSync(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
