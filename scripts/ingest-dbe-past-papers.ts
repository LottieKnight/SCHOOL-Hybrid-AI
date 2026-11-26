import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "../apps/web/lib/prisma";
import { getStorageProvider } from "../apps/web/lib/storage";
import { fetchWithPoliteHeaders } from "./lib/http";
import {
  OFFICIAL_SOURCE_STRATEGIES,
  extractCandidateYearPagesFromHtml,
  extractPdfLinksFromHtml,
  isAllowedSourceUrl,
  type ExtractedPdfLink,
  type SourceStrategy,
} from "./lib/source-strategies";

const STATUS_PATH = path.join(process.cwd(), "data", "past-papers", "ingest-status.json");
const DOWNLOAD_CACHE_PATH = path.join(process.cwd(), "data", "past-papers", "ingest-download-cache.json");
const UNKNOWN_SUBJECT = "Unknown";

type IngestOptions = {
  dryRun: boolean;
  yearFilter: number | null;
  provinceFilter: string | null;
  maxLinks: number | null;
  failOnError: boolean;
  debugFetch: boolean;
  sourceFilter: string | null;
  repairOrphans: boolean;
  repairLimit: number;
};

type FetchFailure = {
  sourceName: string;
  url: string;
  statusCode: number | null;
  error: string;
  headers?: Record<string, string>;
  bodySnippet?: string;
};

type IngestionStats = {
  pagesFetched: number;
  linksExtracted: number;
  linksSelected: number;
  linksSkippedByYear: number;
  linksSkippedByProvince: number;
  selectionGroupsTotal: number;
  selectionGroupsWithBoth: number;
  selectionGroupsSingleOnly: number;
  selectionLinksFromPairedGroups: number;
  skippedMeta: number;
  skippedUnchanged: number;
  inserted: number;
  updated: number;
  errors: number;
  uiReadyCount: number;
  paperOnlyCount: number;
  memoOnlyCount: number;
  bothCount: number;
  repairAttemptedCount: number;
  repairSucceededCount: number;
};

type DownloadCacheEntry = {
  sha256?: string;
};

type DownloadCacheStore = Record<string, DownloadCacheEntry>;

type ParsedLink = {
  sourceName: string;
  sourcePageUrl: string;
  fileUrl: string;
  label: string;
  isMemo: boolean;
  title: string;
  province: string;
  grade: number | null;
  subject: string;
  year: number | null;
  session: string;
  paperNumber: string;
  language: string;
};

type IngestStatus = {
  ranAtIso: string;
  ok: boolean;
  dryRun: boolean;
  sourceName: string | null;
  errorSummary: string | null;
  stats: IngestionStats;
  failures: FetchFailure[];
  driftReport: PairingDriftReport | null;
  repairSummary: RepairSummary | null;
};

type IdentityFields = {
  sourceId: string;
  province: string;
  grade: number | null;
  subject: string;
  year: number | null;
  session: string;
  paperNumber: string;
  language: string;
};

type PairingDbRow = {
  id: string;
  sourceId: string;
  province: string;
  grade: number | null;
  subject: string;
  year: number | null;
  session: string;
  paperNumber: string;
  language: string;
  sourcePageUrl: string | null;
  paperUrlOriginal: string | null;
  memoUrlOriginal: string | null;
  paperStorageKey: string | null;
  memoStorageKey: string | null;
};

type DriftNeighbor = {
  identityKey: string;
  diffFields: string[];
  sourcePageUrl: string | null;
  fileUrlOriginal: string | null;
};

type DriftRecord = {
  identityKey: string;
  sourcePageUrl: string | null;
  fileUrlOriginal: string | null;
  nearestCandidates: DriftNeighbor[];
};

type PairingDriftReport = {
  generatedAtIso: string;
  paperOnlyCount: number;
  memoOnlyCount: number;
  candidateMatches: number;
  paperOnlyDrift: DriftRecord[];
  memoOnlyDrift: DriftRecord[];
};

type RepairSummary = {
  attemptedCount: number;
  succeededCount: number;
  repairedIds: string[];
};

const provider = getStorageProvider();

const SUBJECT_ALIASES: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "Mathematics", patterns: [/\bmathematics?\b/i, /\bmaths?\b/i, /\bmath literacy\b/i] },
  { canonical: "Physical Sciences", patterns: [/\bphysical sciences?\b/i] },
  { canonical: "Life Sciences", patterns: [/\blife sciences?\b/i, /\bbiology\b/i] },
  { canonical: "Accounting", patterns: [/\baccounting\b/i] },
  { canonical: "Economics", patterns: [/\beconomics?\b/i] },
  { canonical: "Business Studies", patterns: [/\bbusiness studies\b/i] },
  { canonical: "Geography", patterns: [/\bgeography\b/i] },
  { canonical: "History", patterns: [/\bhistory\b/i] },
  { canonical: "English HL", patterns: [/\benglish\s*hl\b/i] },
  { canonical: "English FAL", patterns: [/\benglish\s*fal\b/i] },
  { canonical: "Afrikaans HL", patterns: [/\bafrikaans\s*hl\b/i] },
  { canonical: "Afrikaans FAL", patterns: [/\bafrikaans\s*fal\b/i] },
  { canonical: "Mathematical Literacy", patterns: [/\bmathematical literacy\b/i] },
  { canonical: "Life Orientation", patterns: [/\blife orientation\b/i] },
  { canonical: "Agricultural Sciences", patterns: [/\bagricultural sciences?\b/i] },
  { canonical: "Tourism", patterns: [/\btourism\b/i] },
  { canonical: "Consumer Studies", patterns: [/\bconsumer studies\b/i] },
  { canonical: "Computer Applications Technology", patterns: [/\bcomputer applications technology\b/i, /\bcat\b/i] },
  { canonical: "Information Technology", patterns: [/\binformation technology\b/i, /\bit\b/i] },
  { canonical: "Engineering Graphics and Design", patterns: [/\bengineering graphics and design\b/i, /\begd\b/i] },
  { canonical: "Civil Technology", patterns: [/\bcivil technology\b/i] },
  { canonical: "Electrical Technology", patterns: [/\belectrical technology\b/i] },
  { canonical: "Mechanical Technology", patterns: [/\bmechanical technology\b/i] },
];

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseArgs(argv: string[]): IngestOptions {
  let dryRun = false;
  let yearFilter: number | null = null;
  let provinceFilter: string | null = null;
  let maxLinks: number | null = null;
  let failOnError = true;
  let debugFetch = false;
  let sourceFilter: string | null = null;
  let repairOrphans = false;
  let repairLimit = 50;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg.startsWith("--year=")) {
      yearFilter = parseNumber(arg.slice("--year=".length));
      continue;
    }
    if (arg.startsWith("--province=")) {
      const value = arg.slice("--province=".length).trim().toLowerCase();
      provinceFilter = value || null;
      continue;
    }
    if (arg.startsWith("--max-links=")) {
      maxLinks = parseNumber(arg.slice("--max-links=".length));
      continue;
    }
    if (arg === "--no-fail-on-error") {
      failOnError = false;
      continue;
    }
    if (arg === "--debug-fetch") {
      debugFetch = true;
      continue;
    }
    if (arg.startsWith("--source=")) {
      sourceFilter = arg.slice("--source=".length).trim().toUpperCase();
      continue;
    }
    if (arg === "--repair-orphans") {
      repairOrphans = true;
      continue;
    }
    if (arg.startsWith("--repair-limit=")) {
      const value = parseNumber(arg.slice("--repair-limit=".length));
      if (value !== null && value > 0) {
        repairLimit = value;
      }
      continue;
    }
  }

  return {
    dryRun,
    yearFilter,
    provinceFilter,
    maxLinks,
    failOnError,
    debugFetch,
    sourceFilter,
    repairOrphans,
    repairLimit,
  };
}

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function logInfo(event: string, data?: Record<string, unknown>) {
  if (data) {
    console.info(`[ingest:dbe] ${event}`, data);
    return;
  }
  console.info(`[ingest:dbe] ${event}`);
}

