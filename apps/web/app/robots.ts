import type { MetadataRoute } from "next";

function resolveSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.trim().length > 0) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
  }
  if (process.env.VERCEL_URL && process.env.VERCEL_URL.trim().length > 0) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, "")}`;
  }
  return "http://localhost:3000";
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
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
          "/seo/",
          "/llm-context",
        ],
        disallow: [
          "/admin/",
          "/api/",
          "/phase/",
          "/dashboard/",
          "/messages/",
          "/orders/",
          "/settings/",
          "/wallet/",
          "/checkout",
          "/cart",
        ],
      },
    ],
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl,
  };
}
