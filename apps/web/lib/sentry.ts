import * as Sentry from "@sentry/nextjs";

type SentryGlobal = typeof globalThis & {
  __schoolSentryInitialized?: boolean;
};

// Noise that should never page/aggregate as issues:
// - React hydration mismatches (often triggered by browser extensions, not app bugs)
// - Firefox Range.selectNode on a detached node (browser quirk, not our code)
const IGNORED_ERROR_PATTERNS: Array<string | RegExp> = [
  /Hydration failed because the server rendered HTML didn't match the client\./i,
  /There was an error while hydrating\./i,
  /Hydration failed because the initial UI does not match what was rendered on the server\./i,
  /Failed to execute 'selectNode' on 'Range'/i,
];

export function initSentry() {
  if (!process.env.SENTRY_DSN) return;

  const globalForSentry = globalThis as SentryGlobal;
  if (globalForSentry.__schoolSentryInitialized) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    ignoreErrors: IGNORED_ERROR_PATTERNS,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });

  globalForSentry.__schoolSentryInitialized = true;
}

export function captureAIError(
  error: Error,
  context: {
    mode: string;
    inputLength: number;
    grade?: number;
    institution?: string;
  }
) {
  if (!process.env.SENTRY_DSN) return;

  Sentry.withScope((scope) => {
    scope.setTag("feature", "ai_assistant");
    scope.setTag("mode", context.mode);
    scope.setContext("request", context);
    Sentry.captureException(error);
  });
}
