import { NextRequest, NextResponse } from "next/server";
import { SEO_PAGES, getSeoPage, type SeoPage } from "@/lib/seoPages";

// Structured-data validator for the P1 SEO/GEO landing pages (M4).
// Checks every page emits valid, complete Product/Article + FAQPage schema:
// required keys present, correct types, non-empty strings, product links resolve
// to a store route, related slugs exist. Run against the built site to verify.

type ValidationIssue = {
  field: string;
  message: string;
};

type PageValidation = {
  slug: string;
  url: string;
  ok: boolean;
  issues: ValidationIssue[];
  schemas: string[];
};

function checkString(page: SeoPage, field: string, value: string | undefined): ValidationIssue | null {
  if (!value || value.trim().length === 0) {
    return { field, message: `${field} is empty` };
  }
  return null;
}

function validatePage(page: SeoPage): PageValidation {
  const issues: ValidationIssue[] = [];
  const schemas: string[] = [];

  for (const [field, value] of Object.entries({
    slug: page.slug,
    query: page.query,
    title: page.title,
    metaDescription: page.metaDescription,
    h1: page.h1,
    intro: page.intro,
  })) {
    const issue = checkString(page, field, value);
    if (issue) issues.push(issue);
  }

  if (page.sections.length === 0) {
    issues.push({ field: "sections", message: "page has no body sections" });
  }
  const bodyWordCount = [page.intro, ...page.sections.map((section) => section.body)].reduce(
    (count, text) => count + text.split(/\s+/).length,
    0
  );
  const faqWordCount = page.faqs.reduce(
    (count, faq) => count + faq.question.split(/\s+/).length + faq.answer.split(/\s+/).length,
    0
  );
  const totalWordCount = bodyWordCount + faqWordCount;
  if (totalWordCount < 400) {
    issues.push({ field: "body", message: `on-page content is ~${totalWordCount} words (target 400–800)` });
  }

  if (page.faqs.length === 0) {
    issues.push({ field: "faqs", message: "page has no FAQ entries (FAQPage schema required)" });
  } else {
    for (const [index, faq] of page.faqs.entries()) {
      if (!faq.question?.trim()) {
        issues.push({ field: `faqs[${index}].question`, message: "empty question" });
      }
      if (!faq.answer?.trim()) {
        issues.push({ field: `faqs[${index}].answer`, message: "empty answer" });
      }
    }
    schemas.push("FAQPage");
  }

  if (page.schemaType === "Product") {
    if (!page.productLink) {
      issues.push({ field: "productLink", message: "Product page is missing a product link" });
    } else {
      if (!page.productLink.store.trim()) issues.push({ field: "productLink.store", message: "empty store" });
      if (!page.productLink.slug.trim()) issues.push({ field: "productLink.slug", message: "empty product slug" });
      if (!page.productLink.label.trim()) issues.push({ field: "productLink.label", message: "empty label" });
    }
    schemas.push("Product");
  } else if (page.schemaType === "Article") {
    schemas.push("Article");
  } else {
    issues.push({ field: "schemaType", message: `unknown schemaType: ${page.schemaType}` });
  }

  for (const relatedSlug of page.relatedSlugs ?? []) {
    if (!getSeoPage(relatedSlug)) {
      issues.push({ field: "relatedSlugs", message: `related slug '${relatedSlug}' does not exist` });
    }
  }

  return {
    slug: page.slug,
    url: `/seo/${page.slug}`,
    ok: issues.length === 0,
    issues,
    schemas,
  };
}

export function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug");
  const pages = slug ? [getSeoPage(slug)].filter((page): page is SeoPage => Boolean(page)) : SEO_PAGES;

  if (slug && pages.length === 0) {
    return NextResponse.json({ ok: false, error: `No SEO page with slug '${slug}'.` }, { status: 404 });
  }

  const results = pages.map(validatePage);
  const okCount = results.filter((result) => result.ok).length;

  return NextResponse.json({
    ok: okCount === results.length,
    checked: results.length,
    valid: okCount,
    pages: results,
    note: "Validates schema shape from seoPages.ts. For Google Rich Results, also run the live URL through the official Rich Results Test.",
  });
}
