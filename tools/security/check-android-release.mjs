import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const buildGradlePath = path.join(root, "apps", "android", "app", "build.gradle");
const manifestPath = path.join(root, "apps", "android", "twa-manifest.json");
const assetLinksPath = path.join(root, "apps", "web", "public", ".well-known", "assetlinks.json");
const ignorePaths = [path.join(root, ".gitignore"), path.join(root, "apps", "web", ".gitignore")];

const [buildGradle, manifestRaw, assetLinksRaw, ...ignoreContents] = await Promise.all([
  readFile(buildGradlePath, "utf8"),
  readFile(manifestPath, "utf8"),
  readFile(assetLinksPath, "utf8"),
  ...ignorePaths.map((file) => readFile(file, "utf8")),
]);

const errors = [];
const productionHost = "school.ditshego-ventures.co.za";
const packageName = "za.co.ditshego.school";

if (!buildGradle.includes(`hostName: '${productionHost}'`)) {
  errors.push(`TWA build.gradle must use production host ${productionHost}.`);
}
if (!buildGradle.includes(`applicationId: '${packageName}'`) || !buildGradle.includes(`applicationId "${packageName}"`)) {
  errors.push(`TWA build.gradle must use package ${packageName}.`);
}
if (/railway\.app|staging|saeduweb-production/i.test(buildGradle)) {
  errors.push("TWA build.gradle contains a staging/Railway host reference.");
}

let manifest;
let assetLinks;
try {
  manifest = JSON.parse(manifestRaw);
} catch {
  errors.push("twa-manifest.json is not valid JSON.");
}
try {
  assetLinks = JSON.parse(assetLinksRaw);
} catch {
  errors.push("assetlinks.json is not valid JSON.");
}
if (manifest && (manifest.host !== productionHost || manifest.packageId !== packageName)) {
  errors.push("twa-manifest.json host/packageId does not match the production Android identity.");
}
if (!Array.isArray(assetLinks) || assetLinks.length === 0) {
  errors.push("assetlinks.json must contain at least one Android app declaration.");
} else {
  const target = assetLinks.find((entry) => entry?.target?.package_name === packageName);
  const fingerprint = target?.target?.sha256_cert_fingerprints?.[0];
  if (!target || !fingerprint || /REPLACE_WITH|PLACEHOLDER|TODO/i.test(fingerprint)) {
    errors.push("assetlinks.json must contain a real SHA-256 signing fingerprint for the production package.");
  }
}
for (const [index, content] of ignoreContents.entries()) {
  if (/^(<<<<<<<|=======|>>>>>>>)/m.test(content)) {
    errors.push(`${ignorePaths[index]} still contains merge-conflict markers.`);
  }
}

if (errors.length) {
  console.error("Android release safety check failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Android release safety check passed: production TWA identity, asset links, and ignore files are consistent.");
}
