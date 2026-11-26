import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const DEFAULTS = {
  MIRROR_MAX_FILES: 300,
  MIRROR_MAX_DEPTH: 3,
  MIRROR_MAX_PAGES: 200,
  MIRROR_TIMEOUT_MS: 180000,
  MIRROR_MAX_ATTEMPTS: 3,
  MIRROR_CONCURRENCY: 3,
};

const FILE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".zip",
  ".rar",
  ".7z",
  ".csv",
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mirrorRoot = path.join(repoRoot, "content", "gde_lrip_mip_mirror");
const reportRoot = path.join(repoRoot, "content", "gde_lrip_mip_reports");
const manifestPath = path.join(reportRoot, "links_manifest.json");
const queuePath = path.join(reportRoot, "mirror_queue.json");
const visitedPath = path.join(reportRoot, "visited.json");

function envNumber(key) {
  return Number(process.env[key] || DEFAULTS[key]);
}

const LIMITS = {
  maxFiles: envNumber("MIRROR_MAX_FILES"),
  maxDepth: envNumber("MIRROR_MAX_DEPTH"),
  maxPages: envNumber("MIRROR_MAX_PAGES"),
  timeoutMs: envNumber("MIRROR_TIMEOUT_MS"),
  maxAttempts: envNumber("MIRROR_MAX_ATTEMPTS"),
  concurrency: envNumber("MIRROR_CONCURRENCY"),
};

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function hashString(input) {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 10);
}

function detectType(url) {
  const lower = url.toLowerCase();
  if (lower.includes("drive.google.com")) {
    if (lower.includes("/folders/")) return "gdrive_folder";
    if (lower.includes("/file/d/") || lower.includes("uc?")) return "gdrive_file";
  }
  if (lower.includes("sharepoint.com") || lower.includes("onedrive.live.com") || lower.includes("1drv.ms")) {
    return "sharepoint";
  }
  if (FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "direct_file";
  return "web_page";
}

function buildBaseDir(index, label) {
  const safeLabel = label ? label.replace(/[^a-z0-9_-]+/gi, "-") : "unknown";
  return path.join(mirrorRoot, `${String(index).padStart(2, "0")}_${safeLabel}`);
}

function ensureDirs() {
  fs.mkdirSync(mirrorRoot, { recursive: true });
  fs.mkdirSync(reportRoot, { recursive: true });
}

async function readJsonSafe(filePath, fallback) {
  try {
    const raw = await fsp.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, filePath);
}

function toQueueKey(item) {
  return `${item.url}|${item.baseDir}|${item.drivePath || ""}`;
}

async function loadQueue() {
  const queue = await readJsonSafe(queuePath, []);
  return Array.isArray(queue) ? queue : [];
}

async function loadVisited() {
  const visited = await readJsonSafe(visitedPath, {});
  return new Set(Object.keys(visited || {}));
}

async function saveVisited(visitedSet) {
  const obj = {};
  visitedSet.forEach((key) => {
    obj[key] = true;
  });
  await writeJsonAtomic(visitedPath, obj);
}

function buildMetadata(baseDir, sourceUrl, type) {
  return {
    url: sourceUrl,
    detected_type: type,
    discovered_children: [],
    downloaded_files: [],
    failures: [],
    timestamps: {
      started_at: new Date().toISOString(),
      finished_at: null,
    },
  };
}

function saveMetadata(baseDir, metadata) {
  const metadataPath = path.join(baseDir, "metadata.json");
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  fs.writeFileSync(path.join(baseDir, "source_url.txt"), metadata.url);
}

function sanitizeFilename(name) {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").trim();
  return cleaned || `file-${hashString(name)}`;
}

function isPlaceholderFilename(name) {
  const lower = name.toLowerCase();
  if (lower === "uc") return true;
  if (lower.startsWith("drive-") || lower.startsWith("file-")) return true;
  if (lower.endsWith(".bin")) return true;
  return false;
}

function extractFilenameFromContentDisposition(headerValue) {
  if (!headerValue) return null;
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }
  const simpleMatch = headerValue.match(/filename="?([^\";]+)"?/i);
  if (simpleMatch) return simpleMatch[1];
  return null;
}

