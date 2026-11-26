import * as Sentry from "@sentry/nextjs";

const IGNORED_ERROR_PATTERNS: Array<string | RegExp> = [
  /Hydration failed because the server rendered HTML didn't match the client\./i,
  /There was an error while hydrating\./i,
  /Hydration failed because the initial UI does not match what was rendered on the server\./i,
  /Failed to execute 'selectNode' on 'Range'/i,
];

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  enabled: Boolean(process.env.SENTRY_DSN),
  ignoreErrors: IGNORED_ERROR_PATTERNS,
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
