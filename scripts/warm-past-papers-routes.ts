import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CliOptions = {
  baseUrl: string;
  classId: string;
  maxPapers: number;
  concurrency: number;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    baseUrl: process.env.WARM_BASE_URL || "http://localhost:3000",
    classId: process.env.WARM_CLASS_ID || "demo-class",
    maxPapers: Number(process.env.WARM_MAX_PAPERS || 500),
    concurrency: Number(process.env.WARM_CONCURRENCY || 6),
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
    } else if (arg.startsWith("--class-id=")) {
      options.classId = arg.slice("--class-id=".length);
    } else if (arg.startsWith("--max-papers=")) {
      options.maxPapers = Number(arg.slice("--max-papers=".length));
    } else if (arg.startsWith("--concurrency=")) {
      options.concurrency = Number(arg.slice("--concurrency=".length));
    }
  }

  return options;
}

function encodePathSegment(value: string | number) {
  return encodeURIComponent(String(value));
}

async function warmUrl(url: string): Promise<{ ok: boolean; status: number | null; url: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return { ok: response.ok, status: response.status, url };
  } catch {
    return { ok: false, status: null, url };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      await worker(next);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const start = Date.now();

  const papers = await prisma.pastPaper.findMany({
    where: {
      paperStorageKey: { not: null },
      grade: { not: null },
      year: { not: null },
      subject: { not: "Unknown" },
    },
    select: {
      id: true,
      province: true,
      grade: true,
      subject: true,
      year: true,
      session: true,
    },
    orderBy: [{ year: "desc" }, { subject: "asc" }],
    take: options.maxPapers,
  });

  const paths = new Set<string>();
  paths.add(`/classes/${encodePathSegment(options.classId)}/past-papers`);

  for (const paper of papers) {
    if (paper.grade === null || paper.year === null) continue;
    const classBase = `/classes/${encodePathSegment(options.classId)}/past-papers`;
    const provincePath = `${classBase}/${encodePathSegment(paper.province)}`;
    const gradePath = `${provincePath}/${paper.grade}`;
    const subjectPath = `${gradePath}/${encodePathSegment(paper.subject)}`;
    const yearPath = `${subjectPath}/${paper.year}`;
    const sessionPath = `${yearPath}/${encodePathSegment(paper.session)}`;
    const paperPath = `${sessionPath}/${paper.id}`;

    paths.add(provincePath);
    paths.add(gradePath);
    paths.add(subjectPath);
    paths.add(yearPath);
    paths.add(sessionPath);
    paths.add(paperPath);
  }

  const urls = [...paths].map((path) => `${options.baseUrl}${path}`);
  let okCount = 0;
  let failCount = 0;

  console.log(`[warm] starting ${urls.length} requests against ${options.baseUrl}`);

  await runPool(urls, options.concurrency, async (url) => {
    const result = await warmUrl(url);
    if (result.ok) {
      okCount += 1;
    } else {
      failCount += 1;
      console.log(`[warm] fail status=${result.status ?? "timeout"} url=${result.url}`);
    }
  });

  const elapsedMs = Date.now() - start;
  console.log(
    `[warm] done ok=${okCount} fail=${failCount} total=${urls.length} elapsedMs=${elapsedMs}`
  );
}

main()
  .catch((error) => {
    console.error("[warm] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