function logWarn(event: string, data?: Record<string, unknown>) {
  if (data) {
    console.warn(`[ingest:dbe] ${event}`, data);
    return;
  }
  console.warn(`[ingest:dbe] ${event}`);
}

function logError(event: string, data?: Record<string, unknown>) {
  if (data) {
    console.error(`[ingest:dbe] ${event}`, data);
    return;
  }
  console.error(`[ingest:dbe] ${event}`);
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return slug || "unknown";
}

function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function trimSnippet(text: string) {
  return text.replace(/\s+/g, " ").slice(0, 300);
}

function sanitizeHeaders(headers: Record<string, string>) {
  const keys = ["server", "content-type", "content-length", "location", "set-cookie", "via", "cf-ray", "x-cache"];
  const out: Record<string, string> = {};
  for (const key of keys) {
    if (headers[key]) out[key] = headers[key];
  }
  return out;
}

function cleanText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseWords(value: string) {
  const keepUpper = new Set(["hl", "fal", "sal", "nsc", "egd", "cat", "it"]);
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (keepUpper.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function normalizeSubject(label: string, fileUrl: string, contextText?: string) {
  const fileName = path.basename(fileUrl.split("?")[0] || "").toLowerCase();
  const hasGenericLinkClickName = fileName.includes("linkclick.aspx");
  const moduleSubjectCandidate = (() => {
    if (!contextText) return "";
    const first = contextText.split("|")[0]?.trim() || "";
    const beforeYear = first.split(":")[0]?.trim() || first;
    return cleanText(beforeYear);
  })();
  const raw = cleanText(
    `${moduleSubjectCandidate} ${hasGenericLinkClickName ? label : `${label} ${fileName}`}`
  ).toLowerCase();
  const aliasInput = raw;
  const stripped = raw
    .replace(/(20\d{2})/g, " ")
    .replace(/\bgrade\s*r\b/g, " ")
    .replace(/\bgrade\s*\d{1,2}\b/g, " ")
    .replace(/\bgr\s*\d{1,2}\b/g, " ")
    .replace(/\bpaper\s*\d+\b/g, " ")
    .replace(/\bp\s*\d+\b/g, " ")
    .replace(/\b(memo|markscheme|answer|solutions?)\b/g, " ")
    .replace(/\b(nov|november|may|june|march|september|sept)\b/g, " ")
    .replace(/\blinkclick\b|\baspx\b|\bfileticket\b|\btabid\b|\bportalid\b|\bmid\b/g, " ")
    .replace(/\.pdf$/g, " ");

  for (const alias of SUBJECT_ALIASES) {
    if (alias.patterns.some((pattern) => pattern.test(aliasInput))) {
      return alias.canonical;
    }
  }

  if (moduleSubjectCandidate) {
    const moduleStripped = moduleSubjectCandidate
      .toLowerCase()
      .replace(/(20\d{2})/g, " ")
      .replace(/\bgrade\s*\d{1,2}\b/g, " ")
      .replace(/\bpaper\s*\d+\b/g, " ")
      .replace(/\bmemo\b/g, " ");
    const moduleClean = cleanText(moduleStripped);
    if (moduleClean && moduleClean.length >= 3) {
      return titleCaseWords(moduleClean);
    }
  }

  const compact = cleanText(stripped);
  if (!compact) return UNKNOWN_SUBJECT;
  if (compact.length < 3) return UNKNOWN_SUBJECT;
  return titleCaseWords(compact);
}

function normalizeSession(source: string): "Nov" | "May/June" | "March" | "September" | "Other" {
  const value = source.toLowerCase().replace(/[_-]+/g, " ");
  if (/\b(supplementary|supp|suppl)\b/.test(value)) return "Other";
  if (/nov(?:ember)?/.test(value)) return "Nov";
  if (/(may|june)/.test(value)) return "May/June";
  if (/(march|feb(?:ruary)?)/.test(value)) return "March";
  if (/(sept(?:ember)?|trial|prelim)/.test(value)) return "September";
  return "Other";
}

function normalizeLanguage(source: string): "en" | "af" | "other" {
  const value = source.toLowerCase();
  if (/\bafrikaans\b|\bafr\b/.test(value)) return "af";
  if (/\benglish\b|\ben\b/.test(value)) return "en";
  return "en";
}

function inferPaperNumber(source: string) {
  const value = source.toLowerCase().replace(/[_-]+/g, " ");
  const patterns = [
    /\bquestion\s*paper\s*0*([1-9])\b/,
    /\bpaper\s*0*([1-9])\b/,
    /(?:^|[^a-z0-9])p\s*0*([1-9])(?:[^a-z0-9]|$)/,
    /\bmemo(?:\s+for)?\s*(?:paper\s*)?0*([1-9])\b/,
    /\b([1-9])\s*memo\b/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "1";
}

function extractYears(source: string) {
  const years = Array.from(source.matchAll(/(?<!\d)(20\d{2})(?!\d)/g))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value >= 2000 && value <= 2099);
  return years;
}

function inferYear(label: string, contextText: string, sourcePageUrl: string, combined: string) {
  const labelYears = extractYears(label);
  if (labelYears.length > 0) return Math.max(...labelYears);

  const contextYears = extractYears(contextText);
  if (contextYears.length > 0) return Math.max(...contextYears);

  const sourceYears = extractYears(sourcePageUrl);
  if (sourceYears.length > 0) return Math.max(...sourceYears);

  const combinedYears = extractYears(combined);
  if (combinedYears.length > 0) return Math.max(...combinedYears);

  return null;
}

function inferGrade(sourceName: string, source: string) {
  const value = source.toLowerCase();
  const compact = value.replace(/[\s_-]+/g, "");
  const match =
    value.match(/\bgrade[\s_-]*(\d{1,2})\b/) ||
    value.match(/\bgr[\s_-]*(\d{1,2})\b/) ||
    compact.match(/grade(10|11|12)(?!\d)/) ||
    compact.match(/gr(10|11|12)(?!\d)/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed >= 10 && parsed <= 12) {
      return parsed;
    }
  }
  if (/\bgrade\s*r\b/.test(value)) return 0;
  if (sourceName === "DBE" && /nationalseniorcertificate|nsc|grade\s*12|seniorcertificate|senior certificate|scmay|sc-exam/.test(value)) {
    return 12;
  }
  return null;
}

function inferProvince(source: string) {
  const value = source.toLowerCase();
  if (/wced|western[\s-]?cape/.test(value)) return "western-cape";
  if (/kzn|kwazulu/.test(value)) return "kzn";
  if (/gauteng/.test(value)) return "gauteng";
  if (/limpopo/.test(value)) return "limpopo";
  return "national";
}

function parsePaperMeta(link: ExtractedPdfLink, sourcePageUrl: string, sourceName: string): ParsedLink {
  const decodedFileUrlFull = decodeURIComponent(link.url);
  const decodedFileUrlPath = decodeURIComponent(link.url.split("?")[0] || link.url);
  let queryFileName = "";
  try {
    const parsed = new URL(link.url);
    queryFileName =
      decodeURIComponent(parsed.searchParams.get("file") || parsed.searchParams.get("download") || "").trim() || "";
  } catch {
    queryFileName = "";
  }
  const label = cleanText(link.label || path.basename(link.url));
  const combined = cleanText(
    `${decodedFileUrlFull} ${decodedFileUrlPath} ${queryFileName} ${decodeURIComponent(sourcePageUrl)} ${label} ${cleanText(link.contextText || "")}`
  );
  const fileName = queryFileName ? path.basename(queryFileName) : path.basename(link.url.split("?")[0] || link.url);

  const subject = normalizeSubject(label, link.url, link.contextText);
  const year = inferYear(label, cleanText(link.contextText || ""), decodeURIComponent(sourcePageUrl), combined);
  const grade = inferGrade(sourceName, combined);
  const paperNumber = inferPaperNumber(combined);
  const session = normalizeSession(combined);
  const language = normalizeLanguage(combined);
  const province = inferProvince(combined);
  const isMemo = /\b(memo|markscheme|answer|solutions?)\b/i.test(`${combined} ${label}`);

  return {
    sourceName,
    sourcePageUrl,
    fileUrl: link.url,
    label,
    isMemo,
    title: label || fileName,
    province,
    grade,
    subject,
    year,
    session,
    paperNumber,
    language,
  };
}

function isUiReady(link: { grade: number | null; year: number | null; subject: string; paperStorageKey?: string | null }) {
  return link.grade !== null && link.year !== null && link.subject !== UNKNOWN_SUBJECT && (link.paperStorageKey ?? "x") !== null;
}

async function readRobotsAllowed(strategy: SourceStrategy): Promise<boolean> {
  const robotsUrl = new URL("/robots.txt", strategy.baseUrl).toString();
  const response = await fetchWithPoliteHeaders(robotsUrl, {
    method: "GET",
    retries: 2,
    logPrefix: `[robots:${strategy.sourceName}]`,
  });
  logInfo("robots.fetch", {
    sourceName: strategy.sourceName,
    robotsUrl,
    status: response.status,
    fromCache: response.fromCache,
  });

  if (response.status >= 400) return true;
  const lines = response.text.split(/\r?\n/);
  let applies = false;
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith("user-agent:")) {
      applies = trimmed.includes("*");
    }
    if (applies && trimmed.startsWith("disallow:")) {
      const value = trimmed.replace("disallow:", "").trim();
      if (value === "/") return false;
    }
  }
  return true;
}

