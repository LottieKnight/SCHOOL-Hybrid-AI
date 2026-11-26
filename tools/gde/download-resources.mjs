import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

const manifestPath = path.join(repoRoot, "content", "sources", "gde_lrip_mip_links.json");
const incomingRoot = path.join(repoRoot, "content", "pdf", "_incoming", "gde_lrip_mip");
const normalizedRoot = path.join(repoRoot, "content", "pdf");
const reportPath = path.join(repoRoot, "content", "reports", "gde_download_report.json");
const queuePath = path.join(repoRoot, "content", "reports", "gde_download_queue.json");

const args = process.argv.slice(2);
const drainMode = args.includes("--drain");

const MAX_PER_RUN = Number(process.env.GDE_MAX_DOWNLOAD || (drainMode ? 3 : 50));
const MAX_ITERATIONS = Number(process.env.GDE_MAX_ITERATIONS || (drainMode ? 200 : 1));
const MAX_ATTEMPTS = Number(process.env.GDE_MAX_ATTEMPTS || 3);
const DRAIN_CAP = Number(process.env.GDE_DRAIN_CAP || 10000);
const FETCH_TIMEOUT_MS = Number(process.env.GDE_FETCH_TIMEOUT_MS || 30000);
const DOWNLOAD_TIMEOUT_MS = Number(process.env.GDE_DOWNLOAD_TIMEOUT_MS || (drainMode ? 180000 : 60000));

const allowedExtensions = new Set([
  ".pdf",
  ".docx",
  ".doc",
  ".pptx",
  ".ppt",
  ".xlsx",
  ".xls",
  ".zip",
]);

const subjectKeywords = [
  "english-home-language",
  "afrikaans-home-language",
  "life-skills",
  "mathematics",
  "natural-sciences",
  "social-sciences",
  "technology",
  "life-orientation",
  "economic-management-sciences",
  "creative-arts",
  "isixhosa",
  "isizulu",
  "sePedi",
  "setswana",
  "sesotho",
  "tshivenda",
  "siswati",
  "isindebele",
  "english-first-additional-language",
  "afrikaans-first-additional-language",
];

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function parseGrade(text) {
  const match =
    text.match(/grade[-\s_]*([0-9]{1,2}|r)\b/i) ||
    text.match(/\bgr(?:ade)?[-\s_]*([0-9]{1,2}|r)\b/i) ||
    text.match(/\bg([0-9]{1,2}|r)\b/i);
  if (!match) return null;
  const raw = match[1].toLowerCase();
  if (raw === "r") return 0;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? num : null;
}

function parseTerm(text) {
  const match = text.match(/term[-\s_]*([0-9]{1,2})\b/i) || text.match(/\bt([0-9]{1,2})\b/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  if (value < 1 || value > 4) return null;
  return value;
}

function parseWeek(text) {
  const match =
    text.match(/week[-\s_]*([0-9]{1,2})\b/i) ||
    text.match(/\bw([0-9]{1,2})\b/i) ||
    text.match(/\bwk[-\s_]*([0-9]{1,2})\b/i);
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

function detectSubject(text, segments) {
  for (const keyword of subjectKeywords) {
    if (text.includes(keyword.replace(/-/g, " "))) {
      return normalizeSubjectKey(keyword);
    }
    if (text.includes(keyword)) {
      return normalizeSubjectKey(keyword);
    }
  }
  const gradeIndex = segments.findIndex((segment) => segment.includes("grade"));
  if (gradeIndex >= 0 && segments[gradeIndex + 1]) {
    const candidate = segments[gradeIndex + 1];
    if (!candidate.includes("term") && !candidate.includes("week")) {
      return normalizeSubjectKey(candidate);
    }
  }
  return null;
}

const languageSubjects = new Set([
  "english",
  "afrikaans",
  "isizulu",
  "isixhosa",
  "isindebele",
  "siswati",
  "sesotho",
  "sepedi",
  "setswana",
  "tshivenda",
  "xitsonga",
]);

function normalizeSubjectKey(raw) {
  const slug = slugify(raw);
  if (!slug) return slug;
  if (slug.endsWith("-home-language") || slug.endsWith("-first-additional-language")) {
    return slug;
  }
  if (languageSubjects.has(slug)) {
    return `${slug}-home-language`;
  }
  return slug;
}

function inferPhase(grade, labelGuess, text) {
  if (labelGuess && ["foundation", "intermediate", "senior"].includes(labelGuess)) {
    return labelGuess;
  }
  if (grade !== null && grade !== undefined) {
    if (grade <= 3) return "foundation";
    if (grade <= 6) return "intermediate";
    if (grade <= 9) return "senior";
  }
  if (text.includes("foundation")) return "foundation";
  if (text.includes("intermediate")) return "intermediate";
  if (text.includes("senior")) return "senior";
  return "other";
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
}

function fileExt(name) {
  return path.extname(name).toLowerCase();
}

function standardFileName(originalName) {
  const lower = originalName.toLowerCase();
  const ext = fileExt(originalName);
  if (ext === ".ppt" || ext === ".pptx") return `slides${ext}`;
  if (lower.includes("worksheet") || lower.includes("activity") || lower.includes("practice")) {
    return `worksheet${ext || ".pdf"}`;
  }
  if (lower.includes("assessment") || lower.includes("test") || lower.includes("exam")) {
    return `assessment${ext || ".pdf"}`;
  }
  if (lower.includes("memo") || lower.includes("memorandum") || lower.includes("answers")) {
    return `memo${ext || ".pdf"}`;
  }
  if (lower.includes("lesson") || lower.includes("teaching") || lower.includes("teacher")) {
    return `lesson${ext || ".pdf"}`;
  }
  return `resources${ext || ".pdf"}`;
}

function uniquePath(targetPath) {
  if (!fsSync.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let counter = 2;
  let next = path.join(dir, `${base}-${counter}${ext}`);
  while (fsSync.existsSync(next)) {
    counter += 1;
    next = path.join(dir, `${base}-${counter}${ext}`);
  }
  return next;
}

function isFileLike(url) {
  try {
    const parsed = new URL(url);
    const ext = fileExt(parsed.pathname);
    return allowedExtensions.has(ext);
  } catch {
    return false;
  }
}

function driveFileIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("drive.google.com")) {
      const match = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
      const id = parsed.searchParams.get("id");
      if (id) return id;
    }
  } catch {
    return null;
  }
  return null;
}

