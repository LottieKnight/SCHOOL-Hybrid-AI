import { notFound } from "next/navigation";
import { SplitScreenViewerClient } from "./SplitScreenViewerClient";

export const runtime = "nodejs";

function isAllowedFileUrl(file: string): boolean {
  if (file.startsWith("/past-papers/")) return true;
  if (file.startsWith("/api/files/")) return true;
  try {
    const url = new URL(file);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

type ViewerSearchParams = {
  file?: string;
  memo?: string;
  title?: string;
  back?: string;
};

export default async function PastPaperViewerPage({
  searchParams,
}: {
  searchParams: Promise<ViewerSearchParams>;
}) {
  const sp = await searchParams;
  const file = sp.file ? decodeURIComponent(sp.file) : "";
  const memo = sp.memo ? decodeURIComponent(sp.memo) : undefined;
  const title = sp.title ? decodeURIComponent(sp.title) : "Past Paper";
  const back = sp.back ? decodeURIComponent(sp.back) : "/past-papers";

  if (!file || !isAllowedFileUrl(file)) notFound();
  if (memo && !isAllowedFileUrl(memo)) notFound();

  return (
    <SplitScreenViewerClient
      paperUrl={file}
      memoUrl={memo}
      title={title}
      backUrl={back}
    />
  );
}

