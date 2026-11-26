"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * Renders lesson/markdown content with LaTeX math support (KaTeX).
 * Replaces the old `renderMarkdown` (marked + sanitize-html) which could not
 * render $...$ / $$...$$ math. React-Markdown sanitises HTML by default (no
 * dangerouslySetInnerHTML), which is safer for a minors-facing platform.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
    >
      {children ?? ""}
    </ReactMarkdown>
  );
}