function urlPathToFilePath(baseDir, url, drivePath = "") {
  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/+$/, "");
  const segments = pathname.split("/").filter(Boolean);
  const fileName = segments.length ? segments[segments.length - 1] : `file-${hashString(url)}`;
  const safeName = sanitizeFilename(fileName);
  const dir = path.join(baseDir, drivePath, ...segments.slice(0, -1).map((seg) => sanitizeFilename(seg)));
  return { dir, filename: safeName };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIMITS.timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadFile(url, targetPath, metadata, attempt = 1) {
  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.size > 0) {
        return { ok: true, skipped: true, bytes: stat.size, path: targetPath };
      }
    }
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }
    const headerName = extractFilenameFromContentDisposition(response.headers.get("content-disposition"));
    let finalPath = targetPath;
    if (headerName && isPlaceholderFilename(path.basename(targetPath))) {
      finalPath = path.join(path.dirname(targetPath), sanitizeFilename(headerName));
    }
    if (fs.existsSync(finalPath)) {
      const stat = fs.statSync(finalPath);
      if (stat.size > 0) {
        return { ok: true, skipped: true, bytes: stat.size, path: finalPath };
      }
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    await fsp.mkdir(path.dirname(finalPath), { recursive: true });
    await fsp.writeFile(finalPath, buffer);
    return { ok: true, bytes: buffer.length, path: finalPath };
  } catch (error) {
    if (attempt < LIMITS.maxAttempts) {
      return downloadFile(url, targetPath, metadata, attempt + 1);
    }
    return { ok: false, reason: error?.message || "download_failed" };
  }
}

function classifyFailure(reason) {
  const lower = String(reason).toLowerCase();
  if (lower.includes("401") || lower.includes("auth")) return "auth_required";
  if (lower.includes("403") || lower.includes("forbidden")) return "forbidden";
  if (lower.includes("404") || lower.includes("not found")) return "not_found";
  if (lower.includes("timeout") || lower.includes("abort")) return "timeout";
  if (lower.includes("429") || lower.includes("rate")) return "rate_limited";
  return "unknown";
}

async function handleDirectFile(item, metadata) {
  const { dir, filename } = urlPathToFilePath(item.baseDir, item.url, item.drivePath);
  const finalName = item.fileName ? sanitizeFilename(item.fileName) : filename;
  const targetPath = path.join(dir, finalName);
  const result = await downloadFile(item.url, targetPath, metadata);
  if (result.ok) {
    metadata.downloaded_files.push({
      url: item.url,
      path: normalizePath(path.relative(repoRoot, result.path || targetPath)),
      bytes: result.bytes || 0,
      skipped: result.skipped || false,
    });
  } else {
    metadata.failures.push({ url: item.url, reason: result.reason, class: classifyFailure(result.reason) });
  }
}

function extractDriveFileId(url) {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const query = new URL(url).searchParams.get("id");
  return query || null;
}

