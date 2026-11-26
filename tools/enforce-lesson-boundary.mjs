import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const scanRoots = [
  path.join(repoRoot, "apps", "web", "app"),
  path.join(repoRoot, "apps", "web", "components"),
  path.join(repoRoot, "apps", "web", "lib"),
];

const tsExtensions = new Set([".ts", ".tsx"]);
const ignoreDirNames = new Set([".next", "node_modules"]);

const retiredEndpointRefs = [
  "/api/admin/gen/",
  "/api/admin/rag/generate",
  "/api/admin/v2/",
  "/api/content/lesson",
  "/api/v2/lesson",
  "/api/v2/lessons",
];

const retiredRouteFiles = [
  "apps/web/app/api/admin/gen/lesson/route.ts",
  "apps/web/app/api/admin/gen/term/route.ts",
  "apps/web/app/api/admin/generate-lesson/route.ts",
  "apps/web/app/api/admin/rag/generate/route.ts",
  "apps/web/app/api/admin/v2/generate-week/route.ts",
  "apps/web/app/api/admin/v2/generate-term/route.ts",
  "apps/web/app/api/admin/v2/regenerate-lesson/route.ts",
  "apps/web/app/api/content/lesson/route.ts",
  "apps/web/app/api/v2/lesson/route.ts",
  "apps/web/app/api/v2/lessons/route.ts",
];

const canonicalWebProxyRoutes = [
  {
    file: "apps/web/app/api/admin/generate-lesson-v1/route.ts",
    requiredText: 'proxyAdminLessonPost(request, "/admin/lessons/v1/generate-week", payload)',
  },
  {
    file: "apps/web/app/api/admin/generate-term-v1/route.ts",
    requiredText: 'proxyAdminLessonPost(request, "/admin/lessons/v1/generate-term", payload)',
  },
];

const canonicalWebRouteDisallowedText = ["generateLessonV1", "writeGeneratedLessonFiles", "getGeneratedLessonOutputPaths"];

function walkFiles(dirPath, out) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirNames.has(entry.name)) continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!tsExtensions.has(path.extname(entry.name))) continue;
    out.push(fullPath);
  }
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function formatViolation(filePath, lineNumber, message) {
  return `${rel(filePath)}:${lineNumber} ${message}`;
}

const files = [];
for (const root of scanRoots) {
  if (fs.existsSync(root)) {
    walkFiles(root, files);
  }
}

const violations = [];

for (const filePath of files) {
  const source = fs.readFileSync(filePath, "utf-8");
  const lines = source.split(/\r?\n/);

  for (const ref of retiredEndpointRefs) {
    lines.forEach((line, idx) => {
      if (line.includes(ref)) {
        violations.push(formatViolation(filePath, idx + 1, `references retired endpoint "${ref}"`));
      }
    });
  }

  const isWebApiRoute = rel(filePath).startsWith("apps/web/app/api/");
  if (isWebApiRoute) {
    lines.forEach((line, idx) => {
      if (line.includes("getDbPool")) {
        violations.push(formatViolation(filePath, idx + 1, "uses getDbPool in web route handler"));
      }
    });
  }
}

for (const retiredRoute of retiredRouteFiles) {
  const fullPath = path.join(repoRoot, retiredRoute);
  if (!fs.existsSync(fullPath)) {
    violations.push(`${retiredRoute}:1 retired route file missing`);
    continue;
  }
  const source = fs.readFileSync(fullPath, "utf-8");
  if (!source.includes("retiredRouteResponse")) {
    violations.push(`${retiredRoute}:1 retired route must use retiredRouteResponse`);
  }
}

for (const proxyRoute of canonicalWebProxyRoutes) {
  const fullPath = path.join(repoRoot, proxyRoute.file);
  if (!fs.existsSync(fullPath)) {
    violations.push(`${proxyRoute.file}:1 canonical web proxy route missing`);
    continue;
  }
  const source = fs.readFileSync(fullPath, "utf-8");
  if (!source.includes(proxyRoute.requiredText)) {
    violations.push(`${proxyRoute.file}:1 must proxy to API path via proxyAdminLessonPost`);
  }
  for (const disallowedText of canonicalWebRouteDisallowedText) {
    if (source.includes(disallowedText)) {
      violations.push(`${proxyRoute.file}:1 must not perform lesson generation logic (${disallowedText})`);
    }
  }
}

const adminApiRouteFile = path.join(repoRoot, "apps/api/src/routes/admin.ts");
if (!fs.existsSync(adminApiRouteFile)) {
  violations.push("apps/api/src/routes/admin.ts:1 admin API routes file missing");
} else {
  const source = fs.readFileSync(adminApiRouteFile, "utf-8");
  if (!source.includes('/admin/lessons/v1/generate-week')) {
    violations.push("apps/api/src/routes/admin.ts:1 missing canonical week generation endpoint");
  }
  if (!source.includes('/admin/lessons/v1/generate-term')) {
    violations.push("apps/api/src/routes/admin.ts:1 missing canonical term generation endpoint");
  }
}

if (violations.length) {
  console.error("Lesson boundary violations found:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("Lesson boundary check passed.");
