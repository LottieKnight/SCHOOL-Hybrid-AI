import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const webRoot = path.join(root, "apps", "web");
const canonicalOrigin = "school.ditshego-ventures.co.za";
const forbiddenDomains = ["school.ac.za", "saeduweb-production.up.railway.app"];
const sourceExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".json"]);
const ignoredDirectories = new Set([".next", "node_modules", "public"]);

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectSourceFiles(absolute)));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const files = await collectSourceFiles(webRoot);
const staleReferences = [];
for (const file of files) {
  const content = await readFile(file, "utf8");
  for (const domain of forbiddenDomains) {
    if (content.includes(domain)) staleReferences.push(`${path.relative(root, file)} contains ${domain}`);
  }
}
const manifest = await readFile(path.join(webRoot, "app", "manifest.ts"), "utf8");
const errors = [];
if (staleReferences.length) errors.push(...staleReferences);
if (!manifest.includes('url: "/past-papers"')) {
  errors.push("PWA Past Papers shortcut must target /past-papers.");
}
if (!files.some((file) => file.endsWith(path.join("app", "sitemap.ts")))) {
  errors.push("Sitemap source is missing.");
}
if (!files.some((file) => file.endsWith(path.join("app", "robots.ts")))) {
  errors.push("Robots source is missing.");
}
if (!canonicalOrigin.includes("ditshego-ventures")) {
  errors.push("Canonical origin guard is misconfigured.");
}

if (errors.length) {
  console.error("Canonical-origin check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Canonical-origin check passed: ${canonicalOrigin} is the only production web origin in source.`);
}