async function loadDownloadCache(): Promise<DownloadCacheStore> {
  try {
    const raw = await fs.readFile(DOWNLOAD_CACHE_PATH, "utf-8");
    return JSON.parse(raw) as DownloadCacheStore;
  } catch {
    return {};
  }
}

async function saveDownloadCache(store: DownloadCacheStore) {
  await fs.mkdir(path.dirname(DOWNLOAD_CACHE_PATH), { recursive: true });
  await fs.writeFile(DOWNLOAD_CACHE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

async function writeIngestStatus(status: IngestStatus) {
  await fs.mkdir(path.dirname(STATUS_PATH), { recursive: true });
  await fs.writeFile(STATUS_PATH, JSON.stringify(status, null, 2), "utf-8");
}

function strategyList(options: IngestOptions) {
  if (!options.sourceFilter) return OFFICIAL_SOURCE_STRATEGIES;
  return OFFICIAL_SOURCE_STRATEGIES.filter((strategy) => strategy.sourceName === options.sourceFilter);
}

async function fetchIndexPage(
  strategy: SourceStrategy,
  url: string,
  options: IngestOptions
): Promise<{ status: number; text: string; headers: Record<string, string>; failure?: FetchFailure }> {
  const response = await fetchWithPoliteHeaders(url, {
    method: "GET",
    retries: 3,
    logPrefix: `[source:${strategy.sourceName}]`,
  });
  const headerSubset = sanitizeHeaders(response.headers);
  if (response.status >= 400) {
    const failure: FetchFailure = {
      sourceName: strategy.sourceName,
      url,
      statusCode: response.status,
      error: `HTTP ${response.status}`,
      headers: headerSubset,
      bodySnippet: trimSnippet(response.text),
    };
    if (options.debugFetch) {
      logError("source.fetch.failed.debug", failure);
    }
    return { status: response.status, text: response.text, headers: headerSubset, failure };
  }

  logInfo("source.fetch.ok", {
    sourceName: strategy.sourceName,
    url,
    status: response.status,
    fromCache: response.fromCache,
    htmlBytes: response.text.length,
  });
  return { status: response.status, text: response.text, headers: headerSubset };
}

async function discoverSourceLinks(
  strategy: SourceStrategy,
  options: IngestOptions
): Promise<{ links: ParsedLink[]; failures: FetchFailure[]; blocked: boolean; fetchedPages: number }> {
  const links: ParsedLink[] = [];
  const failures: FetchFailure[] = [];
  const pagesVisited = new Set<string>();
  let fetchedPages = 0;
  let blockedCount = 0;

  for (const indexUrl of strategy.indexUrls) {
    if (!isAllowedSourceUrl(indexUrl, strategy)) continue;
    pagesVisited.add(indexUrl);
    fetchedPages += 1;
    const fetchResult = await fetchIndexPage(strategy, indexUrl, options);
    if (fetchResult.failure) {
      failures.push(fetchResult.failure);
      if (fetchResult.status === 403 || fetchResult.status === 401 || fetchResult.status === 429) {
        blockedCount += 1;
      }
      continue;
    }

    const directPdfLinks = extractPdfLinksFromHtml(fetchResult.text, indexUrl, strategy);
    for (const pdfLink of directPdfLinks) {
      links.push(parsePaperMeta(pdfLink, indexUrl, strategy.sourceName));
    }

    const candidatePages = extractCandidateYearPagesFromHtml(fetchResult.text, indexUrl, strategy).slice(
      0,
      strategy.kind === "dbe" ? 140 : 80
    );
    for (const candidatePage of candidatePages) {
      if (pagesVisited.has(candidatePage)) continue;
      pagesVisited.add(candidatePage);
      fetchedPages += 1;
      const candidateResult = await fetchIndexPage(strategy, candidatePage, options);
      if (candidateResult.failure) {
        failures.push(candidateResult.failure);
        continue;
      }
      const candidatePdfLinks = extractPdfLinksFromHtml(candidateResult.text, candidatePage, strategy);
      for (const pdfLink of candidatePdfLinks) {
        links.push(parsePaperMeta(pdfLink, candidatePage, strategy.sourceName));
      }
    }
  }

  const uniqueLinks = Array.from(
    new Map(links.map((item) => [`${item.fileUrl}|${item.sourcePageUrl}`, item])).values()
  );
  const blocked = strategy.indexUrls.length > 0 && blockedCount >= strategy.indexUrls.length;
  return { links: uniqueLinks, failures, blocked, fetchedPages };
}

function sessionOrderValue(session: string) {
  if (session === "Nov") return 0;
  if (session === "May/June") return 1;
  if (session === "March") return 2;
  if (session === "September") return 3;
  return 4;
}

function paperNumberOrderValue(paperNumber: string) {
  const parsed = Number(paperNumber);
  if (Number.isFinite(parsed)) return parsed;
  return 99;
}

function compareParsedLinks(a: ParsedLink, b: ParsedLink) {
  const yearA = a.year === null ? -1 : a.year;
  const yearB = b.year === null ? -1 : b.year;
  if (yearA !== yearB) return yearB - yearA;

  const subjectOrder = a.subject.localeCompare(b.subject, "en", { sensitivity: "base" });
  if (subjectOrder !== 0) return subjectOrder;

  const sessionOrder = sessionOrderValue(a.session) - sessionOrderValue(b.session);
  if (sessionOrder !== 0) return sessionOrder;

  const paperOrder = paperNumberOrderValue(a.paperNumber) - paperNumberOrderValue(b.paperNumber);
  if (paperOrder !== 0) return paperOrder;

  const provinceOrder = a.province.localeCompare(b.province, "en", { sensitivity: "base" });
  if (provinceOrder !== 0) return provinceOrder;

  const languageOrder = a.language.localeCompare(b.language, "en", { sensitivity: "base" });
  if (languageOrder !== 0) return languageOrder;

  const typeOrder = Number(a.isMemo) - Number(b.isMemo);
  if (typeOrder !== 0) return typeOrder;

  const sourcePageOrder = a.sourcePageUrl.localeCompare(b.sourcePageUrl, "en", { sensitivity: "base" });
  if (sourcePageOrder !== 0) return sourcePageOrder;
  return a.fileUrl.localeCompare(b.fileUrl, "en", { sensitivity: "base" });
}

function localIdentityKey(link: ParsedLink) {
  return [
    link.sourceName,
    link.province,
    link.grade === null ? "null" : String(link.grade),
    link.subject,
    link.year === null ? "null" : String(link.year),
    link.session,
    link.paperNumber,
    link.language,
  ].join("|");
}

function applyFilters(links: ParsedLink[], options: IngestOptions, stats: IngestionStats) {
  let out = links;
  if (options.yearFilter !== null) {
    out = out.filter((link) => {
      const include = link.year === options.yearFilter;
      if (!include) stats.linksSkippedByYear += 1;
      return include;
    });
  }
  if (options.provinceFilter) {
    out = out.filter((link) => {
      const include = link.province === options.provinceFilter;
      if (!include) stats.linksSkippedByProvince += 1;
      return include;
    });
  }

  const sorted = [...out].sort(compareParsedLinks);
  const groups = new Map<string, { paper: ParsedLink | null; memo: ParsedLink | null }>();
  for (const link of sorted) {
    const key = localIdentityKey(link);
    const current = groups.get(key) || { paper: null, memo: null };
    if (link.isMemo) {
      if (!current.memo) current.memo = link;
    } else if (!current.paper) {
      current.paper = link;
    }
    groups.set(key, current);
  }

  const groupedEntries = Array.from(groups.values()).sort((a, b) => {
    const left = a.paper || a.memo;
    const right = b.paper || b.memo;
    if (!left || !right) return 0;
    return compareParsedLinks(left, right);
  });

  const groupsWithBoth = groupedEntries.filter((entry) => entry.paper && entry.memo);
  const groupsSingleOnly = groupedEntries.filter((entry) => !(entry.paper && entry.memo));

  stats.selectionGroupsTotal = groupedEntries.length;
  stats.selectionGroupsWithBoth = groupsWithBoth.length;
  stats.selectionGroupsSingleOnly = groupsSingleOnly.length;
  stats.selectionLinksFromPairedGroups = 0;

  const flattened: ParsedLink[] = [];
  for (const entry of groupedEntries) {
    if (entry.paper) flattened.push(entry.paper);
    if (entry.memo) flattened.push(entry.memo);
  }

  if (options.maxLinks === null || options.maxLinks < 0) {
    stats.selectionLinksFromPairedGroups = groupsWithBoth.length * 2;
    return flattened;
  }

  const selected: ParsedLink[] = [];
  let pairedLinksSelected = 0;
  const usedEntryKeys = new Set<string>();
  const appendLink = (link: ParsedLink) => {
    if (selected.length >= options.maxLinks!) return false;
    selected.push(link);
    return true;
  };

  const entryKey = (entry: { paper: ParsedLink | null; memo: ParsedLink | null }) => {
    const pivot = entry.paper || entry.memo;
    if (!pivot) return null;
    return localIdentityKey(pivot);
  };

  const remainingCapacity = () => options.maxLinks! - selected.length;

  const byGrade = new Map<number | null, Array<{ paper: ParsedLink | null; memo: ParsedLink | null }>>();
  for (const entry of groupedEntries) {
    const pivot = entry.paper || entry.memo;
    if (!pivot) continue;
    const bucket = byGrade.get(pivot.grade) || [];
    bucket.push(entry);
    byGrade.set(pivot.grade, bucket);
  }

  const sortedGrades = Array.from(byGrade.keys()).sort((a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
  });

  for (const grade of sortedGrades) {
    if (remainingCapacity() <= 0) break;
    const bucket = byGrade.get(grade);
    if (!bucket || bucket.length === 0) continue;
    const pairCandidate = bucket.find((entry) => entry.paper && entry.memo) || bucket[0];
    if (!pairCandidate) continue;
    const key = entryKey(pairCandidate);
    if (key) usedEntryKeys.add(key);

    if (pairCandidate.paper && pairCandidate.memo && remainingCapacity() >= 2) {
      if (!appendLink(pairCandidate.paper)) break;
      if (!appendLink(pairCandidate.memo)) break;
      pairedLinksSelected += 2;
      continue;
    }

    const single = pairCandidate.paper || pairCandidate.memo;
    if (single) {
      if (!appendLink(single)) break;
    }
  }

  const gradeBucketsWithBoth = new Map<number | null, Array<{ paper: ParsedLink | null; memo: ParsedLink | null }>>();
  for (const entry of groupsWithBoth) {
    const key = entryKey(entry);
    if (key && usedEntryKeys.has(key)) continue;
    const pivot = entry.paper || entry.memo;
    if (!pivot) continue;
    const bucket = gradeBucketsWithBoth.get(pivot.grade) || [];
    bucket.push(entry);
    gradeBucketsWithBoth.set(pivot.grade, bucket);
  }

  while (remainingCapacity() > 0) {
    let progressed = false;
    for (const grade of sortedGrades) {
      if (remainingCapacity() <= 0) break;
      const bucket = gradeBucketsWithBoth.get(grade);
      if (!bucket || bucket.length === 0) continue;
      const entry = bucket.shift();
      if (!entry || !entry.paper || !entry.memo) continue;
      const key = entryKey(entry);
      if (key && usedEntryKeys.has(key)) continue;
      if (!appendLink(entry.paper)) break;
      if (!appendLink(entry.memo)) break;
      pairedLinksSelected += 2;
      progressed = true;
      if (key) usedEntryKeys.add(key);
    }
    if (!progressed) break;
  }

  if (selected.length < options.maxLinks) {
    const gradeBucketsSingle = new Map<number | null, Array<{ paper: ParsedLink | null; memo: ParsedLink | null }>>();
    for (const entry of groupsSingleOnly) {
      const key = entryKey(entry);
      if (key && usedEntryKeys.has(key)) continue;
      const pivot = entry.paper || entry.memo;
      if (!pivot) continue;
      const bucket = gradeBucketsSingle.get(pivot.grade) || [];
      bucket.push(entry);
      gradeBucketsSingle.set(pivot.grade, bucket);
    }

    while (remainingCapacity() > 0) {
      let progressed = false;
      for (const grade of sortedGrades) {
        if (remainingCapacity() <= 0) break;
        const bucket = gradeBucketsSingle.get(grade);
        if (!bucket || bucket.length === 0) continue;
        const entry = bucket.shift();
        if (!entry) continue;
        const key = entryKey(entry);
        if (key && usedEntryKeys.has(key)) continue;
        if (entry.paper) {
          if (!appendLink(entry.paper)) break;
        } else if (entry.memo) {
          if (!appendLink(entry.memo)) break;
        } else {
          continue;
        }
        progressed = true;
        if (key) usedEntryKeys.add(key);
      }
      if (!progressed) break;
    }
  }

  if (selected.length < options.maxLinks) {
    for (const entry of groupsWithBoth) {
      if (selected.length >= options.maxLinks) break;
      const key = entryKey(entry);
      if (key && usedEntryKeys.has(key)) continue;
      if (entry.paper && !selected.some((item) => item.fileUrl === entry.paper!.fileUrl && item.sourcePageUrl === entry.paper!.sourcePageUrl)) {
        if (!appendLink(entry.paper)) break;
      }
      if (selected.length >= options.maxLinks) break;
      if (entry.memo && !selected.some((item) => item.fileUrl === entry.memo!.fileUrl && item.sourcePageUrl === entry.memo!.sourcePageUrl)) {
        if (!appendLink(entry.memo)) break;
      }
      if (key) usedEntryKeys.add(key);
    }
  }

  stats.selectionLinksFromPairedGroups = pairedLinksSelected;
  logInfo("selection.summary", {
    maxLinks: options.maxLinks,
    selected: selected.length,
    groupsTotal: stats.selectionGroupsTotal,
    groupsWithBoth: stats.selectionGroupsWithBoth,
    groupsSingleOnly: stats.selectionGroupsSingleOnly,
    linksFromPairedGroups: stats.selectionLinksFromPairedGroups,
  });
  return selected;
}

async function ensureSourceRow(strategy: SourceStrategy, dryRun: boolean) {
  const existing = await prisma.pastPaperSource.findUnique({
    where: { name: strategy.sourceName },
  });
  if (existing) return existing;
  if (dryRun) {
    return {
      id: `dry-run-${strategy.sourceName.toLowerCase()}`,
      name: strategy.sourceName,
      baseUrl: strategy.baseUrl,
      robotsRespectNote: strategy.robotsNote,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return prisma.pastPaperSource.create({
    data: {
      name: strategy.sourceName,
      baseUrl: strategy.baseUrl,
      robotsRespectNote: strategy.robotsNote,
    },
  });
}

async function downloadAndStorePdf(
  fileUrl: string,
  storageKey: string,
  cache: DownloadCacheStore
): Promise<{ changed: boolean; sha: string }> {
  const response = await fetchWithPoliteHeaders(fileUrl, {
    method: "GET",
    retries: 3,
    logPrefix: "[download]",
    skipCache: true,
    responseType: "buffer",
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${fileUrl} (HTTP ${response.status})`);
  }

  const contentType = response.headers["content-type"] || "";
  if (contentType && !contentType.toLowerCase().includes("pdf")) {
    logWarn("download.contentType.unexpected", { fileUrl, contentType });
  }

  const bodyBuffer = response.bodyBuffer;
  const hash = sha256(bodyBuffer);
  const cached = cache[fileUrl];
  if (cached?.sha256 === hash) {
    const targetExists = await provider.exists(storageKey);
    if (targetExists) {
      return { changed: false, sha: hash };
    }
    await provider.put({
      key: storageKey,
      contentType: "application/pdf",
      body: bodyBuffer,
    });
    return { changed: true, sha: hash };
  }

  await provider.put({
    key: storageKey,
    contentType: "application/pdf",
    body: bodyBuffer,
  });

  cache[fileUrl] = { sha256: hash };
  return { changed: true, sha: hash };
}

function buildIdentityFields(link: ParsedLink, sourceId: string): IdentityFields {
  return {
    sourceId,
    province: link.province,
    grade: link.grade,
    subject: link.subject,
    year: link.year,
    session: link.session,
    paperNumber: link.paperNumber,
    language: link.language,
  };
}

function identityKeyOf(fields: IdentityFields) {
  const grade = fields.grade === null ? "null" : String(fields.grade);
  const year = fields.year === null ? "null" : String(fields.year);
  return [
    fields.sourceId,
    fields.province,
    grade,
    fields.subject,
    year,
    fields.session,
    fields.paperNumber,
    fields.language,
  ].join("|");
}

async function processLink(
  link: ParsedLink,
  sourceId: string,
  options: IngestOptions,
  stats: IngestionStats,
  failures: FetchFailure[],
  cache: DownloadCacheStore
) {
  const subjectSlug = slugify(link.subject);
  const gradeSegment = link.grade === null ? "grade-unknown" : `grade-${String(link.grade).padStart(2, "0")}`;
  const yearSegment = link.year === null ? "year-unknown" : String(link.year);
  const storageKey =
    `${link.sourceName.toLowerCase()}/` +
    `${link.province}/` +
    `${gradeSegment}/` +
    `${subjectSlug}/` +
    `${yearSegment}/` +
    `${slugify(link.session)}/` +
    `${link.isMemo ? "memo" : "paper"}-${link.paperNumber}.pdf`;

  const uniqueKey = buildIdentityFields(link, sourceId);
  const identityKey = identityKeyOf(uniqueKey);
  const existingByIdentity = sourceId.startsWith("dry-run-") ? null : await prisma.pastPaper.findFirst({ where: uniqueKey });
  const existingByOriginalCandidates = sourceId.startsWith("dry-run-")
    ? []
    : await prisma.pastPaper.findMany({
        where: link.isMemo ? { sourceId, memoUrlOriginal: link.fileUrl } : { sourceId, paperUrlOriginal: link.fileUrl },
        orderBy: { updatedAt: "desc" },
      });
  const existingByOriginalUrl = existingByOriginalCandidates[0] || null;
  const duplicatesByOriginal =
    existingByIdentity && existingByOriginalCandidates.length > 0
      ? existingByOriginalCandidates.filter((row) => row.id !== existingByIdentity.id)
      : null;
  const existing = existingByIdentity || existingByOriginalUrl;
  const identityMismatch = Boolean(
    existing &&
      (existing.province !== uniqueKey.province ||
        existing.grade !== uniqueKey.grade ||
        existing.subject !== uniqueKey.subject ||
        existing.year !== uniqueKey.year ||
        existing.session !== uniqueKey.session ||
        existing.paperNumber !== uniqueKey.paperNumber ||
        existing.language !== uniqueKey.language)
  );

  if (options.dryRun) {
    logInfo("paper.dry-run", {
      identityKey,
      sourceName: link.sourceName,
      sourcePageUrl: link.sourcePageUrl,
      fileUrl: link.fileUrl,
      label: link.label,
      subject: link.subject,
      grade: link.grade,
      year: link.year,
      session: link.session,
      paperNumber: link.paperNumber,
      language: link.language,
      isMemo: link.isMemo,
      storageKey,
      action: existingByIdentity ? "would-update" : existingByOriginalUrl ? "would-reconcile" : "would-insert",
      uiReady: isUiReady({ ...link, paperStorageKey: link.isMemo ? null : storageKey }),
    });
    return;
  }

  try {
    const downloaded = await downloadAndStorePdf(link.fileUrl, storageKey, cache);
    if (!downloaded.changed && existing) {
      const targetIsMissing = link.isMemo
        ? !existing.memoStorageKey || !existing.memoUrlOriginal
        : !existing.paperStorageKey || !existing.paperUrlOriginal;
      if (!targetIsMissing && !identityMismatch) {
        if (duplicatesByOriginal && duplicatesByOriginal.length > 0) {
          for (const duplicateByOriginal of duplicatesByOriginal) {
            await prisma.pastPaper.update({
              where: { id: existing.id },
              data: {
                paperUrlOriginal: existing.paperUrlOriginal || duplicateByOriginal.paperUrlOriginal,
                memoUrlOriginal: existing.memoUrlOriginal || duplicateByOriginal.memoUrlOriginal,
                paperStorageKey: existing.paperStorageKey || duplicateByOriginal.paperStorageKey,
                memoStorageKey: existing.memoStorageKey || duplicateByOriginal.memoStorageKey,
                sha256Paper: existing.sha256Paper || duplicateByOriginal.sha256Paper,
                sha256Memo: existing.sha256Memo || duplicateByOriginal.sha256Memo,
                sourcePageUrl: existing.sourcePageUrl || duplicateByOriginal.sourcePageUrl,
              },
            });
            await prisma.pastPaper.delete({ where: { id: duplicateByOriginal.id } });
            logInfo("paper.reconciled.duplicate", {
              keptId: existing.id,
              deletedId: duplicateByOriginal.id,
              identityKey,
              fileUrl: link.fileUrl,
            });
          }
        }
        stats.skippedUnchanged += 1;
        await prisma.pastPaper.update({
          where: { id: existing.id },
          data: { ...uniqueKey, lastSeenAt: new Date(), sourcePageUrl: link.sourcePageUrl },
        });
        return;
      }
    }

    if (existing) {
      await prisma.pastPaper.update({
        where: { id: existing.id },
        data: {
          ...uniqueKey,
          title: link.title,
          sourcePageUrl: link.sourcePageUrl,
          paperUrlOriginal: link.isMemo ? existing.paperUrlOriginal : link.fileUrl,
          memoUrlOriginal: link.isMemo ? link.fileUrl : existing.memoUrlOriginal,
          paperStorageKey: link.isMemo ? existing.paperStorageKey : storageKey,
          memoStorageKey: link.isMemo ? storageKey : existing.memoStorageKey,
          sha256Paper: link.isMemo ? existing.sha256Paper : downloaded.sha,
          sha256Memo: link.isMemo ? downloaded.sha : existing.sha256Memo,
          lastSeenAt: new Date(),
        },
      });
      stats.updated += 1;

      if (duplicatesByOriginal && duplicatesByOriginal.length > 0) {
        for (const duplicateByOriginal of duplicatesByOriginal) {
          await prisma.pastPaper.update({
            where: { id: existing.id },
            data: {
              paperUrlOriginal: existing.paperUrlOriginal || duplicateByOriginal.paperUrlOriginal,
              memoUrlOriginal: existing.memoUrlOriginal || duplicateByOriginal.memoUrlOriginal,
              paperStorageKey: existing.paperStorageKey || duplicateByOriginal.paperStorageKey,
              memoStorageKey: existing.memoStorageKey || duplicateByOriginal.memoStorageKey,
              sha256Paper: existing.sha256Paper || duplicateByOriginal.sha256Paper,
              sha256Memo: existing.sha256Memo || duplicateByOriginal.sha256Memo,
              sourcePageUrl: existing.sourcePageUrl || duplicateByOriginal.sourcePageUrl,
            },
          });
          await prisma.pastPaper.delete({ where: { id: duplicateByOriginal.id } });
          logInfo("paper.reconciled.duplicate", {
            keptId: existing.id,
            deletedId: duplicateByOriginal.id,
            identityKey,
            fileUrl: link.fileUrl,
          });
        }
      }
    } else {
      await prisma.pastPaper.create({
        data: {
          ...uniqueKey,
          title: link.title,
          sourcePageUrl: link.sourcePageUrl,
          paperUrlOriginal: link.isMemo ? null : link.fileUrl,
          memoUrlOriginal: link.isMemo ? link.fileUrl : null,
          paperStorageKey: link.isMemo ? null : storageKey,
          memoStorageKey: link.isMemo ? storageKey : null,
          sha256Paper: link.isMemo ? null : downloaded.sha,
          sha256Memo: link.isMemo ? downloaded.sha : null,
          lastSeenAt: new Date(),
        },
      });
      stats.inserted += 1;
    }
  } catch (error) {
    const normalized = normalizeError(error);
    stats.errors += 1;
    failures.push({
      sourceName: link.sourceName,
      url: link.fileUrl,
      statusCode: null,
      error: normalized.message,
      bodySnippet: normalized.stack?.slice(0, 300),
    });
    logError("paper.failed", {
      identityKey,
      sourceName: link.sourceName,
      fileUrl: link.fileUrl,
      error: normalized.message,
      stack: normalized.stack,
    });
  }
}

function matchesRepairTarget(row: PairingDbRow, candidate: ParsedLink, targetMemo: boolean) {
  if (candidate.isMemo !== targetMemo) return false;
  if (candidate.province !== row.province) return false;
  if (candidate.subject !== row.subject) return false;
  if (candidate.session !== row.session) return false;
  if (candidate.paperNumber !== row.paperNumber) return false;
  if (candidate.language !== row.language) return false;
  if (candidate.grade !== row.grade) return false;
  if (candidate.year !== row.year) return false;
  return true;
}

async function loadParsedLinksForSourcePage(
  strategy: SourceStrategy,
  sourcePageUrl: string,
  options: IngestOptions,
  failures: FetchFailure[],
  pageCache: Map<string, ParsedLink[]>
): Promise<ParsedLink[]> {
  const cached = pageCache.get(sourcePageUrl);
  if (cached) return cached;
  if (!isAllowedSourceUrl(sourcePageUrl, strategy)) {
    logWarn("repair.page.disallowed", { sourcePageUrl, sourceName: strategy.sourceName });
    pageCache.set(sourcePageUrl, []);
    return [];
  }

  const pageResult = await fetchIndexPage(strategy, sourcePageUrl, options);
  if (pageResult.failure) {
    failures.push(pageResult.failure);
    pageCache.set(sourcePageUrl, []);
    return [];
  }

  const parsed = extractPdfLinksFromHtml(pageResult.text, sourcePageUrl, strategy).map((item) =>
    parsePaperMeta(item, sourcePageUrl, strategy.sourceName)
  );
  pageCache.set(sourcePageUrl, parsed);
  return parsed;
}

async function runOrphanRepairPass(
  strategy: SourceStrategy,
  sourceId: string,
  options: IngestOptions,
  stats: IngestionStats,
  failures: FetchFailure[],
  cache: DownloadCacheStore
): Promise<RepairSummary | null> {
  if (options.dryRun || !options.repairOrphans || sourceId.startsWith("dry-run-")) {
    return null;
  }

  const select = {
    id: true,
    sourceId: true,
    province: true,
    grade: true,
    subject: true,
    year: true,
    session: true,
    paperNumber: true,
    language: true,
    sourcePageUrl: true,
    paperUrlOriginal: true,
    memoUrlOriginal: true,
    paperStorageKey: true,
    memoStorageKey: true,
  } as const;

  const [paperOnlyRows, memoOnlyRows] = await Promise.all([
    prisma.pastPaper.findMany({
      where: { sourceId, paperStorageKey: { not: null }, memoStorageKey: null, sourcePageUrl: { not: null } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: options.repairLimit,
      select,
    }),
    prisma.pastPaper.findMany({
      where: { sourceId, paperStorageKey: null, memoStorageKey: { not: null }, sourcePageUrl: { not: null } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: options.repairLimit,
      select,
    }),
  ]);

  const targets: Array<{ row: PairingDbRow; targetMemo: boolean }> = [
    ...paperOnlyRows.map((row) => ({ row: row as PairingDbRow, targetMemo: true })),
    ...memoOnlyRows.map((row) => ({ row: row as PairingDbRow, targetMemo: false })),
  ];

  const pageCache = new Map<string, ParsedLink[]>();
  const repairedIds: string[] = [];
  let attemptedCount = 0;
  let succeededCount = 0;

  for (const target of targets) {
    const sourcePageUrl = target.row.sourcePageUrl;
    if (!sourcePageUrl) continue;
    attemptedCount += 1;
    const parsedLinks = await loadParsedLinksForSourcePage(strategy, sourcePageUrl, options, failures, pageCache);
    const match = parsedLinks
      .filter((candidate) => matchesRepairTarget(target.row, candidate, target.targetMemo))
      .sort(compareParsedLinks)[0];

    if (!match) continue;

    const beforeCounterpart = target.targetMemo ? target.row.memoStorageKey : target.row.paperStorageKey;
    if (beforeCounterpart) continue;

    await processLink(match, sourceId, { ...options, dryRun: false }, stats, failures, cache);

    const refreshed = await prisma.pastPaper.findFirst({
      where: {
        sourceId,
        province: target.row.province,
        grade: target.row.grade,
        subject: target.row.subject,
        year: target.row.year,
        session: target.row.session,
        paperNumber: target.row.paperNumber,
        language: target.row.language,
      },
      select: { id: true, paperStorageKey: true, memoStorageKey: true },
      orderBy: { updatedAt: "desc" },
    });

    const repaired = target.targetMemo ? Boolean(refreshed?.memoStorageKey) : Boolean(refreshed?.paperStorageKey);
    if (repaired) {
      succeededCount += 1;
      if (refreshed?.id && repairedIds.length < 20) repairedIds.push(refreshed.id);
      logInfo("repair.orphan.succeeded", {
        targetId: target.row.id,
        repairedId: refreshed?.id,
        sourcePageUrl,
        fileUrl: match.fileUrl,
        repairedField: target.targetMemo ? "memoStorageKey" : "paperStorageKey",
      });
    }
  }

  stats.repairAttemptedCount = attemptedCount;
  stats.repairSucceededCount = succeededCount;
  return {
    attemptedCount,
    succeededCount,
    repairedIds,
  };
}

async function computePairingStats(
  sourceId: string | null,
  dryRunLinks: ParsedLink[] | null
): Promise<{ uiReadyCount: number; paperOnlyCount: number; memoOnlyCount: number; bothCount: number }> {
  if (!sourceId || sourceId.startsWith("dry-run-")) {
    const grouped = new Map<string, { paper: boolean; memo: boolean; uiReadyPaper: boolean }>();
    for (const link of dryRunLinks || []) {
      const key = [
        link.sourceName,
        link.province,
        link.grade === null ? "null" : String(link.grade),
        link.subject,
        link.year === null ? "null" : String(link.year),
        link.session,
        link.paperNumber,
        link.language,
      ].join("|");
      const entry = grouped.get(key) || { paper: false, memo: false, uiReadyPaper: false };
      if (link.isMemo) {
        entry.memo = true;
      } else {
        entry.paper = true;
        entry.uiReadyPaper = isUiReady({ ...link, paperStorageKey: "x" });
      }
      grouped.set(key, entry);
    }

    let paperOnlyCount = 0;
    let memoOnlyCount = 0;
    let bothCount = 0;
    let uiReadyCount = 0;
    for (const item of grouped.values()) {
      if (item.paper && item.memo) bothCount += 1;
      else if (item.paper) paperOnlyCount += 1;
      else if (item.memo) memoOnlyCount += 1;
      if (item.uiReadyPaper) uiReadyCount += 1;
    }
    return { uiReadyCount, paperOnlyCount, memoOnlyCount, bothCount };
  }

  const [paperOnlyCount, memoOnlyCount, bothCount, uiReadyCount] = await Promise.all([
    prisma.pastPaper.count({
      where: { sourceId, paperStorageKey: { not: null }, memoStorageKey: null },
    }),
    prisma.pastPaper.count({
      where: { sourceId, paperStorageKey: null, memoStorageKey: { not: null } },
    }),
    prisma.pastPaper.count({
      where: { sourceId, paperStorageKey: { not: null }, memoStorageKey: { not: null } },
    }),
    prisma.pastPaper.count({
      where: {
        sourceId,
        paperStorageKey: { not: null },
        grade: { not: null },
        year: { not: null },
        subject: { not: UNKNOWN_SUBJECT },
      },
    }),
  ]);

  return { uiReadyCount, paperOnlyCount, memoOnlyCount, bothCount };
}

function identityKeyFromRow(row: Pick<PairingDbRow, "sourceId" | "province" | "grade" | "subject" | "year" | "session" | "paperNumber" | "language">) {
  return [
    row.sourceId,
    row.province,
    row.grade === null ? "null" : String(row.grade),
    row.subject,
    row.year === null ? "null" : String(row.year),
    row.session,
    row.paperNumber,
    row.language,
  ].join("|");
}

function diffFields(a: Pick<PairingDbRow, "session" | "paperNumber" | "language">, b: Pick<PairingDbRow, "session" | "paperNumber" | "language">) {
  const diffs: string[] = [];
  if (a.session !== b.session) diffs.push("session");
  if (a.paperNumber !== b.paperNumber) diffs.push("paperNumber");
  if (a.language !== b.language) diffs.push("language");
  return diffs;
}

async function computePairingDriftReport(sourceId: string): Promise<PairingDriftReport> {
  const select = {
    id: true,
    sourceId: true,
    province: true,
    grade: true,
    subject: true,
    year: true,
    session: true,
    paperNumber: true,
    language: true,
    sourcePageUrl: true,
    paperUrlOriginal: true,
    memoUrlOriginal: true,
    paperStorageKey: true,
    memoStorageKey: true,
  } as const;

  const [paperOnlyRows, memoOnlyRows] = await Promise.all([
    prisma.pastPaper.findMany({
      where: { sourceId, paperStorageKey: { not: null }, memoStorageKey: null },
      orderBy: { updatedAt: "desc" },
      select,
    }),
    prisma.pastPaper.findMany({
      where: { sourceId, paperStorageKey: null, memoStorageKey: { not: null } },
      orderBy: { updatedAt: "desc" },
      select,
    }),
  ]);

  const paperOnly = paperOnlyRows as PairingDbRow[];
  const memoOnly = memoOnlyRows as PairingDbRow[];

  const buildNeighbors = (row: PairingDbRow, candidates: PairingDbRow[], useMemoOriginal: boolean): DriftNeighbor[] => {
    return candidates
      .filter(
        (candidate) =>
          candidate.sourceId === row.sourceId &&
          candidate.province === row.province &&
          candidate.grade === row.grade &&
          candidate.year === row.year &&
          candidate.subject === row.subject &&
          candidate.language === row.language &&
          (candidate.session !== row.session || candidate.paperNumber !== row.paperNumber)
      )
      .map((candidate) => {
        const diffs = diffFields(row, candidate);
        return {
          identityKey: identityKeyFromRow(candidate),
          diffFields: diffs,
          sourcePageUrl: candidate.sourcePageUrl,
          fileUrlOriginal: useMemoOriginal ? candidate.memoUrlOriginal : candidate.paperUrlOriginal,
        };
      })
      .sort((a, b) => a.diffFields.length - b.diffFields.length)
      .slice(0, 3);
  };

  const paperOnlyDrift: DriftRecord[] = paperOnly
    .map((row) => ({
      identityKey: identityKeyFromRow(row),
      sourcePageUrl: row.sourcePageUrl,
      fileUrlOriginal: row.paperUrlOriginal,
      nearestCandidates: buildNeighbors(row, memoOnly, true),
    }))
    .filter((record) => record.nearestCandidates.length > 0);

  const memoOnlyDrift: DriftRecord[] = memoOnly
    .map((row) => ({
      identityKey: identityKeyFromRow(row),
      sourcePageUrl: row.sourcePageUrl,
      fileUrlOriginal: row.memoUrlOriginal,
      nearestCandidates: buildNeighbors(row, paperOnly, false),
    }))
    .filter((record) => record.nearestCandidates.length > 0);

  const candidateMatches =
    paperOnlyDrift.reduce((acc, row) => acc + row.nearestCandidates.length, 0) +
    memoOnlyDrift.reduce((acc, row) => acc + row.nearestCandidates.length, 0);

  return {
    generatedAtIso: new Date().toISOString(),
    paperOnlyCount: paperOnly.length,
    memoOnlyCount: memoOnly.length,
    candidateMatches,
    paperOnlyDrift: paperOnlyDrift.slice(0, 20),
    memoOnlyDrift: memoOnlyDrift.slice(0, 20),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const failures: FetchFailure[] = [];
  const stats: IngestionStats = {
    pagesFetched: 0,
    linksExtracted: 0,
    linksSelected: 0,
    linksSkippedByYear: 0,
    linksSkippedByProvince: 0,
    selectionGroupsTotal: 0,
    selectionGroupsWithBoth: 0,
    selectionGroupsSingleOnly: 0,
    selectionLinksFromPairedGroups: 0,
    skippedMeta: 0,
    skippedUnchanged: 0,
    inserted: 0,
    updated: 0,
    errors: 0,
    uiReadyCount: 0,
    paperOnlyCount: 0,
    memoOnlyCount: 0,
    bothCount: 0,
    repairAttemptedCount: 0,
    repairSucceededCount: 0,
  };
  const downloadCache = await loadDownloadCache();
  let driftReport: PairingDriftReport | null = null;
  let repairSummary: RepairSummary | null = null;

  const chosenStrategies = strategyList(options);
  if (chosenStrategies.length === 0) {
    throw new Error(`No source strategy matched filter "${options.sourceFilter}"`);
  }

  logInfo("start", {
    dryRun: options.dryRun,
    yearFilter: options.yearFilter,
    provinceFilter: options.provinceFilter,
    maxLinks: options.maxLinks,
    sourceFilter: options.sourceFilter,
    repairOrphans: options.repairOrphans,
    repairLimit: options.repairLimit,
    strategies: chosenStrategies.map((item) => item.sourceName),
  });

  let selectedSource: string | null = null;
  let selectedLinks: ParsedLink[] = [];

  for (const strategy of chosenStrategies) {
    try {
      const robotsAllowed = await readRobotsAllowed(strategy);
      if (!robotsAllowed) {
        stats.errors += 1;
        failures.push({
          sourceName: strategy.sourceName,
          url: new URL("/robots.txt", strategy.baseUrl).toString(),
          statusCode: 999,
          error: "Blocked by robots.txt",
        });
        logError("robots.disallow", { sourceName: strategy.sourceName });
        continue;
      }

      const discovered = await discoverSourceLinks(strategy, options);
      failures.push(...discovered.failures);
      stats.errors += discovered.failures.length;
      stats.linksExtracted += discovered.links.length;
      stats.pagesFetched += discovered.fetchedPages;

      const filtered = applyFilters(discovered.links, options, stats);
      stats.linksSelected += filtered.length;
      logInfo("source.links.selected", {
        sourceName: strategy.sourceName,
        discovered: discovered.links.length,
        selected: filtered.length,
        blocked: discovered.blocked,
      });

      if (filtered.length > 0) {
        selectedSource = strategy.sourceName;
        selectedLinks = filtered;
        break;
      }

      if (!discovered.blocked) {
        selectedSource = strategy.sourceName;
      } else {
        logWarn("source.blocked", { sourceName: strategy.sourceName, reason: "HTTP 403/401/429 on index pages" });
      }
    } catch (error) {
      const normalized = normalizeError(error);
      stats.errors += 1;
      failures.push({
        sourceName: strategy.sourceName,
        url: strategy.baseUrl,
        statusCode: null,
        error: normalized.message,
      });
      logError("source.strategy.failed", {
        sourceName: strategy.sourceName,
        error: normalized.message,
        stack: normalized.stack,
      });
    }
  }

  if (!selectedSource) {
    const errorSummary = "No official source returned parseable links.";
    const status: IngestStatus = {
      ranAtIso: new Date().toISOString(),
      ok: false,
      dryRun: options.dryRun,
      sourceName: null,
      errorSummary,
      stats,
      failures: failures.slice(0, 15),
      driftReport: null,
      repairSummary: null,
    };
    await writeIngestStatus(status);
    logError("summary", {
      elapsedMs: Date.now() - startedAt,
      ...status,
    });
    if (options.failOnError) {
      process.exit(1);
    }
    return;
  }

  const strategy = OFFICIAL_SOURCE_STRATEGIES.find((item) => item.sourceName === selectedSource);
  if (!strategy) {
    throw new Error(`Selected source "${selectedSource}" not found`);
  }

  const sourceRow = await ensureSourceRow(strategy, options.dryRun);
  for (const link of selectedLinks) {
    await processLink(link, sourceRow.id, options, stats, failures, downloadCache);
  }

  repairSummary = await runOrphanRepairPass(strategy, sourceRow.id, options, stats, failures, downloadCache);
  if (repairSummary) {
    logInfo("repair.summary", repairSummary);
  }

  if (!options.dryRun) {
    await saveDownloadCache(downloadCache);
  }

  const pairingStats = await computePairingStats(sourceRow.id, options.dryRun ? selectedLinks : null);
  stats.uiReadyCount = pairingStats.uiReadyCount;
  stats.paperOnlyCount = pairingStats.paperOnlyCount;
  stats.memoOnlyCount = pairingStats.memoOnlyCount;
  stats.bothCount = pairingStats.bothCount;

  logInfo("pairing.summary", pairingStats);

  if (!options.dryRun && !sourceRow.id.startsWith("dry-run-")) {
    driftReport = await computePairingDriftReport(sourceRow.id);
    logInfo("pairing.drift.summary", {
      paperOnlyCount: driftReport.paperOnlyCount,
      memoOnlyCount: driftReport.memoOnlyCount,
      candidateMatches: driftReport.candidateMatches,
      paperOnlyDriftCount: driftReport.paperOnlyDrift.length,
      memoOnlyDriftCount: driftReport.memoOnlyDrift.length,
    });
    if (driftReport.paperOnlyDrift.length > 0 || driftReport.memoOnlyDrift.length > 0) {
      logWarn("pairing.drift.sample", {
        paperOnlyDrift: driftReport.paperOnlyDrift.slice(0, 10),
        memoOnlyDrift: driftReport.memoOnlyDrift.slice(0, 10),
      });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const ok = stats.errors === 0 && selectedLinks.length > 0 && stats.uiReadyCount > 0;
  const errorSummary = failures.length > 0 ? failures[0].error : null;
  const status: IngestStatus = {
    ranAtIso: new Date().toISOString(),
    ok,
    dryRun: options.dryRun,
    sourceName: selectedSource,
    errorSummary,
    stats,
    failures: failures.slice(0, 15),
    driftReport,
    repairSummary,
  };
  await writeIngestStatus(status);

  logInfo("summary", {
    elapsedMs,
    selectedSource,
    ok,
    ...stats,
    failureCount: failures.length,
  });
  if (failures.length > 0) {
    logError("failures.sample", {
      failures: failures.slice(0, 10),
    });
  }

  if (options.failOnError && (stats.errors > 0 || selectedLinks.length === 0 || stats.uiReadyCount === 0)) {
    process.exit(1);
  }
}

main()
  .catch(async (error) => {
    const normalized = normalizeError(error);
    logError("fatal", { error: normalized.message, stack: normalized.stack });
    const emptyStats: IngestionStats = {
      pagesFetched: 0,
      linksExtracted: 0,
      linksSelected: 0,
      linksSkippedByYear: 0,
      linksSkippedByProvince: 0,
      selectionGroupsTotal: 0,
      selectionGroupsWithBoth: 0,
      selectionGroupsSingleOnly: 0,
      selectionLinksFromPairedGroups: 0,
      skippedMeta: 0,
      skippedUnchanged: 0,
      inserted: 0,
      updated: 0,
      errors: 1,
      uiReadyCount: 0,
      paperOnlyCount: 0,
      memoOnlyCount: 0,
      bothCount: 0,
      repairAttemptedCount: 0,
      repairSucceededCount: 0,
    };
    await writeIngestStatus({
      ranAtIso: new Date().toISOString(),
      ok: false,
      dryRun: false,
      sourceName: null,
      errorSummary: normalized.message,
      stats: emptyStats,
      failures: [],
      driftReport: null,
      repairSummary: null,
    });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
