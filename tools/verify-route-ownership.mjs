import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "apps/web/app/dashboard/page.tsx",
  "apps/web/app/learn/page.tsx",
  "apps/web/app/past-papers/page.tsx",
  "apps/web/app/community/page.tsx",
  "apps/web/app/dashboard/progress/page.tsx",
  "apps/web/app/dashboard/weaknesses/page.tsx",
  "apps/web/app/dashboard/revision/page.tsx",
  "apps/web/app/planner/page.tsx",
  "apps/web/app/assistant/page.tsx",
  "apps/web/lib/navigation/navManifest.ts",
  "docs/LEARNER_JOURNEY_ROUTE_MAP.md",
];
const missing = [];
for (const file of requiredFiles) {
  try {
    await access(path.join(root, file));
  } catch {
    missing.push(file);
  }
}

const [manifest, nextConfig, routeMap, phaseRedirect] = await Promise.all([
  readFile(path.join(root, "apps/web/lib/navigation/navManifest.ts"), "utf8"),
  readFile(path.join(root, "apps/web/next.config.mjs"), "utf8"),
  readFile(path.join(root, "docs/LEARNER_JOURNEY_ROUTE_MAP.md"), "utf8"),
  readFile(path.join(root, "apps/web/app/phase/[phase]/page.tsx"), "utf8"),
]);
const errors = [...missing.map((file) => `Missing canonical route ownership file: ${file}`)];
for (const label of ["Today", "Learn", "Practise", "Community", "Progress"]) {
  if (!manifest.includes(`label: "${label}"`)) errors.push(`Navigation manifest is missing ${label}.`);
  if (!routeMap.includes(`| ${label} |`)) errors.push(`Route map is missing ${label}.`);
}
for (const legacyPattern of ["/phase/:phase", "/phases/:phase", "/classes"]) {
  if (!nextConfig.includes(legacyPattern)) errors.push(`Missing redirect coverage for ${legacyPattern}.`);
}
if (!nextConfig.includes('destination: "/phase') || !phaseRedirect.includes('redirect("/learn")')) {
  errors.push("Legacy learning redirects must terminate at /learn.");
}

if (errors.length) {
  console.error("Route ownership check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Route ownership check passed: canonical learner spine and legacy redirect coverage are present.");
}
