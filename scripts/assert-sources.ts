import { OFFICIAL_SOURCE_STRATEGIES } from "./lib/source-strategies";

function fail(message: string): never {
  console.error(`[assert-sources] FAIL: ${message}`);
  process.exit(1);
}

function hasLegacyPath(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    if (pathname.includes("(nsc)")) return true;
    if (pathname.endsWith("/pastexaminationpapers.aspx")) return true;
    return false;
  } catch {
    return true;
  }
}

function main() {
  const dbe = OFFICIAL_SOURCE_STRATEGIES.find((item) => item.sourceName === "DBE");
  if (!dbe) {
    fail("DBE strategy is missing.");
  }

  if (dbe.indexUrls.length === 0) {
    fail("DBE strategy has no index URLs.");
  }

  const invalid = dbe.indexUrls.filter((url) => hasLegacyPath(url));
  if (invalid.length > 0) {
    fail(`DBE strategy contains legacy URLs: ${invalid.join(", ")}`);
  }

  const nonOfficialHosts = dbe.indexUrls.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname !== "www.education.gov.za" && parsed.hostname !== "education.gov.za";
    } catch {
      return true;
    }
  });

  if (nonOfficialHosts.length > 0) {
    fail(`DBE strategy contains non-official hosts: ${nonOfficialHosts.join(", ")}`);
  }

  console.log("[assert-sources] PASS");
  console.log(
    JSON.stringify(
      {
        source: dbe.sourceName,
        indexUrls: dbe.indexUrls,
      },
      null,
      2
    )
  );
}

main();
