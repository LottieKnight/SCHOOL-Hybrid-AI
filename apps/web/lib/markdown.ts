import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({
  mangle: false,
  headerIds: false,
} as any);

const MAX_MARKDOWN_CACHE = 200;
const markdownCache = new Map<string, string>();

export function renderMarkdown(raw: string) {
  const input = raw || "";
  if (markdownCache.has(input)) {
    return markdownCache.get(input) ?? "";
  }
  const html = marked.parse(input);
  const sanitized = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3"]),
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "loading", "decoding", "referrerpolicy"],
    },
    transformTags: {
      img: (_tagName: string, attribs: Record<string, string>) => ({
        tagName: "img",
        attribs: {
          ...attribs,
          loading: attribs.loading || "lazy",
          decoding: attribs.decoding || "async",
          referrerpolicy: attribs.referrerpolicy || "no-referrer",
        },
      }),
    },
  });
  if (markdownCache.size >= MAX_MARKDOWN_CACHE) {
    markdownCache.clear();
  }
  markdownCache.set(input, sanitized);
  return sanitized;
}
