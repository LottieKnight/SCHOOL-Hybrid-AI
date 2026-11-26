import zlib from "node:zlib";
import { promisify } from "node:util";

type ClientName = "node-fetch" | "axios" | "got";
type HeaderProfile = "default" | "modern";

type FetchResult = {
  url: string;
  client: ClientName;
  profile: HeaderProfile;
  status: number | null;
  ok: boolean;
  finalUrl: string | null;
  error: string | null;
  responseSnippet: string;
  headerSubset: Record<string, string>;
};

const gunzip = promisify(zlib.gunzip);
const brotli = promisify(zlib.brotliDecompress);
const inflate = promisify(zlib.inflate);

const TEST_URLS = [
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate%28NSC%29Examinations/NSCPastExaminationpapers.aspx",
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate%28NSC%29Examinations/PastExamPapers.aspx",
  "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/PastExaminationPapers.aspx",
];

const MODERN_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-ZA,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  Referer: "https://www.education.gov.za/",
};

function getHeaders(profile: HeaderProfile) {
  if (profile === "modern") return MODERN_HEADERS;
  return {};
}

function trimSnippet(text: string) {
  return text.replace(/\s+/g, " ").slice(0, 300);
}

function pickHeaders(headers: Record<string, string>) {
  const keys = ["server", "content-type", "content-length", "location", "cf-ray", "set-cookie", "via"];
  const out: Record<string, string> = {};
  for (const key of keys) {
    if (headers[key]) out[key] = headers[key];
  }
  return out;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

async function runNodeFetch(url: string, profile: HeaderProfile): Promise<FetchResult> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: getHeaders(profile),
    });
    const text = await response.text();
    const record = headersToRecord(response.headers);
    return {
      url,
      client: "node-fetch",
      profile,
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
      error: null,
      responseSnippet: trimSnippet(text),
      headerSubset: pickHeaders(record),
    };
  } catch (error) {
    return {
      url,
      client: "node-fetch",
      profile,
      status: null,
      ok: false,
      finalUrl: null,
      error: error instanceof Error ? error.message : String(error),
      responseSnippet: "",
      headerSubset: {},
    };
  }
}

async function runAxios(url: string, profile: HeaderProfile): Promise<FetchResult> {
  try {
    const axiosMod = await import("axios");
    const axios = "default" in axiosMod ? axiosMod.default : axiosMod;
    const response = await axios.get(url, {
      headers: getHeaders(profile),
      maxRedirects: 5,
      validateStatus: () => true,
      responseType: "text",
      timeout: 20000,
      decompress: true,
    });
    const headerRecord = Object.fromEntries(
      Object.entries(response.headers || {}).map(([key, value]) => [String(key).toLowerCase(), String(value)])
    );
    return {
      url,
      client: "axios",
      profile,
      status: typeof response.status === "number" ? response.status : null,
      ok: response.status >= 200 && response.status < 300,
      finalUrl: response.request?.res?.responseUrl || url,
      error: null,
      responseSnippet: trimSnippet(typeof response.data === "string" ? response.data : JSON.stringify(response.data)),
      headerSubset: pickHeaders(headerRecord),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      url,
      client: "axios",
      profile,
      status: null,
      ok: false,
      finalUrl: null,
      error: message.includes("Cannot find package")
        ? "axios not installed (skipped)"
        : message,
      responseSnippet: "",
      headerSubset: {},
    };
  }
}

async function decodeBody(buffer: Buffer, encoding: string | undefined) {
  const enc = (encoding || "").toLowerCase();
  if (enc.includes("br")) {
    return (await brotli(buffer)).toString("utf-8");
  }
  if (enc.includes("gzip")) {
    return (await gunzip(buffer)).toString("utf-8");
  }
  if (enc.includes("deflate")) {
    return (await inflate(buffer)).toString("utf-8");
  }
  return buffer.toString("utf-8");
}

async function runGot(url: string, profile: HeaderProfile): Promise<FetchResult> {
  try {
    const gotMod = await import("got");
    const gotClient = "default" in gotMod ? gotMod.default : gotMod;
    const response = await gotClient(url, {
      headers: getHeaders(profile),
      followRedirect: true,
      throwHttpErrors: false,
      timeout: { request: 20000 },
      responseType: "buffer",
      decompress: false,
      retry: { limit: 0 },
    });
    const headers = Object.fromEntries(
      Object.entries(response.headers || {}).map(([key, value]) => [String(key).toLowerCase(), String(value)])
    );
    const text = await decodeBody(Buffer.from(response.body as Buffer), headers["content-encoding"]);
    return {
      url,
      client: "got",
      profile,
      status: response.statusCode || null,
      ok: response.statusCode >= 200 && response.statusCode < 300,
      finalUrl: response.url || url,
      error: null,
      responseSnippet: trimSnippet(text),
      headerSubset: pickHeaders(headers),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      url,
      client: "got",
      profile,
      status: null,
      ok: false,
      finalUrl: null,
      error: message.includes("Cannot find package") ? "got not installed (skipped)" : message,
      responseSnippet: "",
      headerSubset: {},
    };
  }
}

async function runClient(url: string, client: ClientName, profile: HeaderProfile) {
  if (client === "node-fetch") return runNodeFetch(url, profile);
  if (client === "axios") return runAxios(url, profile);
  return runGot(url, profile);
}

async function main() {
  const results: FetchResult[] = [];
  const clients: ClientName[] = ["node-fetch", "axios", "got"];
  const profiles: HeaderProfile[] = ["default", "modern"];

  for (const url of TEST_URLS) {
    for (const client of clients) {
      for (const profile of profiles) {
        const result = await runClient(url, client, profile);
        results.push(result);
      }
    }
  }

  console.log("[test-dbe-fetch] Request matrix");
  console.table(
    results.map((row) => ({
      url: row.url,
      client: row.client,
      profile: row.profile,
      status: row.status,
      ok: row.ok,
      finalUrl: row.finalUrl,
      error: row.error || "",
    }))
  );

  console.log("\n[test-dbe-fetch] Detailed headers + snippets");
  for (const row of results) {
    console.log("\n---");
    console.log(`${row.client} | ${row.profile} | ${row.url}`);
    console.log(`status=${row.status} ok=${row.ok} finalUrl=${row.finalUrl}`);
    if (row.error) {
      console.log(`error=${row.error}`);
      continue;
    }
    console.log("headers=", JSON.stringify(row.headerSubset, null, 2));
    console.log("bodySnippet=", row.responseSnippet);
  }
}

main().catch((error) => {
  console.error("[test-dbe-fetch] failed", error);
  process.exit(1);
});
