"use client";

import { useEffect, useState } from "react";
import { getStoredLiteMode } from "@/lib/liteMode";

type ResourceItem = {
  title: string;
  sourcePdfPath: string;
  pageRefs?: string;
};

export function LessonResources({ resources }: { resources: ResourceItem[] }) {
  const [liteMode, setLiteMode] = useState(false);
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = getStoredLiteMode();
    setLiteMode(stored ?? document.documentElement.classList.contains("lite-mode"));
  }, []);

  if (!resources.length) {
    return <p className="badge">No resources yet.</p>;
  }

  return (
    <ul>
      {resources.map((resource) => {
        const key = resource.sourcePdfPath;
        const href = resource.sourcePdfPath.startsWith("http")
          ? resource.sourcePdfPath
          : `/api/content/pdf?path=${encodeURIComponent(resource.sourcePdfPath)}`;
        const isLoaded = loaded[key] || !liteMode;
        return (
          <li key={resource.sourcePdfPath}>
            {isLoaded ? (
              <a href={href} target="_blank" rel="noreferrer">
                {resource.title}
              </a>
            ) : (
              <button
                type="button"
                className="button"
                onClick={() => setLoaded((prev) => ({ ...prev, [key]: true }))}
              >
                Load PDF
              </button>
            )}
            {resource.pageRefs ? ` (${resource.pageRefs})` : null}
          </li>
        );
      })}
    </ul>
  );
}