function toDriveDownloadUrl(id) {
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const { response, clear } = await fetchResponseWithTimeout(url, timeoutMs);
  if (!response.ok) {
    clear();
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();
  clear();
  return { text, response };
}

function extractLinksFromHtml(html, baseUrl) {
  const links = new Set();
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(html))) {
    const href = match[1];
    if (href.startsWith("#") || href.startsWith("mailto:")) continue;
    try {
      const absolute = new URL(href, baseUrl).toString();
      links.add(absolute);
    } catch {
      continue;
    }
  }
  return [...links];
}

function extractDriveItemsFromHtml(html) {
  const items = [];

  const driveIvdMatch = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/);
  if (!driveIvdMatch) {
    return items;
  }

  const encoded = driveIvdMatch[1];
  const decoded = encoded.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );

  try {
    const data = JSON.parse(decoded);
    const rawItems = Array.isArray(data?.[0]) ? data[0] : [];
    for (const item of rawItems) {
      const id = item?.[0];
      const name = item?.[2] ?? "";
      const mime = item?.[3] ?? "";
      if (!id || !mime) continue;
      items.push({
        id,
        name,
        mime,
        isFolder: mime === "application/vnd.google-apps.folder",
      });
    }
  } catch {
    // ignore parse failures
  }

  return items;
}

function classifyFailure(error, message = "") {
  const status = error?.status;
  const lower = message.toLowerCase();
  if (
    error?.name === "AbortError" ||
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("terminated")
  ) {
    return "timeout";
  }
  if (status === 401 || lower.includes("login") || lower.includes("auth")) {
    return "auth_required";
  }
  if (status === 403) {
    return "forbidden";
  }
  if (status === 404) {
    return "not_found";
  }
  if (status === 429 || lower.includes("rate limit")) {
    return "rate_limited";
  }
  return "unknown";
}

