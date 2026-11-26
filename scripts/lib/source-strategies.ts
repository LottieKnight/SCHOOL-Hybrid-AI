export type SourceStrategy = {
  sourceName: "DBE" | "WCED" | "KZN_DOE";
  kind: "dbe" | "wced" | "kzn";
  baseUrl: string;
  indexUrls: string[];
  allowHostnames: string[];
  robotsNote: string;
};

export type ExtractedPdfLink = {
  url: string;
  label: string;
  contextText?: string;
};

const DBE_INDEXES = [
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate%28NSC%29Examinations/NSCPastExaminationpapers.aspx",
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate%28NSC%29Examinations/PastExamPapers.aspx",
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate%28NSC%29Examinations/Grade11Exams.aspx",
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate%28NSC%29Examinations/Grade10Exams.aspx",
];

const WCED_INDEXES = [
  "https://wcedonline.westerncape.gov.za/curriculum-assessment-management/past-exam-papers",
  "https://www.westerncape.gov.za/education/exams",
  "https://www.westerncape.gov.za/education/national-senior-certificate-nsc-exams",
  "https://www.westerncape.gov.za/education/national-senior-certificate-nsc-exams-june",
  "https://www.westerncape.gov.za/education/senior-certificate-sc-exams-mayjune",
];

const KZN_INDEXES = [
  "https://www.kzneducation.gov.za/index.php/resources/nsc-past-examination-papers",
  "https://www.kzneducation.gov.za/",
];

export const OFFICIAL_SOURCE_STRATEGIES: SourceStrategy[] = [
  {
    sourceName: "DBE",
    kind: "dbe",
    baseUrl: "https://www.education.gov.za/",
    indexUrls: DBE_INDEXES,
    allowHostnames: ["www.education.gov.za", "education.gov.za"],
    robotsNote: "Robots.txt respected; 1 req/sec, concurrency 2.",
  },
  {
    sourceName: "WCED",
    kind: "wced",
    baseUrl: "https://wcedonline.westerncape.gov.za/",
    indexUrls: WCED_INDEXES,
    allowHostnames: ["wcedonline.westerncape.gov.za", "westerncape.gov.za", "www.westerncape.gov.za"],
    robotsNote: "Official WCED source fallback. Robots respected; 1 req/sec, concurrency 2.",
  },
  {
    sourceName: "KZN_DOE",
    kind: "kzn",
    baseUrl: "https://www.kzneducation.gov.za/",
    indexUrls: KZN_INDEXES,
    allowHostnames: ["www.kzneducation.gov.za", "kzneducation.gov.za", "www.education.gov.za", "education.gov.za"],
    robotsNote: "Official KZN DOE fallback. Robots respected; 1 req/sec, concurrency 2.",
  },
];

