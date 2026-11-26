import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";
import { fileURLToPath } from "url";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = __dirname;
// npm workspaces hoist node_modules to the repo root; the tracing root must
// cover them or Vercel's function bundle omits parts of Next's own runtime.
const monorepoRoot = path.join(webRoot, "..", "..");

const isProd = process.env.NODE_ENV === "production";
const isWindows = process.platform === "win32";
const apiProxyTarget =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.API_URL ||
  "";

// Content-Security-Policy is set per-request by the middleware (proxy.ts)
// with a per-request nonce for 'strict-dynamic' support.
const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

if (isProd && process.env.HSTS_ENABLED === "true") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
    ],
  },
  output: isWindows ? undefined : "standalone",
  compress: true,
  serverExternalPackages: ["bcryptjs", "pg", "pg-pool", "pg-protocol", "pg-types", "@saedu/shared"],
  outputFileTracingRoot: monorepoRoot,
  // The tracing root is the monorepo root (so hoisted node_modules are captured),
  // which also exposes sibling apps and dev-only files to the tracer. Exclude the
  // artifacts that would otherwise bloat each function past Vercel's 250 MB limit
  // and fail the deploy at the "Deploying outputs" step.
  outputFileTracingExcludes: {
    "**/*": [
      // Webpack build cache — never needed at runtime, but the tracer otherwise
      // pulls .next/cache/webpack/*.pack (one is ~900 MB) into the function
      // filePathMap. That blows past Vercel's 100 MB per-file upload limit and
      // fails `vercel deploy` mid-upload with "File size limit exceeded".
      "./.next/cache/**/*",
      "**/.next/cache/**/*",
      "**/*.pack",
      "**/*.pack.old",
      "../android/**/*",
      "../mobile/**/*",
      "../api/**/*",
      "../../android/**/*",
      "../../android-signing/**/*",
      "./.tmp-*.png",
      "./stories/**/*",
      "./test/**/*",
      "./.storybook/**/*",
      "../../**/*.aab",
      "../../**/*.apk",
    ],
  },
  outputFileTracingIncludes: {
    "/**": ["../../packages/shared/**/*"],
    "/learn": ["../../packages/shared/content/**/*"],
    "/learn/[phase]": ["../../packages/shared/content/**/*"],
    "/learn/[phase]/[grade]": ["../../packages/shared/content/**/*"],
    "/learn/[phase]/[grade]/[subject]": ["../../packages/shared/content/**/*"],
    "/learn/[phase]/[grade]/[subject]/term/[term]": ["../../packages/shared/content/**/*"],
    "/learn/[phase]/[grade]/[subject]/term/[term]/week/[week]": ["../../packages/shared/content/**/*"],
  },
  experimental: {
    optimizePackageImports: ["marked", "sanitize-html"],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: securityHeaders,
    },
    {
      source: "/images/:path*",
      headers: [
        {
          key: "Cache-Control",
          value: isProd
            ? "public, max-age=31536000, immutable"
            : "no-store, max-age=0, must-revalidate",
        },
      ],
    },
  ],
  rewrites: async () => {
    if (!apiProxyTarget || apiProxyTarget.startsWith("/")) {
      return [];
    }
    // Whitelist, not blacklist. Most /api/* routes are served locally by Next
    // route handlers (community, curriculum, quiz, modules, past-papers, auth…).
    // Proxying all of /api/* to the backend would shadow every one of those and
    // break the live site whenever the backend is unreachable. Only prefixes
    // that have no local Next handler are forwarded, so this can never shadow a
    // working local route. auth/sessions is special-cased: it is conceptually
    // backend-only but lives under the local /api/auth/[...path] catch-all.
    const backendOnly = [
      "billing",
      "bookstore",
      "cart",
      "checkout",
      "download",
      "orders",
      "stores",
      "store",
      "wallet",
      "credits",
      "lessons",
      "library",
      "tutors",
      "university",
      "research",
      "bursaries",
      "catalog",
      "enterprise",
      "schools",
      "sso",
      "lti",
      "dsar",
      "brand",
      "public",
      "webhooks",
      "api-keys",
      "health",
      "metrics",
      "press",
      "retention",
      "messages",
      "auth/sessions",
    ];
    // Each prefix gets two rules: an exact path match (so a bare /api/stores
    // forwards to /stores and not the literal "/stores/:path*") and a wildcard
    // for subpaths.
    return backendOnly.flatMap((prefix) => [
      {
        source: `/api/${prefix}`,
        destination: `${apiProxyTarget}/${prefix}`,
      },
      {
        source: `/api/${prefix}/:path*`,
        destination: `${apiProxyTarget}/${prefix}/:path*`,
      },
    ]);
  },
  redirects: async () => [
    {
      source: "/assistant",
      destination: "/tutor",
      permanent: false,
    },
    {
      source: "/assistant/:path*",
      destination: "/tutor",
      permanent: false,
    },
    {
      source: "/phases/:phase/grade/:grade/:subject/term/:term/week/:week",
      destination: "/phase/:phase/grade/:grade/:subject/term/:term/week/:week",
      permanent: false,
    },
    {
      source: "/phase/:phase/grade/:grade/group/:group/subject/:subject/term/:term/week/:week",
      destination: "/phase/:phase/grade/:grade/:subject/term/:term/week/:week",
      permanent: false,
    },
    {
      source: "/phase/:phase/grade/:grade/group/:group/subject/:subject/child/:child/term/:term/week/:week",
      destination: "/phase/:phase/grade/:grade/:child/term/:term/week/:week",
      permanent: false,
    },
    {
      source: "/phases/:phase/grade/:grade/group/:group/subject/:subject/term/:term/week/:week",
      destination: "/phase/:phase/grade/:grade/:subject/term/:term/week/:week",
      permanent: false,
    },
    {
      source: "/phases/:phase/grade/:grade/group/:group/subject/:subject/child/:child/term/:term/week/:week",
      destination: "/phase/:phase/grade/:grade/:child/term/:term/week/:week",
      permanent: false,
    },
    {
      source: "/classes",
      destination: "/past-papers",
      permanent: false,
    },
  ],
};

const sentryConfig = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  hideSourceMaps: true,
});

export default isProd ? withNextIntl(sentryConfig) : withNextIntl(nextConfig);