async function writeMarkdownReport(report) {
  const mdPath = reportPath.replace(/\.json$/i, ".md");
  const failures = Array.isArray(report.failed_links) ? report.failed_links : [];
  const counts = failures.reduce((acc, item) => {
    const key = item.failure_class || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const sortedFailures = failures
    .slice()
    .sort((a, b) => (b.attempt_count || 0) - (a.attempt_count || 0))
    .slice(0, 20);

  const lines = [
    "# GDE Download Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Failure summary",
    "",
    "| Failure class | Count |",
    "| --- | ---: |",
    ...Object.entries(counts).map(([key, value]) => `| ${key} | ${value} |`),
    "",
    "## Top failed URLs",
    "",
    "| URL | Class | Attempts | Reason |",
    "| --- | --- | ---: | --- |",
    ...sortedFailures.map(
      (item) =>
        `| ${item.url} | ${item.failure_class || "unknown"} | ${item.attempt_count || 0} | ${
          (item.error_message || "").replace(/\r?\n/g, " ").slice(0, 140) || "n/a"
        } |`
    ),
    "",
  ];
  await fs.writeFile(mdPath, lines.join("\n"));
}

async function fetchResponseWithTimeout(url, timeoutMs = FETCH_TIMEOUT_MS, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { redirect: "follow", signal: controller.signal, ...init });
    return { response, clear: () => clearTimeout(timeout) };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function downloadFile(url, destDir, hintedName = "") {
  let responseHandle = await fetchResponseWithTimeout(url, DOWNLOAD_TIMEOUT_MS);
  let response = responseHandle.response;
  let clear = responseHandle.clear;
  const contentType = response.headers.get("content-type") || "";
  if (response.ok && contentType.includes("text/html")) {
    const body = await response.text();
    clear();
    const confirmMatch = body.match(/confirm=([0-9A-Za-z_]+)/);
    if (!confirmMatch) {
      const error = new Error("Download failed: confirmation token missing");
      error.code = "auth_required";
      throw error;
    }
    const confirm = confirmMatch[1];
    const separator = url.includes("?") ? "&" : "?";
    const confirmedUrl = `${url}${separator}confirm=${confirm}`;
    responseHandle = await fetchResponseWithTimeout(confirmedUrl, DOWNLOAD_TIMEOUT_MS);
    response = responseHandle.response;
    clear = responseHandle.clear;
  }

  if (!response.ok) {
    clear();
    const error = new Error(`Download failed ${response.status}`);
    error.status = response.status;
    error.code = `HTTP_${response.status}`;
    throw error;
  }

  const finalContentType = response.headers.get("content-type") || "";
  if (finalContentType.includes("text/html")) {
    const body = await response.text();
    clear();
    const error = new Error(`Download failed: received HTML (${body.slice(0, 120)})`);
    error.code = "unexpected_html";
    throw error;
  }

  const disposition = response.headers.get("content-disposition");
  let filename = "";
  if (disposition) {
    const match = disposition.match(/filename\*?=["']?([^"';]+)["']?/i);
    if (match) filename = decodeURIComponent(match[1]);
  }
  if (!filename && hintedName) {
    filename = hintedName;
  }
  if (!filename) {
    const parsed = new URL(response.url);
    filename = path.basename(parsed.pathname) || `download-${crypto.randomUUID()}`;
  }
  filename = sanitizeFilename(filename);
  const ext = fileExt(filename);
  const finalName = ext ? filename : `${filename}.pdf`;
  const expectedSize = Number(response.headers.get("content-length") || "0");

  await fs.mkdir(destDir, { recursive: true });
  const candidatePath = path.join(destDir, finalName);
  if (fsSync.existsSync(candidatePath)) {
    const stats = fsSync.statSync(candidatePath);
    if (stats.size > 0 && (!expectedSize || stats.size === expectedSize)) {
      if (response.body) response.body.cancel();
      clear();
      return { path: candidatePath, skipped: true };
    }
    if (stats.size === 0) {
      await fs.unlink(candidatePath);
    }
  }

  const targetPath = uniquePath(candidatePath);
  const buffer = Buffer.from(await response.arrayBuffer());
  clear();
  await fs.writeFile(targetPath, buffer);
  return { path: targetPath, skipped: false };
}

async function discoverFiles(url, depth, visited, fileUrls) {
  if (visited.has(url) || depth > 4) return;
  visited.add(url);

  const driveId = driveFileIdFromUrl(url);
  if (driveId) {
    fileUrls.add({ url: toDriveDownloadUrl(driveId), name: "" });
    return;
  }

  if (isFileLike(url)) {
    fileUrls.add({ url, name: "" });
    return;
  }

  try {
    if (url.includes("drive.google.com/drive/folders/")) {
      console.log(`Scanning Drive folder: ${url}`);
    }
    const { text, response } = await fetchText(url);
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      fileUrls.add({ url, name: "" });
      return;
    }

    if (response.url.includes("drive.google.com/drive/folders/")) {
      const items = extractDriveItemsFromHtml(text);
      for (const item of items) {
        if (item.isFolder) {
          await discoverFiles(`https://drive.google.com/drive/folders/${item.id}`, depth + 1, visited, fileUrls);
        } else {
          fileUrls.add({ url: toDriveDownloadUrl(item.id), name: item.name });
        }
      }
      return;
    }

    const foundLinks = extractLinksFromHtml(text, response.url);
    for (const link of foundLinks) {
      if (isFileLike(link)) {
        fileUrls.add({ url: link, name: "" });
      } else if (link.includes("drive.google.com") || link.includes("sharepoint") || link.includes("onedrive")) {
        await discoverFiles(link, depth + 1, visited, fileUrls);
      }
    }
  } catch {
    // ignore discovery failures
  }
}

async function normalizeFiles(downloaded) {
  const normalized = [];
  const unmapped = [];

  for (const entry of downloaded) {
    const filePath = entry.path;
    const labelGuess = entry.labelGuess;
    const relPath = path.relative(incomingRoot, filePath);
    const segments = relPath.split(path.sep).map((segment) => segment.toLowerCase());
    const combined = segments.join(" ");

    const grade = parseGrade(combined);
    const term = parseTerm(combined);
    const week = parseWeek(combined);
    const subject = detectSubject(combined, segments);
    const phase = inferPhase(grade, labelGuess, combined);

    if (grade === null || term === null || week === null || !subject || phase === "other") {
      unmapped.push({ path: filePath, reason: "Missing grade/term/week/subject/phase" });
      continue;
    }

    const gradeDir = `grade-${pad2(grade)}`;
    const termDir = `term-${pad2(term)}`;
    const weekDir = `week-${pad2(week)}`;
    const destDir = path.join(normalizedRoot, phase, gradeDir, subject, termDir, weekDir);

    const targetName = standardFileName(path.basename(filePath));
    await fs.mkdir(destDir, { recursive: true });
    const targetPath = uniquePath(path.join(destDir, targetName));

    try {
      await fs.rename(filePath, targetPath);
    } catch {
      await fs.copyFile(filePath, targetPath);
      await fs.unlink(filePath);
    }

    normalized.push({ source: filePath, destination: targetPath });
  }

  return { normalized, unmapped };
}

async function main() {
  console.log("Starting GDE download pipeline...");
  if (!fsSync.existsSync(manifestPath)) {
    console.error("Manifest not found. Run checkpoint A first.");
    process.exit(1);
  }

  async function readJsonSafe(filePath) {
    if (!fsSync.existsSync(filePath)) return null;
    try {
      return JSON.parse(await fs.readFile(filePath, "utf-8"));
    } catch (error) {
      const backup = `${filePath}.corrupt.${Date.now()}`;
      await fs.copyFile(filePath, backup);
      console.warn(`Corrupt JSON detected: ${filePath}. Backed up to ${backup}`);
      return null;
    }
  }

  async function writeJsonAtomic(filePath, data) {
    const tmpPath = `${filePath}.tmp`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
    await fs.rename(tmpPath, filePath);
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
  const links = manifest.links || [];
  const downloadedFiles = [];
  const failedLinks = [];

  let queue = [];
  const existingQueue = await readJsonSafe(queuePath);
  if (existingQueue) {
    queue = existingQueue.map((entry) => ({ attempts: 0, ...entry }));
  } else {
    const seenFileUrls = new Set();
    for (const link of links) {
      const labelGuess = link.label_guess || "other";
      const fileUrls = new Set();
      const visited = new Set();
      await discoverFiles(link.url, 0, visited, fileUrls);
      console.log(`Discovered ${fileUrls.size} files from ${link.url}`);
      for (const entry of fileUrls) {
        if (seenFileUrls.has(entry.url)) continue;
        seenFileUrls.add(entry.url);
        queue.push({ url: entry.url, name: entry.name, labelGuess, attempts: 0 });
      }
    }
    await writeJsonAtomic(queuePath, queue);
  }

  const existingReport = await readJsonSafe(reportPath);
  const report =
    existingReport ?? { downloaded_count: 0, failed_links: [], unmapped_files: [], normalized_files: [] };

  const normalizeOnly = process.env.GDE_NORMALIZE_ONLY === "1";

  const dedupeBy = (items, key) => {
    const seen = new Set();
    const output = [];
    for (const item of items) {
      const value = item?.[key];
      if (!value || seen.has(value)) continue;
      seen.add(value);
      output.push(item);
    }
    return output;
  };

  const normalizeFailedEntry = (entry) => {
    if (!entry || typeof entry !== "object") return null;
    const message = entry.error_message || entry.error || "";
    const attempts = entry.attempt_count || entry.attempts || MAX_ATTEMPTS;
    return {
      url: entry.url || "",
      phase_hint: entry.phase_hint || entry.labelGuess || "other",
      error_code: entry.error_code || entry.code || "unknown",
      error_message: message,
      attempt_count: attempts,
      last_attempt_at: entry.last_attempt_at || null,
      failure_class: entry.failure_class || classifyFailure({}, String(message)),
    };
  };

  report.failed_links = dedupeBy(
    (report.failed_links || [])
      .map(normalizeFailedEntry)
      .filter((entry) => entry && entry.url),
    "url"
  );

  const cleanupUnmapped = async () => {
    report.unmapped_files = report.unmapped_files.filter((entry) => fsSync.existsSync(entry.path));
    report.unmapped_files = dedupeBy(report.unmapped_files, "path");
    report.normalized_files = dedupeBy(report.normalized_files, "destination");
    report.failed_links = dedupeBy(
      (report.failed_links || [])
        .map(normalizeFailedEntry)
        .filter((entry) => entry && entry.url),
      "url"
    );
  };

  if (normalizeOnly) {
    const incomingFiles = [];
    const stack = [incomingRoot];
    while (stack.length) {
      const current = stack.pop();
      if (!current) continue;
      if (!fsSync.existsSync(current)) continue;
      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile()) {
          const ext = fileExt(entry.name);
          if (allowedExtensions.has(ext)) {
            const rel = path.relative(incomingRoot, fullPath);
            const labelGuess = rel.split(path.sep)[0] || "other";
            incomingFiles.push({ path: fullPath, labelGuess });
          }
        }
      }
    }

    const { normalized, unmapped } = await normalizeFiles(incomingFiles);
    report.normalized_files = dedupeBy([...report.normalized_files, ...normalized], "destination");
    report.unmapped_files = dedupeBy([...report.unmapped_files, ...unmapped], "path");
    await cleanupUnmapped();
    await writeJsonAtomic(reportPath, report);
    console.log(`Normalized files (normalize-only): ${normalized.length}`);
    console.log(`Unmapped files (normalize-only): ${unmapped.length}`);
    console.log(`Report: ${reportPath}`);
    return;
  }

  let totalIterations = 0;
  while (true) {
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
      if (drainMode && totalIterations >= DRAIN_CAP) {
        console.warn(`Drain cap reached (${DRAIN_CAP}).`);
        break;
      }
      const batch = queue.splice(0, MAX_PER_RUN);
      if (!batch.length) {
        console.log("No remaining files in the download queue.");
        break;
      }

    const downloadedFilesBatch = [];
    const failedLinksBatch = [];

    const concurrency = 4;
    let index = 0;
      async function worker() {
        while (index < batch.length) {
          const current = batch[index];
          index += 1;
          const destDir = path.join(incomingRoot, current.labelGuess || "other");
          try {
            const saved = await downloadFile(current.url, destDir, current.name);
            if (saved?.path) {
              downloadedFilesBatch.push({ path: saved.path, labelGuess: current.labelGuess, skipped: saved.skipped });
            }
          } catch (error) {
            const attempts = (current.attempts ?? 0) + 1;
            const errorCode = error?.code || error?.name || "unknown";
            const errorMessage = error?.message || String(error);
            const failureClass = classifyFailure(error, errorMessage);
            if (attempts < MAX_ATTEMPTS) {
              queue.push({ ...current, attempts });
            } else {
              failedLinksBatch.push({
                url: current.url,
                phase_hint: current.labelGuess || "other",
                error_code: errorCode,
                error_message: errorMessage,
                attempt_count: attempts,
                last_attempt_at: new Date().toISOString(),
                failure_class: failureClass,
              });
            }
          }
        }
      }
    await Promise.all(Array.from({ length: concurrency }, worker));

    const { normalized, unmapped } = await normalizeFiles(downloadedFilesBatch);

      report.downloaded_count += downloadedFilesBatch.filter((entry) => !entry.skipped).length;
    report.failed_links.push(...failedLinksBatch);
    report.unmapped_files.push(...unmapped);
    report.normalized_files.push(...normalized);

    await cleanupUnmapped();
    await writeJsonAtomic(reportPath, report);
    await writeJsonAtomic(queuePath, queue);

      console.log(`Downloaded files (this batch): ${downloadedFilesBatch.filter((entry) => !entry.skipped).length}`);
      console.log(`Normalized files (this batch): ${normalized.length}`);
      console.log(`Unmapped files (this batch): ${unmapped.length}`);
      console.log(`Remaining queue: ${queue.length}`);

      totalIterations += 1;
      if (queue.length === 0) {
        break;
      }
    }

    if (!drainMode || queue.length === 0 || totalIterations >= DRAIN_CAP) {
      break;
    }
  }

  await writeMarkdownReport(report);
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
