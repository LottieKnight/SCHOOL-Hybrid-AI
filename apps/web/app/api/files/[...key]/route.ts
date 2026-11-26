import { NextRequest, NextResponse } from "next/server";
import { createReadStream, promises as fs } from "node:fs";
import path from "node:path";
import { getStorageProvider } from "@/lib/storage";
import { pastPapersError, pastPapersLog } from "@/lib/pastPapers/logging";
import { pastPapersOpsLog } from "@/lib/pastPapers/opsLogger";

export const runtime = "nodejs";

function contentTypeFromPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

function decodeKeySegments(segments: string[]) {
  return segments
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

type FileRouteParams = { key: string[] };

export async function GET(request: NextRequest, context: { params: Promise<FileRouteParams> }) {
  const { key: keySegments } = await context.params;
  const key = decodeKeySegments(keySegments || []);

  if (!key || key.trim().length === 0) {
    return NextResponse.json({ error: "Missing file key." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const provider = getStorageProvider();
  const localPath = provider.getLocalPath ? provider.getLocalPath(key) : null;

  pastPapersLog("files.request", {
    key,
    keySegments,
    hasLocalPath: Boolean(localPath),
  });
  pastPapersOpsLog("info", "files.request", {
    key,
    hasLocalPath: Boolean(localPath),
  });

  if (!localPath) {
    pastPapersOpsLog("warn", "files.unsupported_provider", { key });
    return NextResponse.json(
      { error: "Storage provider does not support local streaming" },
      { status: 501, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const stats = await fs.stat(localPath);
    const etag = "W/\"" + stats.size + "-" + stats.mtimeMs + "\"";
    const download = request.nextUrl.searchParams.get("download") === "1";
    const disposition = download ? "attachment" : "inline";
    const filename = path.basename(localPath);
    const stream = createReadStream(localPath);
    const contentType = contentTypeFromPath(localPath);

    pastPapersLog("files.stream.success", {
      key,
      localPath,
      size: stats.size,
      contentType,
      disposition,
    });
    pastPapersOpsLog("info", "files.stream.success", {
      key,
      size: stats.size,
      contentType,
      disposition,
    });

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control":
          contentType === "application/pdf"
            ? "public, max-age=86400, stale-while-revalidate=43200"
            : "public, max-age=3600",
        ETag: etag,
        "Last-Modified": stats.mtime.toUTCString(),
        "Content-Disposition": disposition + "; filename=\"" + filename + "\"",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    pastPapersError("files.stream.failed", error, {
      key,
      localPath,
    });
    pastPapersOpsLog("warn", "files.stream.missing", {
      key,
      localPath,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "File not found", key }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
