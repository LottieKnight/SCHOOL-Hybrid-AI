import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SEO_PAGES, getSeoPage, seoPageUrl, type SeoPage } from "@/lib/seoPages";
import { RouteHeader } from "@/components/ui/RouteHeader";

type Props = {
  params: Promise<{ slug: string }>;
};

function buildJsonLd(page: SeoPage) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const url = `${base.replace(/\/+$/, "")}${seoPageUrl(page)}`;
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
  if (page.schemaType === "Product" && page.productLink) {
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: page.title,
      description: page.metaDescription,
      url,
      brand: { "@type": "Brand", name: "SCHOOL Academic Supplies" },
      offers: {
        "@type": "Offer",
        url: `${base.replace(/\/+$/, "")}/store/${page.productLink.store}/${page.productLink.slug}`,
        priceCurrency: "ZAR",
        availability: "https://schema.org/InStock",
        seller: { "@type": "Organization", name: "SCHOOL Group" },
      },
    };
    return [faqSchema, productSchema];
  }
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.h1,
    description: page.metaDescription,
    url,
    author: { "@type": "Organization", name: "SCHOOL Group" },
    publisher: { "@type": "Organization", name: "SCHOOL Group" },
    mainEntityOfPage: url,
  };
  return [faqSchema, articleSchema];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page) {
    return { title: "Guide not found" };
  }
  return {
    title: page.title,
    description: page.metaDescription,
    openGraph: {
      type: "article",
      title: page.title,
      description: page.metaDescription,
      url: seoPageUrl(page),
    },
    alternates: { canonical: seoPageUrl(page) },
  };
}

export function generateStaticParams() {
  return SEO_PAGES.map((page) => ({ slug: page.slug }));
}

export const dynamic = "force-static";

export default async function SeoPageRoute({ params }: Props) {
  const { slug } = await params;
  const page = getSeoPage(slug);
  if (!page) notFound();

  const related = (page.relatedSlugs ?? [])
    .map((relatedSlug) => getSeoPage(relatedSlug))
    .filter((entry): entry is SeoPage => entry !== null);

  const productHref = page.productLink
    ? `/store/${page.productLink.store}/${page.productLink.slug}`
    : null;

  return (
    <div style={{ display: "grid", gap: "var(--space-4)" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(page)) }}
      />
      <RouteHeader
        eyebrow="Buyer's Guide"
        title={page.h1}
        description={page.intro}
      />
      <div className="list-item" style={{ display: "grid", gap: "var(--space-4)" }}>
        {page.sections.map((section) => (
          <section key={section.heading} style={{ display: "grid", gap: "var(--space-2)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-xl, 1.25rem)" }}>{section.heading}</h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>{section.body}</p>
          </section>
        ))}

        {productHref && page.productLink ? (
          <section
            style={{
              display: "grid",
              gap: "var(--space-2)",
              padding: "var(--space-4)",
              borderRadius: "var(--radius, 12px)",
              background: "var(--color-surface-raised, var(--paper, #faf7f0))",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "var(--text-xl, 1.25rem)" }}>
              Buy it from the SCHOOL marketplace
            </h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              {page.productLink.label} is listed in the SCHOOL Academic Supplies store at one
              delivered price. View the product, pick your options and check out.
            </p>
            <a
              href={productHref}
              style={{ display: "inline-block", fontWeight: 600, textDecoration: "underline" }}
            >
              View {page.productLink.label} →
            </a>
          </section>
        ) : null}

        {page.faqs.length > 0 ? (
          <section style={{ display: "grid", gap: "var(--space-2)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-xl, 1.25rem)" }}>Frequently asked questions</h2>
            {page.faqs.map((faq) => (
              <details
                key={faq.question}
                style={{
                  padding: "var(--space-3)",
                  borderRadius: "var(--radius, 12px)",
                  background: "var(--color-surface-raised, var(--paper, #faf7f0))",
                }}
              >
                <summary style={{ fontWeight: 600, cursor: "pointer" }}>{faq.question}</summary>
                <p style={{ margin: "var(--space-2) 0 0", lineHeight: 1.6 }}>{faq.answer}</p>
              </details>
            ))}
          </section>
        ) : null}

        {related.length > 0 ? (
          <section style={{ display: "grid", gap: "var(--space-2)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--text-xl, 1.25rem)" }}>Related guides</h2>
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)", display: "grid", gap: "var(--space-1)" }}>
              {related.map((entry) => (
                <li key={entry.slug}>
                  <a href={seoPageUrl(entry)}>{entry.h1}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
