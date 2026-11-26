import type { MetadataRoute } from "next";
import { SEO_PAGES, seoPageUrl } from "@/lib/seoPages";

function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim().length > 0) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL && process.env.VERCEL_URL.trim().length > 0) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const now = new Date();

  // Curated public MVP routes only.
  const routes = [
    "",
    "/learn",
    "/bookstore",
    "/book/becoming-el-matador",
    "/store/equipment",
    "/store/clothing",
    "/store/aquaquick",
    "/store/iphone",
    "/store/cosmic-cottons",
    "/store/flightmode",
    "/sellers",
    "/marketplace",
    "/llm-context",
  ];

  const core: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1 : route === "/learn" || route === "/bookstore" ? 0.9 : 0.7,
  }));

  // P1 SEO/GEO landing pages — one URL per high-intent long-tail query.
  const seo: MetadataRoute.Sitemap = SEO_PAGES.map((page) => ({
    url: `${siteUrl}${seoPageUrl(page)}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...core, ...seo];
}