export function isAllowedSourceUrl(url: string, strategy: SourceStrategy) {
  try {
    const parsed = new URL(url);
    return strategy.allowHostnames.includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function toAbsoluteUrl(baseUrl: string, href: string) {
  try {
    const normalizedHref = href.replace(/&amp;/g, "&");
    return new URL(normalizedHref, baseUrl).toString();
  } catch {
    return null;
  }
}

export function extractHtmlHrefs(html: string) {
  return Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map((match) => match[1]);
}

function stripHtmlTags(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLinkClickCandidate(url: string) {
  try {
    const parsed = new URL(url);
    if (!/linkclick\.aspx/i.test(parsed.pathname)) return url;
    parsed.searchParams.delete("forcedownload");
    return parsed.toString();
  } catch {
    return url;
  }
}

function isPdfCandidateUrl(url: string) {
  if (/\.pdf(\?|$)/i.test(url)) return true;
  if (/[?&]file=[^&]*\.pdf(?:$|&)/i.test(url)) return true;
  if (/[?&]download=[^&]*\.pdf(?:$|&)/i.test(url)) return true;
  if (!/linkclick\.aspx/i.test(url)) return false;
  if (/fileticket=/i.test(url)) return true;
  if (/link=/i.test(url) && /\.pdf/i.test(decodeURIComponent(url))) return true;
  return false;
}

function isLikelyPastPaperLink(
  strategy: SourceStrategy,
  absoluteUrl: string,
  label: string,
  contextText?: string
) {
  if (strategy.kind === "dbe") return true;

  const blob = decodeURIComponent(`${absoluteUrl} ${label} ${contextText || ""}`).toLowerCase();
  const hasExamSignals =
    /\b(past exam|past paper|exam paper|question paper|memo|marking guideline|nsc|senior certificate|final examination|supplementary|may\/june|nov(?:ember)?|march)\b/.test(
      blob
    ) || /\bgr(?:ade)?\s*12\b/.test(blob);
  const hasExcludedSignals =
    /\b(textbook|textbk|wcg-blob-files|banking details|annexure|policy|circular|form|registration form|timetable|faq|guideline)\b/.test(
      blob
    );

  return hasExamSignals && !hasExcludedSignals;
}

export function extractPdfLinksFromHtml(html: string, pageUrl: string, strategy: SourceStrategy): ExtractedPdfLink[] {
  const anchors = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const moduleTitleById = new Map<string, string>();
  for (const match of html.matchAll(/id=["']dnn_ctr(\d+)_dnnTITLE_titleLabel["'][^>]*>([\s\S]*?)<\/span>/gi)) {
    const moduleId = match[1];
    const title = stripHtmlTags(match[2] || "").replace(/\s+/g, " ").trim();
    if (moduleId && title) {
      moduleTitleById.set(moduleId, title.slice(0, 160));
    }
  }
  const results: ExtractedPdfLink[] = [];

  for (const anchor of anchors) {
    const href = anchor[1] || "";
    const label = stripHtmlTags(anchor[2] || "");
    const absolute = toAbsoluteUrl(pageUrl, href);
    if (!absolute) continue;
    if (!isAllowedSourceUrl(absolute, strategy)) continue;
    if (!isPdfCandidateUrl(absolute)) continue;
    let contextText: string | undefined;
    const anchorTag = anchor[0] || "";
    const anchorIdMatch = anchorTag.match(/\sid=["']([^"']+)["']/i);
    const moduleIdMatch = anchorIdMatch?.[1]?.match(/dnn_ctr(\d+)_/i);
    const moduleTitle = moduleIdMatch?.[1] ? moduleTitleById.get(moduleIdMatch[1]) : undefined;
    if (typeof anchor.index === "number") {
      const rowStart = html.lastIndexOf("<tr", anchor.index);
      const rowEnd = html.indexOf("</tr>", anchor.index);
      if (rowStart >= 0 && rowEnd > rowStart && rowEnd - rowStart < 5000) {
        if (moduleTitle) {
          contextText = moduleTitle;
        }
      } else if (moduleTitle) {
        contextText = moduleTitle;
      }
    } else if (moduleTitle) {
      contextText = moduleTitle;
    }
    if (!isLikelyPastPaperLink(strategy, absolute, label, contextText)) continue;

    results.push({
      url: normalizeLinkClickCandidate(absolute),
      label,
      contextText,
    });
  }

  const unique = new Map<string, ExtractedPdfLink>();
  for (const item of results) {
    if (!unique.has(item.url)) {
      unique.set(item.url, item);
    }
  }
  return Array.from(unique.values());
}

export function extractCandidateYearPagesFromHtml(html: string, pageUrl: string, strategy: SourceStrategy) {
  const hrefs = extractHtmlHrefs(html);
  const links = hrefs
    .filter((href) => !/^(mailto:|tel:|javascript:|#)/i.test(href.trim()))
    .map((href) => toAbsoluteUrl(pageUrl, href))
    .filter((url): url is string => Boolean(url))
    .filter((url) => isAllowedSourceUrl(url, strategy))
    .filter((url) => {
      try {
        const parsed = new URL(url);
        const pathname = parsed.pathname.toLowerCase();
        if (/\.(css|js|ico|svg|png|jpe?g|gif|webp|woff2?|xml|json|txt|zip|docx?|xlsx?|pptx?)$/.test(pathname)) {
          return false;
        }
      } catch {
        return false;
      }
      return true;
    })
    .filter((url) => !isPdfCandidateUrl(url));

  const yearLinks = links.filter((url) => /20\d{2}/.test(decodeURIComponent(url)));
  if (strategy.kind === "dbe") {
    const examLinks = links.filter((url) => {
      const decoded = decodeURIComponent(url).toLowerCase();
      return (
        /\/curriculum\/.+examinations\//.test(decoded) ||
        /\/pastexampapers\//.test(decoded) ||
        /\b(nsc|grade10exams|grade11exams|supplementary|seniorcertificate)\b/.test(decoded)
      );
    });
    return Array.from(new Set([...yearLinks, ...examLinks]));
  }

  const keywordLinks = links.filter((url) => {
    const decoded = decodeURIComponent(url).toLowerCase();
    if (strategy.kind === "wced") {
      return (
        /\/education\/(exams|documents|national-senior-certificate|senior-certificate|past-exam-papers)/.test(decoded) ||
        /media_category=/.test(decoded)
      );
    }
    if (strategy.kind === "kzn") {
      return /\/index\.php\/resources\//.test(decoded);
    }
    return false;
  });

  return Array.from(new Set([...yearLinks, ...keywordLinks]));
}
