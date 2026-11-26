import Link from "next/link";
import { notFound } from "next/navigation";

function isAllowedFileUrl(file: string) {
  if (file.startsWith("/past-papers/")) return true;
  if (file.startsWith("/api/files/")) return true;
  return false;
}

type ViewerSearchParams = {
  file?: string;
  back?: string;
  title?: string;
};

export default async function PastPaperViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<ViewerSearchParams>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const file = resolvedSearchParams.file ? decodeURIComponent(resolvedSearchParams.file) : "";
  const title = resolvedSearchParams.title
    ? decodeURIComponent(resolvedSearchParams.title)
    : "Past Paper PDF";
  const fallbackBack = `/classes/${resolvedParams.classId}/past-papers`;
  const back = resolvedSearchParams.back ? decodeURIComponent(resolvedSearchParams.back) : fallbackBack;

  if (!file || !isAllowedFileUrl(file)) {
    notFound();
  }

  return (
    <section className="card glass" style={{ display: "grid", gap: "14px" }}>
      <div className="outline-actions">
        <Link className="button" href={back || fallbackBack}>
          Back to Past Papers
        </Link>
        <a className="button" href={file} target="_blank" rel="noreferrer">
          Open in new tab
        </a>
        <a className="button" href={file + (file.includes("?") ? "&download=1" : "?download=1")}>
          Download
        </a>
      </div>
      <h1 className="title">{title}</h1>
      <div
        className="glass-strong"
        style={{ height: "78vh", overflow: "hidden", borderRadius: "16px", border: "1px solid var(--stroke)" }}
      >
        <iframe
          title={title}
          src={file}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </div>
    </section>
  );
}