function extractDriveFolderId(url) {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function handleDriveFile(item, metadata) {
  const fileId = extractDriveFileId(item.url);
  if (!fileId) {
    metadata.failures.push({ url: item.url, reason: "missing_file_id", class: "unknown" });
    return;
  }
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const { dir } = urlPathToFilePath(item.baseDir, item.url, item.drivePath);
  const filename = item.fileName || `drive-${fileId}.bin`;
  const targetPath = path.join(dir, filename);
  await handleDirectFile({ ...item, url: directUrl, fileName: filename }, metadata);
}

async function handleDriveFolder(item, metadata, enqueue) {
  const folderId = extractDriveFolderId(item.url);
  if (!folderId) {
    metadata.failures.push({ url: item.url, reason: "missing_folder_id", class: "unknown" });
    return;
  }
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  const response = await fetchWithTimeout(folderUrl);
  if (!response.ok) {
    metadata.failures.push({ url: item.url, reason: `HTTP ${response.status}`, class: classifyFailure(response.status) });
    return;
  }
  let html = await response.text();
  const normalizedHtml = html
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/");
  const fileIds = new Set();
  const folderIds = new Set();

  const ivdMatch = normalizedHtml.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/);
  if (ivdMatch) {
    const ivdRaw = ivdMatch[1];
    const ivdDecoded = ivdRaw.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    try {
      const ivdData = JSON.parse(ivdDecoded);
      const items = Array.isArray(ivdData) ? ivdData.flat(3) : [];
      items.forEach((entry) => {
        if (!Array.isArray(entry) || entry.length < 4) return;
        const [id, parent, name, mimeType] = entry;
        if (typeof id !== "string" || typeof name !== "string" || typeof mimeType !== "string") return;
        const isFolder = mimeType === "application/vnd.google-apps.folder";
        const childPath = path.join(item.drivePath || "", sanitizeFilename(name));
        if (isFolder) {
          if (id !== folderId) {
            enqueue({
              url: `https://drive.google.com/drive/folders/${id}`,
              depth: item.depth + 1,
              linkIndex: item.linkIndex,
              baseDir: item.baseDir,
              drivePath: childPath,
            });
            folderIds.add(id);
          }
        } else {
          fileIds.add(id);
          enqueue({
            url: `https://drive.google.com/file/d/${id}/view`,
            depth: item.depth + 1,
            linkIndex: item.linkIndex,
            baseDir: item.baseDir,
            drivePath: item.drivePath || "",
            fileName: sanitizeFilename(name),
          });
        }
      });
    } catch {
      // fallback below
    }
  }

  for (const match of normalizedHtml.matchAll(/https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/g)) {
    if (!fileIds.has(match[1])) fileIds.add(match[1]);
  }
  for (const match of normalizedHtml.matchAll(/https:\/\/drive\.google\.com\/drive\/folders\/([a-zA-Z0-9_-]+)/g)) {
    if (!folderIds.has(match[1])) folderIds.add(match[1]);
  }
  fileIds.forEach((id) => {
    enqueue({
      url: `https://drive.google.com/file/d/${id}/view`,
      depth: item.depth + 1,
      linkIndex: item.linkIndex,
      baseDir: item.baseDir,
      drivePath: item.drivePath || "",
    });
  });
  folderIds.forEach((id) => {
    if (id !== folderId) {
      enqueue({
        url: `https://drive.google.com/drive/folders/${id}`,
        depth: item.depth + 1,
        linkIndex: item.linkIndex,
        baseDir: item.baseDir,
        drivePath: item.drivePath || "",
      });
    }
  });
  metadata.discovered_children.push(...[...fileIds, ...folderIds].map((id) => String(id)));
}

async function handleSharepoint(item, metadata) {
  const url = new URL(item.url);
  if (!url.searchParams.has("download")) {
    url.searchParams.set("download", "1");
  }
  const response = await fetchWithTimeout(url.toString());
  if (response.status === 401 || response.status === 403) {
    metadata.failures.push({ url: item.url, reason: `HTTP ${response.status}`, class: classifyFailure(response.status) });
    return;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    metadata.failures.push({ url: item.url, reason: "auth_required", class: "auth_required" });
    return;
  }
  const { dir, filename } = urlPathToFilePath(item.baseDir, url.toString());
  const targetPath = path.join(dir, filename);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await fsp.writeFile(targetPath, buffer);
  metadata.downloaded_files.push({
    url: item.url,
    path: normalizePath(path.relative(repoRoot, targetPath)),
    bytes: buffer.length,
    skipped: false,
  });
}

