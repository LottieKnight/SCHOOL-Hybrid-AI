# Web analytics

The web app (`apps/web`) reports visitor and page-view data through
[Vercel Web Analytics](https://vercel.com/docs/analytics). The
`<Analytics />` component from `@vercel/analytics/next` is rendered in
`apps/web/app/layout.tsx`, so every page in the App Router sends a beacon
to `/_vercel/insights` on the production deployment.

## Viewing the data

1. Open the SCHOOL project in the [Vercel dashboard](https://vercel.com).
2. Go to the **Analytics** tab.
3. If analytics has never been enabled for the project, click **Enable**
   (one-time step; no redeploy is needed once this branch is deployed).

The dashboard shows visitors, page views, top pages, referrers, countries,
devices, and browsers, filterable by time range.

## Privacy notes

- Vercel Web Analytics is cookieless and does not store IP addresses or
  any cross-site identifier, so it does not require opt-in via the cookie
  consent banner ("essential only" users are unaffected).
- Nothing is collected on `next dev` / local builds; the script only
  activates on Vercel deployments. In development the component logs
  events to the browser console instead of sending them.

## Speed Insights

`<SpeedInsights />` from `@vercel/speed-insights/next` is also rendered in
the root layout. It reports Core Web Vitals (LCP, CLS, INP, TTFB, FCP) from
real visitors to the project's **Speed Insights** tab in the Vercel
dashboard. Like Web Analytics it is cookieless, only runs on Vercel
deployments, and may need a one-time **Enable** click on that tab the
first time.

## Other monitoring surfaces

- **Observability tab (Vercel dashboard)** — runtime logs, function
  invocations/errors, edge requests, and build diagnostics. Always on; no
  code changes needed.
- **Sentry** — error and performance monitoring is already integrated via
  `@sentry/nextjs` (`initSentry()` in the root layout plus the
  `sentry.*.config.ts` files). It only activates when the `SENTRY_DSN` /
  `NEXT_PUBLIC_SENTRY_DSN` env vars are set on the deployment.
- **Admin dashboards (in-app)** — `/admin/metrics` (unlock/quote funnels,
  wallet health), `/admin/learning-analytics`, and `/admin/growth` show
  product-level usage from the platform's own database.

## Custom events (optional)

To count a specific action (e.g. signups, paper unlocks), call `track`
from any client component:

```tsx
import { track } from "@vercel/analytics";

track("past_paper_unlocked", { subject: "mathematics" });
```

Custom events appear in the same Analytics tab under **Events**.