async function handleWebPage(item, metadata, enqueue) {
  const response = await fetchWithTimeout(item.url);
  if (!response.ok) {
    metadata.failures.push({ url: item.url, reason: `HTTP ${response.status}`, class: classifyFailure(response.status) });
    return;
  }
  const html = await response.text();
  const $ = load(html);
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const absolute = new URL(href, item.url).toString();
      links.add(absolute);
    } catch {
      // ignore
    }
  });

  for (const link of links) {
    const linkType = detectType(link);
    if (linkType === "direct_file") {
      enqueue({
        url: link,
        depth: item.depth + 1,
        linkIndex: item.linkIndex,
        baseDir: item.baseDir,
      });
    } else if (linkType === "web_page") {
      const urlObj = new URL(link);
      const baseObj = new URL(item.url);
      if (urlObj.host === baseObj.host && item.depth + 1 <= LIMITS.maxDepth) {
        enqueue({
          url: link,
          depth: item.depth + 1,
          linkIndex: item.linkIndex,
          baseDir: item.baseDir,
        });
      }
    } else {
      enqueue({
        url: link,
        depth: item.depth + 1,
        linkIndex: item.linkIndex,
        baseDir: item.baseDir,
      });
    }
  }
  metadata.discovered_children.push(...links);
}

async function processItem(item, metadata, enqueue, counters) {
  const type = detectType(item.url);
  metadata.detected_type = type;
  if (type === "direct_file") {
    await handleDirectFile(item, metadata);
    counters.downloaded += 1;
  } else if (type === "gdrive_file") {
    await handleDriveFile(item, metadata);
    counters.downloaded += 1;
  } else if (type === "gdrive_folder") {
    await handleDriveFolder(item, metadata, enqueue);
  } else if (type === "sharepoint") {
    await handleSharepoint(item, metadata);
    counters.downloaded += 1;
  } else {
    await handleWebPage(item, metadata, enqueue);
    counters.pages += 1;
  }
}

async function main() {
  ensureDirs();
  if (!fs.existsSync(manifestPath)) {
    console.error("links_manifest.json not found. Run extract_pdf_links.py first.");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const links = manifest.links || [];
  if (!links.length) {
    console.error("Manifest contains zero links.");
    process.exit(1);
  }

  let queue = await loadQueue();
  const visited = await loadVisited();
  if (!queue.length) {
    const seen = new Set();
    queue = links
      .filter((link) => {
        if (seen.has(link.url)) return false;
        seen.add(link.url);
        return true;
      })
      .map((link, index) => ({
        url: link.url,
        depth: 0,
        linkIndex: index + 1,
        labelHint: link.label_hint || "unknown",
        baseDir: buildBaseDir(index + 1, link.label_hint || "unknown"),
      }));
  }

  const counters = { downloaded: 0, pages: 0 };
  const failures = [];

  const enqueue = (item) => {
    if (item.depth > LIMITS.maxDepth) return;
    const key = toQueueKey(item);
    if (visited.has(key)) return;
    queue.push(item);
  };

  const workers = new Array(LIMITS.concurrency).fill(0).map(async () => {
    while (queue.length && counters.downloaded < LIMITS.maxFiles && counters.pages < LIMITS.maxPages) {
      const item = queue.shift();
      if (!item) continue;
      const key = toQueueKey(item);
      if (visited.has(key)) continue;
      visited.add(key);

      const baseDir = item.baseDir;
      await fsp.mkdir(baseDir, { recursive: true });
      const metadataPath = path.join(baseDir, "metadata.json");
      const metadata = fs.existsSync(metadataPath)
        ? JSON.parse(fs.readFileSync(metadataPath, "utf-8"))
        : buildMetadata(baseDir, item.url, detectType(item.url));

      try {
        await processItem(item, metadata, enqueue, counters);
      } catch (error) {
        metadata.failures.push({
          url: item.url,
          reason: error?.message || "unknown",
          class: classifyFailure(error?.message || "unknown"),
        });
        failures.push({ url: item.url, reason: error?.message || "unknown" });
      } finally {
        metadata.timestamps.finished_at = new Date().toISOString();
        saveMetadata(baseDir, metadata);
      }
    }
  });

  await Promise.all(workers);

  await writeJsonAtomic(queuePath, queue);
  await saveVisited(visited);

  const statePath = path.join(reportRoot, "mirror_state.json");
  await writeJsonAtomic(statePath, {
    updated_at: new Date().toISOString(),
    remaining_queue: queue.length,
    visited: visited.size,
    failures,
  });

  console.log(`Processed queue. Remaining: ${queue.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
